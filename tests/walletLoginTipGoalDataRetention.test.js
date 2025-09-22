/* eslint-env node, jest */
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');
const { addressFromOwnerPublicKey } = require('../lib/wallet-auth');

function fakePublicKey(seed) {
  return Buffer.from(`retain-${seed}`).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function walletLogin(agent, publicKey) {
  const address = addressFromOwnerPublicKey(publicKey);
  const nr = await agent.post('/api/auth/wallet/nonce').send({ address });
  expect(nr.status).toBe(200);
  const vr = await agent.post('/api/auth/wallet/verify').send({ address, publicKey, signature: 'TEST' });
  expect(vr.status).toBe(200);
  const cookie = vr.headers['set-cookie'].find(c=>c.startsWith('getty_wallet_session='));
  expect(cookie).toBeTruthy();
  return { address, cookie: cookie.split(';')[0] };
}

describe('TipGoal data retention after wallet login', () => {
  let app, restore, server, agent;
  const cfgDir = process.cwd() + '/config';
  const cfgPath = path.join(cfgDir, 'tip-goal-config.json');

  beforeAll(async () => {
    ({ app, restore } = freshServer({
      GETTY_MULTI_TENANT_WALLET: '1',
      GETTY_WALLET_AUTH_ALLOW_DUMMY: '1',
      GETTY_REQUIRE_SESSION: '1',
      GETTY_SILENCE_REDIS_TEST: '1'
    }));
    if (app.startTestServer) server = await app.startTestServer();
    agent = request(server || app);
  });
  afterAll(done => { try { restore && restore(); } catch {} if (server) server.close(done); else done(); });

  test('Amounts/theme persist in /api/modules after login', async () => {
    try { if (fs.existsSync(cfgPath)) fs.unlinkSync(cfgPath); } catch {}

    fs.writeFileSync(cfgPath, JSON.stringify({ monthlyGoal: 42, currentAmount: 7, theme: 'modern-list', walletAddress: '' }, null, 2));

    try {
      if (process.env.JEST_WORKER_ID) {
        const workerPath = path.join(cfgDir, `tip-goal-config.${process.env.JEST_WORKER_ID}.json`);
        fs.writeFileSync(workerPath, JSON.stringify({ monthlyGoal: 42, currentAmount: 7, theme: 'modern-list', walletAddress: '' }, null, 2));
      }
    } catch {}

    const pk = fakePublicKey('A');
    const { cookie } = await walletLogin(agent, pk);

    const mod = await agent.get('/api/modules').set('Cookie', cookie);
    expect(mod.status).toBe(200);
    expect(mod.body.tipGoal).toBeTruthy();

    expect(mod.body.tipGoal.monthlyGoal).toBe(42);
    expect(mod.body.tipGoal.currentAmount).toBe(7);
    expect(['modern-list','classic']).toContain(mod.body.tipGoal.theme);
  });
});
