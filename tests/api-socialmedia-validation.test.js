const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');
let appRef; let restoreBaseline; let server;
beforeAll(async () => { ({ app: appRef, restore: restoreBaseline } = freshServer({ REDIS_URL: null, GETTY_REQUIRE_SESSION: null, GETTY_ENFORCE_OWNER_WRITES: '0', GETTY_REQUIRE_ADMIN_WRITE: '0' })); if (appRef.startTestServer) server = await appRef.startTestServer(); });
afterAll(done => { try { restoreBaseline && restoreBaseline(); } catch {} if (server) server.close(done); else done(); });

describe('SocialMedia config validation', () => {
  it('rejects invalid config payload type', async () => {
  const res = await request(appRef)
      .post('/api/socialmedia-config')
      .send({ config: { platform: 'x' } });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
  });

  it('accepts valid config array', async () => {
  const res = await request(appRef)
      .post('/api/socialmedia-config')
      .send({ config: [{ platform: 'x', enabled: true, url: 'https://odysee.com/you', handle: '@you' }] });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
