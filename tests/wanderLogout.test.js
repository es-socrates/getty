const request = require('supertest');

describe('wander logout', () => {
  let app; let server; let agent;
  beforeAll((done) => {
    process.env.GETTY_MULTI_TENANT_WALLET = '1';
    process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY = '1';
    jest.resetModules();
    app = require('../server');
    server = app.listen(0, () => { agent = request.agent(app); done(); });
  });
  afterAll((done)=>{ try { server.close(()=>done()); } catch { done(); } });

  it('creates session then logs out', async () => {
    const address = 'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
    const nr = await agent.post('/api/auth/wander/nonce').send({ address });
    expect(nr.status).toBe(200);
    const vr = await agent.post('/api/auth/wander/verify').send({ address, publicKey: 'FAKE_PUBLIC_KEY_BASE64URL', signature: 'TEST' });
    expect(vr.status).toBe(200);
    const me = await agent.get('/api/auth/wander/me');
    expect(me.status).toBe(200);
    expect(me.body.address).toBe(address);
    const lo = await agent.post('/api/auth/wander/logout').send({});
    expect(lo.status).toBe(200);
    const me2 = await agent.get('/api/auth/wander/me');
    expect(me2.status).toBe(401);
  });
});
