const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');
let appRef; let restoreBaseline; let server;
beforeAll(async () => { ({ app: appRef, restore: restoreBaseline } = freshServer({ REDIS_URL: null, GETTY_REQUIRE_SESSION: null, GETTY_ENFORCE_OWNER_WRITES: '0', GETTY_REQUIRE_ADMIN_WRITE: '0' })); if (appRef.startTestServer) server = await appRef.startTestServer(); });
afterAll(done => { try { restoreBaseline && restoreBaseline(); } catch {} if (server) server.close(done); else done(); });

describe('Raffle settings validation', () => {
  it('rejects invalid payload (missing prize)', async () => {
  const res = await request(appRef)
      .post('/api/raffle/settings')
      .send({ duration: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
  });

  it('accepts minimal valid payload', async () => {
  const res = await request(appRef)
      .post('/api/raffle/settings')
      .send({ prize: 'Sticker Pack' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
