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

function waitFor(ws, type, timeout = 2500) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting ' + type)), timeout);
    ws.on('message', raw => {
      try {
        const msg = JSON.parse(raw);
        if (msg && msg.type === type) {
          clearTimeout(t);
          resolve(msg);
        }
  } catch { /* ignore */ }
    });
  });
}

describe('Raffle isolation across sessions', () => {
  test('two sessions cannot see each other raffle state or events', async () => {
  const agent1 = request.agent(app);
  const agent2 = request.agent(app);

    const s1 = await newAdminSession(agent1);
    const s2 = await newAdminSession(agent2);

  const sres1 = await agent1.post('/api/raffle/settings').send({ prize: 'Pack A' });
  expect(sres1.status).toBe(200);
  const startRes = await agent1.post('/api/raffle/start');
  expect(startRes.status).toBe(200);

  const state1 = await agent1.get('/api/raffle/state');
  expect(state1.status).toBe(200);
  expect(state1.body).toHaveProperty('active', true);

    // Session 2 should not see session 1 raffle active
  const state2 = await agent2.get('/api/raffle/state');
    expect(state2.status).toBe(200);
    expect(state2.body).toHaveProperty('active');
    expect(state2.body.active).toBe(false);

  const ws1 = await wsConnect(s1.adminToken);
  const ws2 = await wsConnect(s2.adminToken);

  // Ask both sockets for their raffle state
  ws1.send(JSON.stringify({ type: 'get_raffle_state' }));
  await waitFor(ws1, 'raffle_state');

    ws2.send(JSON.stringify({ type: 'get_raffle_state' }));
    const init2 = await waitFor(ws2, 'raffle_state');
    expect(init2.active).toBe(false);

  await agent1.post('/api/raffle/stop');

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
