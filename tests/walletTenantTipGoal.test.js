/* eslint-env node, jest */
/* global beforeEach */
const request = require('supertest');
const fs = require('fs');
const path = require('path');

const { addressFromOwnerPublicKey } = require('../lib/wallet-auth');

function fakePublicKey(seed) {
  return Buffer.from(`tip-goal-test-${seed}`).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
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
  const me = await agent.get('/api/auth/wallet/me').set('Cookie', cookie);
  expect(me.status).toBe(200);
  return { address, walletHash: vr.body.walletHash, cookie };
}

describe('Tenant tip-goal isolation', () => {
  let app;
  let pubA, pubB, addressA;

  const agentFactory = () => request(app);

  beforeAll(() => {
    process.env.GETTY_MULTI_TENANT_WALLET = '1';
    process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY = '1';
    process.env.GETTY_DISABLE_GLOBAL_FALLBACK = '1';
    process.env.GETTY_REQUIRE_SESSION = '1';
    process.env.GETTY_SILENCE_REDIS_TEST = '1';
    jest.resetModules();
    app = require('../server');
  });

  beforeEach(() => {
    pubA = fakePublicKey('A');
    pubB = fakePublicKey('B');
    addressA = addressFromOwnerPublicKey(pubA);
    const cfgDir = process.env.GETTY_CONFIG_DIR || path.join(process.cwd(),'config');
  try { fs.unlinkSync(path.join(cfgDir,'tip-goal-config.json')); } catch { /* ignore */ }
    try {
      const walletHashA = require('../lib/wallet-auth').deriveWalletHash(addressA);
      const tenantFile = path.join(process.cwd(),'tenant', walletHashA, 'config', 'tip-goal-config.json');
      fs.unlinkSync(tenantFile);
  } catch { /* ignore */ }
  });

  test('GET returns 404 before tenant creates config (no fallback)', async () => {
    const sessA = await walletLogin(agentFactory(), pubA);
    const r = await agentFactory().get('/api/tip-goal').set('Cookie', sessA.cookie);
    expect(r.status).toBe(404);
  });

  test('Tenant A creates tip-goal; Tenant B cannot see it', async () => {
    const sessA = await walletLogin(agentFactory(), pubA);
    const create = await agentFactory().post('/api/tip-goal')
      .set('Cookie', sessA.cookie)
      .send({ walletAddress: addressA, goalAmount: 100, currentAmount: 10, theme: 'classic' });
    expect(create.status).toBe(200);
    expect(create.body.monthlyGoal).toBe(100);

  const getA = await agentFactory().get('/api/tip-goal').set('Cookie', sessA.cookie);
    expect(getA.status).toBe(200);
    expect(getA.body.monthlyGoal).toBe(100);

    const sessB = await walletLogin(agentFactory(), pubB);
    const getB = await agentFactory().get('/api/tip-goal').set('Cookie', sessB.cookie);
    expect(getB.status).toBe(404);
  });

  test('Wallet propagation to last-tip config on tip-goal create', async () => {
    const sessA = await walletLogin(agentFactory(), pubA);
    const create = await agentFactory().post('/api/tip-goal')
      .set('Cookie', sessA.cookie)
      .send({ walletAddress: addressA, goalAmount: 55, currentAmount: 5 });
    expect(create.status).toBe(200);
    const lastTip = await agentFactory().get('/api/last-tip').set('Cookie', sessA.cookie);
    expect(lastTip.status).toBe(200);
    expect(lastTip.body.walletAddress).toBe(addressA);
  });
});
