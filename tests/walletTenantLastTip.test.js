const request = require('supertest');
const fs = require('fs');
const path = require('path');

process.env.GETTY_MULTI_TENANT_WALLET = '1';
process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY = '1';
process.env.GETTY_ENFORCE_OWNER_WRITES = '0';
process.env.GETTY_REQUIRE_ADMIN_WRITE = '0';

const app = require('../server');
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
    const nonceResp = await request(app)
      .post('/api/auth/wallet/nonce')
      .send({ address })
      .expect(200);
    expect(nonceResp.body.nonce).toBeTruthy();

    const verifyResp = await request(app)
      .post('/api/auth/wallet/verify')
      .send({ address, publicKey: pubKey, signature: 'TEST' })
      .expect(200);
    expect(verifyResp.body.success).toBe(true);
    const cookie = verifyResp.headers['set-cookie'].find(c=>c.startsWith('getty_wallet_session='));
    expect(cookie).toBeTruthy();

    const cfgResp = await request(app)
      .post('/api/last-tip')
      .set('Cookie', cookie)
      .send({ walletAddress: address, title: 'Tenant LT Title' })
      .expect(200);
    expect(cfgResp.body.success).toBe(true);
    expect(cfgResp.body.title).toBe('Tenant LT Title');
    expect(cfgResp.body.walletAddress).toBe(address);

    expect(fs.existsSync(tenantConfigFile())).toBe(true);

    const getResp = await request(app)
      .get('/api/last-tip')
      .set('Cookie', cookie)
      .expect(200);
    expect(getResp.body.success).toBe(true);
    expect(getResp.body.title).toBe('Tenant LT Title');
    expect(getResp.body.walletAddress).toBe(address);
  });
});
