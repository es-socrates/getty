const request = require('supertest');
const WebSocket = require('ws');
process.env.GETTY_REQUIRE_SESSION = '1';
let app = require('../server');

jest.setTimeout(15000);

async function newAdminSession(agent) {
  const res = await agent.get('/api/session/new?json=1').set('Accept','application/json');
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('adminToken');
  return { adminToken: res.body.adminToken };
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

function wsConnect(token) {
  return new Promise((resolve, reject) => {
    const url = `${wsBase}/?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
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

    const sres1 = await agent1.post('/api/raffle/settings').send({ prize: 'Pack A' });
    expect(sres1.status).toBe(200);
    const startRes = await agent1.post('/api/raffle/start');
    expect(startRes.status).toBe(200);

    const ws1 = await wsConnect(s1.adminToken);
    const ws2 = await wsConnect(s2.adminToken);

  try { ws1.send(JSON.stringify({ type: 'get_raffle_state' })); } catch { /* ignore */ }
  try { ws2.send(JSON.stringify({ type: 'get_raffle_state' })); } catch { /* ignore */ }

    let leakedWinner = false;
    ws2.on('message', raw => {
      try {
        const msg = JSON.parse(raw);
        if (msg && msg.type === 'raffle_winner') leakedWinner = true;
  } catch { /* ignore parse */ }
    });

    const drawRes = await agent1.post('/api/raffle/draw');
    expect([200, 500]).toContain(drawRes.status);

    await new Promise(r => setTimeout(r, 600));
    expect(leakedWinner).toBe(false);

  try { ws1.close(); } catch { /* ignore */ }
  try { ws2.close(); } catch { /* ignore */ }
  });
});
