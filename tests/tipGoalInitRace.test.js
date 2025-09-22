/* eslint-env node, jest */
const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');

describe('TipGoal async init race (hosted)', () => {
  let app; let restore; let server; let agent;

  beforeAll(async () => {
    ({ app, restore } = freshServer({
      GETTY_MULTI_TENANT_WALLET: '1',
      GETTY_WALLET_AUTH_ALLOW_DUMMY: '1',
      GETTY_DISABLE_GLOBAL_FALLBACK: '0',
      GETTY_REQUIRE_SESSION: '1',
      GETTY_SILENCE_REDIS_TEST: '1'
    }));
    if (app.startTestServer) server = await app.startTestServer();
    agent = request(server || app);
  });
  afterAll(done => { try { restore && restore(); } catch {} if (server) server.close(done); else done(); });

  function fakePublicKey(seed) {
    return Buffer.from(`init-race-${seed}`).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  const { addressFromOwnerPublicKey } = require('../lib/wallet-auth');
  async function walletLogin(pk) {
    const address = addressFromOwnerPublicKey(pk);
    const nr = await agent.post('/api/auth/wallet/nonce').send({ address });
    expect(nr.status).toBe(200);
    const vr = await agent.post('/api/auth/wallet/verify').send({ address, publicKey: pk, signature: 'TEST' });
    expect(vr.status).toBe(200);
    const cookie = vr.headers['set-cookie'].find(c=>c.startsWith('getty_wallet_session='));
    expect(cookie).toBeTruthy();
    return { address, cookie: cookie.split(';')[0] };
  }

  test('Module reflects wallet after config post (no stale idle state)', async () => {
    const pk = fakePublicKey('A');
    const { address, cookie } = await walletLogin(pk);

    const pre = await agent.get('/api/tip-goal').set('Cookie', cookie);
    expect([200,404]).toContain(pre.status);

    const create = await agent.post('/api/tip-goal')
      .set('Cookie', cookie)
      .send({ walletAddress: address, goalAmount: 33, currentAmount: 3 });
    expect(create.status).toBe(200);
    expect(create.body.monthlyGoal).toBe(33);

    await new Promise(r => setTimeout(r, 25));

    const after = await agent.get('/api/tip-goal').set('Cookie', cookie);
    expect(after.status).toBe(200);

    expect(after.body.walletAddress).toBe(address);
    expect(after.body.monthlyGoal).toBe(33);

    delete require.cache[require.resolve('../modules/tip-goal')];
    const { TipGoalModule } = require('../modules/tip-goal');
    const { Server } = require('ws');
    const dummyWss = new Server({ noServer: true });
    const fresh = new TipGoalModule(dummyWss);

    await new Promise(r => setTimeout(r, 10));

    expect(typeof fresh.walletAddress).toBe('string');
    if (fresh.walletAddress) {
      expect(fresh.monthlyGoalAR).toBe(33);
      expect(fresh.currentTipsAR).toBe(3);
    }
  });
});
