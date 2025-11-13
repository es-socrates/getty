const request = require('supertest');

describe('wander auth domain cookie', () => {
  let app;
  let server;

  beforeAll((done) => {
    process.env.REDIS_URL = '';
    process.env.GETTY_MULTI_TENANT_WALLET = '1';
    process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY = '1';
    process.env.GETTY_SESSION_COOKIE_DOMAIN = 'example.com';
    jest.resetModules();
    app = require('../server');
    server = app.listen(0, () => {
      done();
    });
  });

  afterAll((done) => {
    try {
      server.close(() => done());
    } catch (e) {
      done();
    }
  });

  it('sets cookie accessible across subdomains', async () => {
    const address = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBB';
    const host = 'admin.example.com';
    const agent = request.agent(server);

    const nonceRes = await agent
      .post('/api/auth/wander/nonce')
      .set('Host', host)
      .send({ address });
    expect(nonceRes.status).toBe(200);

    const verifyRes = await agent
      .post('/api/auth/wander/verify')
      .set('Host', host)
      .send({ address, publicKey: 'FAKE_PUBLIC_KEY_BASE64URL', signature: 'TEST' });
    expect(verifyRes.status).toBe(200);

    const meRes = await agent.get('/api/auth/wander/me').set('Host', host);
    expect(meRes.status).toBe(200);
    expect(meRes.body.address).toBe(address);
  });
});
