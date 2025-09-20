const request = require('supertest');

describe('wander bad_signature handling', () => {
  let app; let server; let agent;

  beforeAll((done) => {
    process.env.GETTY_MULTI_TENANT_WALLET = '1';
    process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY = '0';
    jest.resetModules();
    app = require('../server');
    server = app.listen(0, () => { agent = request.agent(app); done(); });
  });

  afterAll((done) => { try { server.close(() => done()); } catch { done(); } });

  it('returns 401 bad_signature when signature invalid but publicKey/address pair matches', async () => {
    const crypto = require('crypto');
    const pubBytes = crypto.createHash('sha256').update('test-public-key-seed').digest();
    const pubB64 = pubBytes.toString('base64');
    const publicKey = pubB64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const addrHash = crypto.createHash('sha256').update(pubBytes).digest();
    const address = addrHash.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    expect(address.length).toBeGreaterThanOrEqual(43);

    const nr = await agent.post('/api/auth/wander/nonce').send({ address });
    expect(nr.status).toBe(200);
    expect(nr.body).toHaveProperty('message');

    const badSig = crypto.randomBytes(64).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const vr = await agent.post('/api/auth/wander/verify').send({ address, publicKey, signature: badSig });
    expect(vr.status).toBe(401);
    expect(vr.body).toHaveProperty('error', 'bad_signature');
  });
});
