const request = require('supertest');
let WebSocket;

jest.setTimeout(15000);

function waitForMessage(ws, predicate, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for frame')), timeoutMs);
    ws.on('message', (raw) => {
      try {
        const txt = raw.toString();
        const msg = JSON.parse(txt);
        // eslint-disable-next-line no-console
        console.log('[ws-debug][frame]', msg.type, Object.keys(msg || {}));
        if (predicate(msg)) { clearTimeout(timer); resolve(msg); }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('[ws-debug][frame] parse error:', e.message, 'raw:', raw.toString());
      }
    });
    ws.on('error', e => { clearTimeout(timer); reject(e); });
  });
}

describe('wallet tip-notification isolation', () => {
  let app, server, baseUrl, port;
  beforeAll(async () => {
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    process.env.GETTY_MULTI_TENANT_WALLET = '1';
    process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY = '1';
    process.env.GETTY_REQUIRE_SESSION = '1';
    process.env.GETTY_DISABLE_GLOBAL_FALLBACK = '1';
    jest.resetModules();
    app = require('../server');

    WebSocket = require('ws');
    if (typeof app.startTestServer === 'function') {
      server = await app.startTestServer(0);
    } else {
      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
    }
    const addr = server.address();
    port = addr.port;
    baseUrl = `http://127.0.0.1:${port}`;
  });
  afterAll((done) => { try { server.close(()=>done()); } catch { done(); } });

  const walletA = 'Q1lJkYQyJbVv8mPcXh0G3J9Qp7eUx4lB9yKJt1J0vR1';
  const walletB = 'R2d8mBbLqW3R5nS0dKpQ7yVhTt9eFx2aCc4MmNnPpS2';


  it('wallet A synthetic tipNotification not delivered to wallet B', async () => {

    function parseSetCookie(setCookie) {
      const jar = {}; (setCookie || []).forEach(sc => { try { const [pair] = sc.split(';'); const idx = pair.indexOf('='); if (idx > -1) { const k = pair.slice(0, idx).trim(); const v = pair.slice(idx + 1).trim(); jar[k] = v; } } catch {} }); return jar;
    }
    function jarToHeader(jar) { return Object.entries(jar).map(([k,v]) => `${k}=${v}`).join('; '); }
    async function post(path, body, jar) {
      const req = request(baseUrl).post(path).send(body).set('Accept','application/json');
      if (jar.cookieHeader) req.set('Cookie', jar.cookieHeader);
      const resp = await req;
      const setCookie = resp.headers['set-cookie'] || [];
      if (setCookie.length) {
        const parsed = parseSetCookie(setCookie);
        jar.cookies = { ...(jar.cookies||{}), ...parsed };
        jar.cookieHeader = jarToHeader(jar.cookies);
      }
      return resp;
    }
    async function loginViaBase(address) {
      const jar = { cookies: {}, cookieHeader: '' };
      const nr = await post('/api/auth/wander/nonce', { address }, jar);
      expect(nr.status).toBe(200);
      const vr = await post('/api/auth/wander/verify', { address, publicKey: 'FAKE_PUBLIC_KEY_BASE64URL', signature: 'TEST' }, jar);
      expect(vr.status).toBe(200);
      const walletHash = vr.body && vr.body.walletHash ? vr.body.walletHash : null;
      return { jar, walletHash };
    }

    const { jar: jarA, walletHash: hashA } = await loginViaBase(walletA);
    const { jar: jarB, walletHash: hashB } = await loginViaBase(walletB);

    expect(hashA).toBeTruthy();
    expect(hashB).toBeTruthy();
    expect(hashA).not.toBe(hashB);

  const wsA = new WebSocket(baseUrl.replace('http','ws') + `/?ns=${hashA}`, { headers: { Cookie: jarA.cookieHeader } });
  const wsB = new WebSocket(baseUrl.replace('http','ws') + `/?ns=${hashB}`, { headers: { Cookie: jarB.cookieHeader } });

  wsA.on('open', () => { try { console.warn('[wsA][event] open'); } catch {} });
  wsB.on('open', () => { try { console.warn('[wsB][event] open'); } catch {} });
  wsA.on('close', (code,reason) => { try { console.warn('[wsA][event] close', { code, reason: reason && reason.toString() }); } catch {} });
  wsB.on('close', (code,reason) => { try { console.warn('[wsB][event] close', { code, reason: reason && reason.toString() }); } catch {} });
  wsA.on('error', (err) => { try { console.warn('[wsA][event] error', err?.message); } catch {} });
  wsB.on('error', (err) => { try { console.warn('[wsB][event] error', err?.message); } catch {} });

    await Promise.all([
      new Promise((r,rej)=>{ wsA.on('open', r); wsA.on('error', rej); }),
      new Promise((r,rej)=>{ wsB.on('open', r); wsB.on('error', rej); })
    ]);

    const deadline = Date.now() + 1000;
    let registered = 0; let lastDbg = null;
    while (Date.now() < deadline) {
      try {
        const dbg = await request(baseUrl).get('/__ws-debug');
        lastDbg = dbg.body;
        registered = (dbg.body && Array.isArray(dbg.body.sockets)) ? dbg.body.sockets.length : 0;
        if (registered >= 2) break;
      } catch {}
      await new Promise(r=>setTimeout(r,50));
    }
    // eslint-disable-next-line no-console
    console.log('[test-debug] ws-debug-after-open', { registered, lastDbg });

    const framePromise = waitForMessage(wsA, m => m.type === 'tipNotification', 6000);

    // eslint-disable-next-line no-console
    console.log('[test-debug] wallet hashes', { hashA, hashB });

    const tipResp = await request(baseUrl).post('/api/test-tip').set('Cookie', jarA.cookieHeader).send({ amountAr: 1.234567, from: 'TesterA', message: 'Hi A' });
    expect(tipResp.status).toBe(200);
    expect(tipResp.body).toHaveProperty('success', true);

    try {
      const dbg = await request(baseUrl).get('/__ws-debug');
      // eslint-disable-next-line no-console
      console.log('[test-debug] ws-debug-post-tip', dbg.body);
    } catch { /* ignore */ }

    const frameA = await framePromise;
    expect(frameA.type).toBe('tipNotification');
    expect(frameA.data.from).toBe('TesterA');

    let bReceived = null;
    try {
      bReceived = await waitForMessage(wsB, m => m.type === 'tipNotification', 1500);
    } catch {
      // expected timeout
    }
    expect(bReceived).toBeNull();

    wsA.close(); wsB.close();
  });
});
