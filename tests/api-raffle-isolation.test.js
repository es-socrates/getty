const request = require('supertest');
const WebSocket = require('ws');
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.GETTY_MULTI_TENANT_WALLET = '1';
process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY = '1';
let app = require('../server');

jest.setTimeout(30000);

const crypto = require('crypto');
const { addressFromOwnerPublicKey } = require('../lib/wallet-auth');
async function newAdminSession(agent) {
  const pubBuf = crypto.randomBytes(512);
  const publicKey = pubBuf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const address = addressFromOwnerPublicKey(publicKey);
  const nonceRes = await agent.post('/api/auth/wallet/nonce').send({ address });
  expect(nonceRes.status).toBe(200);
  const verifyRes = await agent.post('/api/auth/wallet/verify').send({ address, publicKey, signature: 'TEST' });
  expect(verifyRes.status).toBe(200);
  return { address, publicKey, walletHash: verifyRes.body.walletHash };
}

let server;
let wsBase;
beforeAll(async () => {
  server = await app.startTestServer(0);
  wsBase = `ws://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  try { if (app && typeof app.disposeGetty === 'function') app.disposeGetty(); } catch { /* ignore dispose error */ }
  if (server) await new Promise(r => server.close(r));
});

function wsConnectNs(ns) {
  return new Promise((resolve, reject) => {
    const url = `${wsBase}/?ns=${encodeURIComponent(ns)}`;
    const ws = new WebSocket(url, { headers: { 'x-ws-ns': ns } });
    ws.once('open', () => resolve(ws));
    ws.once('error', err => reject(err));
  });
}

function waitFor(ws, type) {
  return new Promise((resolve) => {
    ws.on('message', raw => {
      console.warn('[waitFor] received message:', raw);
      try {
        const msg = JSON.parse(raw);
        console.warn('[waitFor] parsed message:', msg);
        if (msg && msg.type === type) {
          resolve(msg);
        }
      } catch (e) {
        console.warn('[waitFor] parse error:', e);
      }
    });
  });
}

describe('Raffle isolation across sessions', () => {
  test('two sessions cannot see each other raffle state or events', async () => {
  const agent1 = request.agent(app);
  const agent2 = request.agent(app);
  const s1 = await newAdminSession(agent1);
  const s2 = await newAdminSession(agent2);

  const sres1 = await agent1.post(`/api/raffle/settings?ns=${encodeURIComponent(s1.walletHash)}`).send({ prize: 'Pack A' });
  expect(sres1.status).toBe(200);
  const startRes = await agent1.post(`/api/raffle/start?ns=${encodeURIComponent(s1.walletHash)}`);
  expect(startRes.status).toBe(200);

  const state1 = await agent1.get(`/api/raffle/state?ns=${encodeURIComponent(s1.walletHash)}`);
  expect(state1.status).toBe(200);
  expect(state1.body).toHaveProperty('active', true);

  const state2 = await agent2.get(`/api/raffle/state?ns=${encodeURIComponent(s2.walletHash)}`);
    expect(state2.status).toBe(200);
    expect(state2.body).toHaveProperty('active');
    expect(state2.body.active).toBe(false);

  const ws1 = await wsConnectNs(s1.walletHash);
  const ws2 = await wsConnectNs(s2.walletHash);

  const [init1, raffle1] = await Promise.all([
    waitFor(ws1, 'init'),
    waitFor(ws1, 'raffle_state')
  ]);
  expect(init1.data.raffle.active).toBe(true);
  expect(raffle1.active).toBe(true);

  const [init2, raffle2] = await Promise.all([
    waitFor(ws2, 'init'),
    waitFor(ws2, 'raffle_state')
  ]);
  expect(init2.data.raffle.active).toBe(false);
  expect(raffle2.active).toBe(false);

  await agent1.post(`/api/raffle/stop?ns=${encodeURIComponent(s1.walletHash)}`);

    let leaked = false;
  const guard = new Promise((resolve) => setTimeout(resolve, 600));
    ws2.on('message', raw => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'raffle_state' && msg.active === true) leaked = true;
  } catch { /* ignore */ }
    });
    await guard;
    expect(leaked).toBe(false);

  try { ws1.close(); } catch { /* ignore */ }
  try { ws2.close(); } catch { /* ignore */ }

  });
});
