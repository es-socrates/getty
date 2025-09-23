const request = require('supertest');

jest.setTimeout(12000);

async function login(baseUrl, address) {
  const agent = request(baseUrl);
  await agent.post('/api/auth/wander/nonce').send({ address });
  const vr = await agent.post('/api/auth/wander/verify').send({ address, publicKey: 'FAKE_PUBLIC_KEY_BASE64URL', signature: 'TEST' });
  const setCookie = vr.headers['set-cookie'] || [];
  const cookieHeader = setCookie.map(c => c.split(';')[0]).join('; ');
  const walletHash = vr.body && vr.body.walletHash ? vr.body.walletHash : null;
  return { cookieHeader, walletHash };
}

describe('OBS WebSocket config isolation', () => {
  let app, server, baseUrl;
  const walletA = 'OBSwaLLetA1111111111111111111111111111111111111111';
  const walletB = 'OBSwaLLetB2222222222222222222222222222222222222222';

  beforeAll(async () => {
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    process.env.GETTY_MULTI_TENANT_WALLET = '1';
    process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY = '1';
    process.env.GETTY_REQUIRE_SESSION = '1';
    process.env.GETTY_DISABLE_GLOBAL_FALLBACK = '1';
    jest.resetModules();
    app = require('../server');
    if (typeof app.startTestServer === 'function') {
      server = await app.startTestServer(0);
    } else {
      server = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)); });
    }
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(done => { try { server.close(()=>done()); } catch { done(); } });

  it('keeps separate configs and hides password when unauthenticated', async () => {
    const { cookieHeader: cookieA } = await login(baseUrl, walletA);
    const { cookieHeader: cookieB } = await login(baseUrl, walletB);

    let r = await request(baseUrl).post('/api/obs-ws-config').set('Cookie', cookieA).send({ ip: '10.0.0.5', port: '4455', password: 'secretA' });
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('success', true);

    r = await request(baseUrl).post('/api/obs-ws-config').set('Cookie', cookieB).send({ ip: '192.168.1.9', port: '4456', password: 'secretB' });
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('success', true);

    let ra = await request(baseUrl).get('/api/obs-ws-config').set('Cookie', cookieA);
    expect(ra.status).toBe(200);
    expect(ra.body).toMatchObject({ ip: '10.0.0.5', port: '4455', password: 'secretA' });

    let rb = await request(baseUrl).get('/api/obs-ws-config').set('Cookie', cookieB);
    expect(rb.status).toBe(200);
    expect(rb.body).toMatchObject({ ip: '192.168.1.9', port: '4456', password: 'secretB' });

    const ru = await request(baseUrl).get('/api/obs-ws-config');
    expect(ru.status).toBe(200);
    expect(ru.body).toMatchObject({ ip: '', port: '', password: '' });
  });
});
