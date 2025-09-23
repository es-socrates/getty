const request = require('supertest');
const WebSocket = require('ws');

process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.GETTY_MULTI_TENANT_WALLET = '1';
process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY = '1';
process.env.GETTY_SILENCE_REDIS_TEST = '1';
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
  await new Promise(resolve => setTimeout(resolve, 2000));
});

function waitFor(ws, type) {
  return new Promise((resolve) => {
    ws.on('message', raw => {
      try {
        const msg = JSON.parse(raw);
        if (msg && msg.type === type) {
          resolve(msg);
        }
      } catch {
        // ignore parse errors
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

  const ws1 = new WebSocket(`${wsBase}/?ns=${encodeURIComponent(s1.walletHash)}`, { headers: { 'x-ws-ns': s1.walletHash } });
  const ws2 = new WebSocket(`${wsBase}/?ns=${encodeURIComponent(s2.walletHash)}`, { headers: { 'x-ws-ns': s2.walletHash } });

  const init1Promise = waitFor(ws1, 'init');
  const raffle1Promise = waitFor(ws1, 'raffle_state');
  const init2Promise = waitFor(ws2, 'init');
  const raffle2Promise = waitFor(ws2, 'raffle_state');

  await new Promise((resolve, reject) => {
    let count = 0;
    const check = () => { if (count === 2) resolve(); };
    ws1.once('open', () => { count++; check(); });
    ws2.once('open', () => { count++; check(); });
    ws1.once('error', reject);
    ws2.once('error', reject);
  });

  const [init1, raffle1] = await Promise.all([init1Promise, raffle1Promise]);
  expect(init1.data.raffle.active).toBe(true);
  expect(raffle1.active).toBe(true);

  const [init2, raffle2] = await Promise.all([init2Promise, raffle2Promise]);
  expect(init2.data.raffle.active).toBe(false);
  expect(raffle2.active).toBe(false);
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
