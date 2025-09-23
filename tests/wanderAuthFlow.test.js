const request = require('supertest');
const WebSocket = require('ws');

describe('wander auth flow', () => {
  let app;
  let server;
  beforeAll((done) => {
    process.env.REDIS_URL = '';
    process.env.GETTY_MULTI_TENANT_WALLET = '1';
    process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY = '1';
    jest.resetModules();
    app = require('../server');
    server = app.listen(0, () => {
      app.set('serverInstance', server);
      done();
    });
  });
  afterAll((done)=>{ try { server.close(()=>done()); } catch { done(); } });

  it('performs nonce -> verify -> me and websocket connect', async () => {
    const agent = request.agent(app);
    const address = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBB';

    const nr = await agent.post('/api/auth/wander/nonce').send({ address });
    expect(nr.status).toBe(200);
    expect(nr.body.nonce).toBeTruthy();
  const vr = await agent.post('/api/auth/wander/verify').send({ address, publicKey: 'FAKE_PUBLIC_KEY_BASE64URL', signature: 'TEST' });
    expect(vr.status).toBe(200);
    expect(vr.body.success).toBe(true);
    const me = await agent.get('/api/auth/wander/me');
    expect(me.status).toBe(200);
    expect(me.body.address).toBe(address);
    expect(me.body.walletHash).toHaveLength(16);

  const _server = app.get('serverInstance');
  const addr = _server && _server.address ? _server.address() : { port: process.env.PORT || 3000 };
    const port = addr.port || process.env.PORT || 3000;
    const wsUrl = `ws://127.0.0.1:${port}`;
    await new Promise((resolve, reject) => {
      const jar = agent.jar.getCookieStringSync ? agent.jar.getCookieStringSync(wsUrl.replace('ws','http')) : '';
      const headers = jar ? { Cookie: jar } : {};
      const ws = new WebSocket(wsUrl, { headers });
      const timer = setTimeout(()=>reject(new Error('timeout')), 5000);
      ws.on('open', () => { clearTimeout(timer); ws.close(); resolve(); });
      ws.on('error', (e)=>{ clearTimeout(timer); reject(e); });
    });
  });
});
