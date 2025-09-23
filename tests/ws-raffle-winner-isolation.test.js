const request = require('supertest');
const WebSocket = require('ws');
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.GETTY_MULTI_TENANT_WALLET = '1';
process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY = '1';
let app = require('../server');

jest.setTimeout(15000);

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

describe('Raffle winner broadcast isolation (WS)', () => {
  test('drawing in session 1 does not send raffle_winner to session 2', async () => {
  const agent1 = request.agent(app);
  const agent2 = request.agent(app);

  const s1 = await newAdminSession(agent1);
  const s2 = await newAdminSession(agent2);

  const sres1 = await agent1.post(`/api/raffle/settings?ns=${encodeURIComponent(s1.walletHash)}`).send({ prize: 'Pack A' });
  expect(sres1.status).toBe(200);
  const ws1 = await wsConnectNs(s1.walletHash);
  const ws2 = await wsConnectNs(s2.walletHash);
  const startRes = await agent1.post(`/api/raffle/start?ns=${encodeURIComponent(s1.walletHash)}`);
  expect(startRes.status).toBe(200);

  try { ws1.send(JSON.stringify({ type: 'get_raffle_state' })); } catch { /* ignore */ }
  try { ws2.send(JSON.stringify({ type: 'get_raffle_state' })); } catch { /* ignore */ }

    let leakedWinner = false;
    ws2.on('message', raw => {
      try {
        const msg = JSON.parse(raw);
        if (msg && msg.type === 'raffle_winner') {
          leakedWinner = true;
          if (process.env.NODE_ENV==='test') console.warn('[wsRaffleWinnerIsolation][leak-detected]', { msg });
        }
      } catch { /* ignore parse */ }
    });

  const drawRes = await agent1.post(`/api/raffle/draw?ns=${encodeURIComponent(s1.walletHash)}`);
    expect([200, 500]).toContain(drawRes.status);

    await new Promise(r => setTimeout(r, 600));
    expect(leakedWinner).toBe(false);

  try { ws1.close(); } catch { /* ignore */ }
  try { ws2.close(); } catch { /* ignore */ }
  });
});
