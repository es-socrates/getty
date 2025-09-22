const WebSocket = require('ws');
const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');
let app; let restoreBaseline;

describe('WebSocket tip notification flow', () => {
  let server;
  let address;

  beforeAll(async () => {
    ({ app: app, restore: restoreBaseline } = freshServer({ REDIS_URL: null, GETTY_REQUIRE_SESSION: null }));
    server = await app.startTestServer();
    const port = server.address().port;
    address = `ws://localhost:${port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise(r => server.close(r));
    }
    try { restoreBaseline && restoreBaseline(); } catch {}
  });

  test('receives init payload and subsequent tip event', async () => {
    const events = [];

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(address);
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for events')), 5000);

      ws.on('message', msg => {
        let parsed = null;
        try { parsed = JSON.parse(msg.toString()); } catch { /* ignore malformed */ }
        if (!parsed || typeof parsed !== 'object') return;
        events.push(parsed);

        if (parsed.type === 'init') {
          request(app)
            .post('/api/test-tip')
            .send({ amount: 1.23, from: 'WSUser', message: 'Hello WS' })
            .then(res => {
              if (res.status !== 200) reject(new Error('Failed to send test tip'));
            })
            .catch(reject);
        } else if (parsed.type === 'tip') {
          clearTimeout(timeout);
          try { ws.close(); } catch { /* ignore close error */ }
          resolve();
        }
      });

      ws.on('error', reject);
    });

  const safeEvents = events.filter(e => e && typeof e === 'object');
  const init = safeEvents.find(e => e.type === 'init');
    expect(init).toBeDefined();
    expect(init.data).toHaveProperty('tipGoal');
    expect(init.data).toHaveProperty('lastTip');

  const tip = safeEvents.find(e => e.type === 'tip');
    expect(tip).toBeDefined();
    expect(tip.data).toMatchObject({ from: 'WSUser', message: 'Hello WS' });
    expect(typeof tip.data.amount).toBe('number');
  });
});
