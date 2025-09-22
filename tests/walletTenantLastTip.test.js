const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { freshServer } = require('./helpers/freshServer');
let appRef; let restoreHosted; let server;
({ app: appRef, restore: restoreHosted } = freshServer({
  GETTY_MULTI_TENANT_WALLET: '1',
  GETTY_WALLET_AUTH_ALLOW_DUMMY: '1',
  GETTY_ENFORCE_OWNER_WRITES: '0',
  GETTY_REQUIRE_ADMIN_WRITE: '0'
}));
beforeAll(async () => { if (appRef.startTestServer) server = await appRef.startTestServer(); });
afterAll(done => { try { restoreHosted && restoreHosted(); } catch {} if (server) server.close(done); else done(); });
const { addressFromOwnerPublicKey } = require('../lib/wallet-auth');

function fakePublicKey() {
  return Buffer.from('test-public-key-1234567890').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

describe('Wallet multi-tenant last-tip integration', () => {
  const pubKey = fakePublicKey();
  const address = addressFromOwnerPublicKey(pubKey);
  const tenantDir = () => path.join(process.cwd(), 'tenant', require('../lib/wallet-auth').deriveWalletHash(address));
  const tenantConfigFile = () => path.join(tenantDir(), 'config', 'last-tip-config.json');

  it('performs nonce -> verify -> create tenant config -> read back without exposing global file', async () => {
  const nonceResp = await request(appRef)
      .post('/api/auth/wallet/nonce')
      .send({ address })
      .expect(200);
    expect(nonceResp.body.nonce).toBeTruthy();

  const verifyResp = await request(appRef)
      .post('/api/auth/wallet/verify')
      .send({ address, publicKey: pubKey, signature: 'TEST' })
      .expect(200);
    expect(verifyResp.body.success).toBe(true);
    const cookie = verifyResp.headers['set-cookie'].find(c=>c.startsWith('getty_wallet_session='));
    expect(cookie).toBeTruthy();

  const cfgResp = await request(appRef)
      .post('/api/last-tip')
      .set('Cookie', cookie)
      .send({ walletAddress: address, title: 'Tenant LT Title' })
      .expect(200);
    expect(cfgResp.body.success).toBe(true);
    expect(cfgResp.body.title).toBe('Tenant LT Title');
    expect(cfgResp.body.walletAddress).toBe(address);

    expect(fs.existsSync(tenantConfigFile())).toBe(true);

  const getResp = await request(appRef)
      .get('/api/last-tip')
      .set('Cookie', cookie)
      .expect(200);
    expect(getResp.body.success).toBe(true);
    expect(getResp.body.title).toBe('Tenant LT Title');
    expect(getResp.body.walletAddress).toBe(address);
  });
});
