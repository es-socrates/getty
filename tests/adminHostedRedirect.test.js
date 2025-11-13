const request = require('supertest');

jest.setTimeout(10000);

describe('hosted admin guard respects wallet session', () => {
  let app;
  let server;

  beforeAll((done) => {
    process.env.REDIS_URL = '';
    process.env.GETTY_MULTI_TENANT_WALLET = '1';
    process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY = '1';
    process.env.GETTY_ADMIN_REQUIRE_AUTH = '1';
    jest.resetModules();
    app = require('../server');
    server = app.listen(0, () => {
      done();
    });
  });

  afterAll((done) => {
    if (server) {
      server.close(() => done());
    } else {
      done();
    }
  });

  it('serves /admin without redirect after wallet verify', async () => {
    const agent = request.agent(server);
    const address = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBB';
    const host = 'app.example.com';

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

    const adminRes = await agent.get('/admin/').set('Host', host).redirects(0);
    expect(adminRes.status).toBe(200);
    expect(adminRes.headers.location).toBeUndefined();
    expect(adminRes.text).toContain('<!DOCTYPE');
  });
});
