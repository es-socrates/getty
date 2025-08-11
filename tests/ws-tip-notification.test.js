const WebSocket = require('ws');
const request = require('supertest');
const app = require('../server');

describe('WebSocket tip notification flow', () => {
  let server;
  let address;

  beforeAll(async () => {
    server = await app.startTestServer();
    const port = server.address().port;
    address = `ws://localhost:${port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise(r => server.close(r));
    }
  });

  test('receives init payload and subsequent tip event', async () => {
    const events = [];

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(address);
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for events')), 5000);

      ws.on('message', msg => {
        const parsed = JSON.parse(msg.toString());
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
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });

    const init = events.find(e => e.type === 'init');
    expect(init).toBeDefined();
    expect(init.data).toHaveProperty('tipGoal');
    expect(init.data).toHaveProperty('lastTip');

    const tip = events.find(e => e.type === 'tip');
    expect(tip).toBeDefined();
    expect(tip.data).toMatchObject({ from: 'WSUser', message: 'Hello WS' });
    expect(typeof tip.data.amount).toBe('number');
  });
});
