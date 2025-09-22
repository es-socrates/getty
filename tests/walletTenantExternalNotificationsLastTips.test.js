const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');
const { addressFromOwnerPublicKey } = require('../lib/wallet-auth');

function fakePublicKey(seed) {
  return Buffer.from(`ext-notif-lastTips-${seed}`).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function walletLogin(agent, publicKey) {
  const address = addressFromOwnerPublicKey(publicKey);
  const nr = await agent.post('/api/auth/wallet/nonce').send({ address });
  expect(nr.status).toBe(200);
  const vr = await agent.post('/api/auth/wallet/verify').send({ address, publicKey, signature: 'TEST' });
  expect(vr.status).toBe(200);
  const raw = vr.headers['set-cookie'].find(c=>c.startsWith('getty_wallet_session='));
  expect(raw).toBeTruthy();
  const cookie = raw.split(';')[0];
  return { address, walletHash: vr.body.walletHash, cookie };
}

describe('Tenant external-notifications lastTips persistence', () => {
  let app; let restoreHosted; let server;
  beforeAll(async () => {
    ({ app, restore: restoreHosted } = freshServer({
      GETTY_MULTI_TENANT_WALLET: '1',
      GETTY_WALLET_AUTH_ALLOW_DUMMY: '1',
      GETTY_REQUIRE_SESSION: '1',
      GETTY_ENFORCE_OWNER_WRITES: '0',
      GETTY_REQUIRE_ADMIN_WRITE: '0',
      GETTY_SILENCE_REDIS_TEST: '1'
    }));
    if (app.startTestServer) server = await app.startTestServer();
  });
  afterAll(done => { try { restoreHosted && restoreHosted(); } catch {} if (server) server.close(done); else done(); });

  test('Per-tenant lastTips capture and isolation', async () => {
    const agent = () => request(app);
    const pubA = fakePublicKey('A');
    const pubB = fakePublicKey('B');
    const sessA = await walletLogin(agent(), pubA);

  const initA = await agent().get('/api/external-notifications').set('Cookie', sessA.cookie);
  expect(initA.status).toBe(200);
  expect(Array.isArray(initA.body.lastTips)).toBe(true);

    const createCfg = await agent().post('/api/external-notifications')
      .set('Cookie', sessA.cookie)
      .send({ template: 'New tip {from} {amount}' });
    expect(createCfg.status).toBe(200);

    const tipAmount = 1.234567;
    const tipFrom = 'TenantAUser';
    const tipMsg = 'Hello from A';
    const sendTip = await agent().post('/api/test-tip').set('Cookie', sessA.cookie).send({ amount: tipAmount, from: tipFrom, message: tipMsg });
    expect(sendTip.status).toBe(200);

    let afterA; let attempts = 0;
    while (attempts < 12) {
      afterA = await agent().get('/api/external-notifications').set('Cookie', sessA.cookie);
      if (afterA.body && Array.isArray(afterA.body.lastTips) && afterA.body.lastTips.length === 1) break;
      await new Promise(r => setTimeout(r, 60));
      attempts++;
    }
    expect(afterA.status).toBe(200);
    expect(Array.isArray(afterA.body.lastTips)).toBe(true);
    expect(afterA.body.lastTips.length).toBeGreaterThanOrEqual(1);
    const tip0 = afterA.body.lastTips[0];
    expect(tip0.from).toBe(tipFrom);
    expect(tip0.message).toBe(tipMsg);
    expect(typeof tip0.amount).toBe('number');
    expect(tip0.amount).toBeCloseTo(tipAmount, 6);

  const sessB = await walletLogin(agent(), pubB);

  await agent().post('/api/external-notifications').set('Cookie', sessB.cookie).send({ template: 'B template' });
  const viewB = await agent().get('/api/external-notifications').set('Cookie', sessB.cookie);
  expect(viewB.status).toBe(200);
  expect(Array.isArray(viewB.body.lastTips)).toBe(true);
  expect(viewB.body.lastTips.length).toBe(0);
  });
});
