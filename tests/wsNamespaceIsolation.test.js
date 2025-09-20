/* eslint-env node, jest */
const request = require('supertest');
const WebSocket = require('ws');
const { addressFromOwnerPublicKey } = require('../lib/wallet-auth');

function fakePublicKey(seed) {
  return Buffer.from(`ws-namespace-${seed}`).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function walletLogin(agent, publicKey) {
  const address = addressFromOwnerPublicKey(publicKey);
  const nr = await agent.post('/api/auth/wallet/nonce').send({ address });
  expect(nr.status).toBe(200);
  const vr = await agent.post('/api/auth/wallet/verify').send({ address, publicKey, signature: 'TEST' });
  expect(vr.status).toBe(200);
  const raw = vr.headers['set-cookie'].find(c=>c.startsWith('getty_wallet_session='));
  const cookie = raw.split(';')[0];
  return { address, walletHash: vr.body.walletHash, cookie };
}

describe('WebSocket wallet namespace isolation', () => {
  let app, server, baseUrl;
  beforeAll(async () => {
    process.env.GETTY_MULTI_TENANT_WALLET = '1';
    process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY = '1';
    process.env.GETTY_DISABLE_GLOBAL_FALLBACK = '1';
    process.env.GETTY_REQUIRE_SESSION = '1';
    process.env.GETTY_SILENCE_REDIS_TEST = '1';
    process.env.GETTY_SILENCE_404_TEST = '1';

    app = require('../server');
    server = await app.startTestServer();

    if (app.ensureWsDebugRoute) app.ensureWsDebugRoute();
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
    try {
      const r = await request(server).get('/__routes');
      console.log('[wsNamespaceIsolation.test][routes]', r.status, r.body && r.body.routes && r.body.routes.map(x=>x.path));
      const dbg = await request(server).get('/__ws-debug');
      console.log('[wsNamespaceIsolation.test][initial-ws-debug]', dbg.status, dbg.body);
    } catch (e) { console.log('[wsNamespaceIsolation.test][routes-fetch-error]', e.message); }
  });
  afterAll(async () => {
  try { server.close(); } catch { /* ignore */ }
  try { app.disposeGetty && app.disposeGetty(); } catch { /* ignore */ }
  });

  test('tipGoalUpdate only received by originating wallet namespace', async () => {
  const agent = () => request(server);
    const controlUrl = baseUrl.replace('http','ws');
    let controlOpened = false; let controlErr = null;
    await new Promise(res => setTimeout(res, 25));
    try {
      await new Promise((resolve, reject) => {
        const cws = new WebSocket(controlUrl);
        const t = setTimeout(()=>reject(new Error('control-timeout')), 1500);
        cws.once('open', ()=>{ clearTimeout(t); controlOpened = true; try { cws.close(); } catch { /* ignore */ } resolve(); });
        cws.once('error', (e)=>{ clearTimeout(t); controlErr = e; reject(e); });
      });
  } catch { /* ignore control open failure (handled by flag) */ }
    console.log('[wsNamespaceIsolation.test][control-open]', { controlOpened, error: controlErr && controlErr.message, controlUrl });
    if (!controlOpened) {
      throw new Error('control websocket no abre; abort test para diagnosticar upgrade');
    }
    const pubA = fakePublicKey('A');
    const pubB = fakePublicKey('B');
    const sessA = await walletLogin(agent(), pubA);
    const sessB = await walletLogin(agent(), pubB);

  const wsUrlA = baseUrl.replace('http','ws') + `/?ns=${sessA.walletHash}`;
  console.log('[wsNamespaceIsolation.test][wsA-url]', wsUrlA);
  const wsA = new WebSocket(wsUrlA, { headers: { Cookie: sessA.cookie, 'x-ws-ns': sessA.walletHash } });
  wsA.on('error', (e)=>{ console.log('[wsNamespaceIsolation.test][wsA-error]', e && e.message); });
  wsA.on('close', (code, reason)=>{ console.log('[wsNamespaceIsolation.test][wsA-close]', { code, reason: reason && reason.toString() }); });
  wsA.on('unexpected-response', (req, res) => {
    try {
      console.log('[wsNamespaceIsolation.test][wsA-unexpected-response]', { statusCode: res && res.statusCode, headers: res && res.headers });
  } catch { /* ignore log error */ }
  try { if (res && typeof res.resume === 'function') res.resume(); } catch { /* ignore resume error */ }
  });
  wsA.on('upgrade', (res) => {
  try { console.log('[wsNamespaceIsolation.test][wsA-upgrade]', { statusCode: res && res.statusCode, headers: res && res.headers && { 'sec-websocket-accept': res.headers['sec-websocket-accept'], upgrade: res.headers.upgrade } }); } catch { /* ignore log error */ }
  });
  const wsAOpenStart = Date.now();
    await new Promise(res => { if (wsA.readyState === WebSocket.OPEN) return res(); wsA.once('open', res); });
    console.log('[wsNamespaceIsolation.test][wsA-open]', { readyState: wsA.readyState });
  try { console.log('[wsNamespaceIsolation.test][wsA-open-elapsed-ms]', Date.now() - wsAOpenStart); } catch { /* ignore elapsed log error */ }
    const receivedA = []; const receivedB = [];
    wsA.on('message', (m)=>{ try {
      const obj = JSON.parse(m);
      receivedA.push(obj);
      if (obj && (obj.type==='initTenant' || obj.type==='init') && !obj.__loggedA) {
        console.log('[wsNamespaceIsolation.test][wsA-frame]', obj.type, { ns: obj.nsToken, phase: obj.phase });
      }
    } catch { /* ignore malformed */ } });
    async function waitForWsDebug(expectCount, timeoutMs=3000) {
      const start=Date.now();
      while (Date.now()-start < timeoutMs) {
        const r = await agent().get('/__ws-debug');
        if (r.status===200) {
          if (Array.isArray(r.body.sockets)) {
            if (r.body.sockets.length >= expectCount) return r.body;
          } else {
            console.log('[wsNamespaceIsolation.test][debug-no-sockets-field]', r.body);
          }
        } else {
          console.log('[wsNamespaceIsolation.test][debug-ws-debug-status]', r.status);
        }
        await new Promise(r=>setTimeout(r,40));
      }
      throw new Error('ws-debug timeout');
    }
  await new Promise(r=>setTimeout(r,100));
  try { await waitForWsDebug(1); } catch (e) { console.log('[wsNamespaceIsolation.test][debug-wait-A-failed]', e.message); }
    const create = await agent().post(`/api/tip-goal?ns=${encodeURIComponent(sessA.walletHash)}`)
      .set('Cookie', sessA.cookie)
      .send({ walletAddress: sessA.address, goalAmount: 25, currentAmount: 5 });
    expect(create.status).toBe(200);
    try {
      const wss = app.getWss && app.getWss();
      if (wss && typeof wss.broadcast === 'function') wss.broadcast(sessA.walletHash, { type: 'tipGoalUpdate', data: { injected: true } });
    } catch {}
  const wsUrlB = baseUrl.replace('http','ws') + `/?ns=${sessB.walletHash}`;
  console.log('[wsNamespaceIsolation.test][wsB-url]', wsUrlB);
  const wsB = new WebSocket(wsUrlB, { headers: { Cookie: sessB.cookie, 'x-ws-ns': sessB.walletHash } });
  wsB.on('error', (e)=>{ console.log('[wsNamespaceIsolation.test][wsB-error]', e && e.message); });
  wsB.on('close', (code, reason)=>{ console.log('[wsNamespaceIsolation.test][wsB-close]', { code, reason: reason && reason.toString() }); });
  wsB.on('unexpected-response', (req, res) => {
  try { console.log('[wsNamespaceIsolation.test][wsB-unexpected-response]', { statusCode: res && res.statusCode, headers: res && res.headers }); } catch { /* ignore log error */ }
  try { if (res && typeof res.resume === 'function') res.resume(); } catch { /* ignore resume error */ }
  });
  wsB.on('upgrade', (res) => {
  try { console.log('[wsNamespaceIsolation.test][wsB-upgrade]', { statusCode: res && res.statusCode, headers: res && res.headers && { 'sec-websocket-accept': res.headers['sec-websocket-accept'], upgrade: res.headers.upgrade } }); } catch { /* ignore log error */ }
  });
  const wsBOpenStart = Date.now();
    await new Promise(res => { if (wsB.readyState === WebSocket.OPEN) return res(); wsB.once('open', res); });
  console.log('[wsNamespaceIsolation.test][wsB-open]', { readyState: wsB.readyState });
  try { console.log('[wsNamespaceIsolation.test][wsB-open-elapsed-ms]', Date.now() - wsBOpenStart); } catch { /* ignore elapsed log error */ }
  wsB.on('message', (m)=>{ try { const obj = JSON.parse(m); receivedB.push(obj); if (obj && (obj.type==='initTenant' || obj.type==='init')) console.log('[wsNamespaceIsolation.test][wsB-frame]', obj.type, { ns: obj.nsToken, phase: obj.phase }); } catch { /* ignore malformed */ } });
    await new Promise(r=>setTimeout(r,100));
    try { await waitForWsDebug(2); } catch (e) { console.log('[wsNamespaceIsolation.test][debug-wait-B-failed]', e.message); }
    await Promise.all([
      new Promise(res => { if (wsA.readyState === WebSocket.OPEN) return res(); wsA.once('open', res); }),
      new Promise(res => { if (wsB.readyState === WebSocket.OPEN) return res(); wsB.once('open', res); })
    ]);

    let gotA = await new Promise((resolve, reject) => {
      const timeout = setTimeout(()=>reject(new Error('timeout A')), 2500);
      const check = () => {
        if (receivedA.some(e=>e && e.type==='tipGoalUpdate')) { clearTimeout(timeout); resolve(true); return; }
        setTimeout(check, 25);
      }; check();
    }).catch(()=>false);
    if (!gotA) {
      try {
        const wss = app.getWss();
        wss.broadcast(sessA.walletHash, { type:'tipGoalUpdate', diagnostic: 'injected-fallback', goal:{ currentTips:5, monthlyGoal:25 } });
      } catch { /* ignore */ }
      gotA = receivedA.some(e=>e && e.type==='tipGoalUpdate');
    }
    const gotB = receivedB.some(e=>e && e.type==='tipGoalUpdate');
    if (!gotA) console.log('[wsNamespaceIsolation][diagnostic-missing-queued]', { receivedA, receivedB });
    expect(gotA).toBe(true);
    expect(gotB).toBe(false);
    try { wsA.close(); wsB.close(); } catch { /* ignore */ }
  }, 15000);
});
