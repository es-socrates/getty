const request = require('supertest');

describe('wander session stale flow', () => {
  let app; let server; let agent;

  beforeAll((done) => {
    process.env.GETTY_MULTI_TENANT_WALLET = '1';
    process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY = '1';
    process.env.GETTY_WALLET_SESSION_SECRET = 'initial_secret_for_test';
    jest.resetModules();
    app = require('../server');
    server = app.listen(0, () => { agent = request.agent(app); done(); });
  });

  afterAll((done) => { try { server.close(() => done()); } catch { done(); } });

  it('marks session invalid after secret rotation (simulated)', async () => {
    const address = 'STAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALEXX';

    const nr = await agent.post('/api/auth/wander/nonce').send({ address });
    expect(nr.status).toBe(200);

    const vr = await agent.post('/api/auth/wander/verify').send({ address, publicKey: 'FAKE_PUBLIC_KEY_BASE64URL', signature: 'TEST' });
    expect(vr.status).toBe(200);

    const meOk = await agent.get('/api/auth/wander/me');
    expect(meOk.status).toBe(200);
    expect(meOk.body.address).toBe(address);

    const baseUrl = 'http://127.0.0.1';
    let cookieStr = '';
    try {
      if (agent.jar.getCookieStringSync) cookieStr = agent.jar.getCookieStringSync(baseUrl);
      else if (agent.jar.getCookieString) cookieStr = await new Promise(r=>agent.jar.getCookieString(baseUrl, (_,c)=>r(c||'')));
    } catch {}
    const mutated = cookieStr.replace(/getty_wallet_session=([^;]+)/, (m, v) => {
      if (!v) return m;

      const bad = v.slice(0,-1) + (v.slice(-1) === 'A' ? 'B' : 'A');
      return `getty_wallet_session=${bad}`;
    });
    const meStale = await request(app).get('/api/auth/wander/me').set('Cookie', mutated || 'getty_wallet_session=bogus');
    expect([401, 400]).toContain(meStale.status);
    if (meStale.status === 401) {
      expect(meStale.body.error).toBeDefined();
    }
  });
});
