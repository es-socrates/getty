/* eslint-env jest */
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { freshServer } = require('./helpers/freshServer');
const { loadTenantConfig } = require('../lib/tenant-config');
const { addressFromOwnerPublicKey } = require('../lib/wallet-auth');

function fakePublicKey(seed) {
  return Buffer.from(`ext-notif-wrapper-${seed}`).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
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

describe('external notifications tenant wrapper persistence', () => {
  let app; let restore; let server;
  beforeAll(async () => {
    ({ app, restore } = freshServer({
      GETTY_MULTI_TENANT_WALLET: '1',
      GETTY_WALLET_AUTH_ALLOW_DUMMY: '1',
      GETTY_REQUIRE_SESSION: '1',
      GETTY_REQUIRE_ADMIN_WRITE: '0',
      GETTY_ENFORCE_OWNER_WRITES: '0',
      GETTY_SILENCE_REDIS_TEST: '1'
    }));
    if (app.startTestServer) server = await app.startTestServer();
  });
  afterAll(done => { try { restore && restore(); } catch {} if (server) server.close(done); else done(); });

  test('POST creates wrapper with meta + data', async () => {
    const agent = () => request(app);
    const pub = fakePublicKey('X');
    const sess = await walletLogin(agent(), pub);

    const r1 = await agent().post('/api/external-notifications')
      .set('Cookie', sess.cookie)
      .send({ template: 'Tip from {from} {amount}' });
    expect(r1.status).toBe(200);
    expect(r1.body.success).toBe(true);

    const tenantFile = path.join(process.cwd(), 'tenant', sess.walletHash, 'config', 'external-notifications-config.json');
    expect(fs.existsSync(tenantFile)).toBe(true);
    const result = await loadTenantConfig({ ns: { admin: sess.walletHash } }, null, tenantFile, 'external-notifications-config.json');
    expect(result.meta).toHaveProperty('__version');
    expect(result.meta).toHaveProperty('checksum');
    expect(result).toHaveProperty('data');
    expect(result.data.template).toBe('Tip from {from} {amount}');

    const r2 = await agent().get('/api/external-notifications').set('Cookie', sess.cookie);
    expect(r2.status).toBe(200);
    expect(r2.body).toHaveProperty('config');
    expect(r2.body.config).toHaveProperty('template');
    expect(typeof r2.body.config.template).toBe('string');
  });
});
