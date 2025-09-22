const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');
let appRef; let restoreBaseline; let server;
beforeAll(() => { ({ app: appRef, restore: restoreBaseline } = freshServer({ REDIS_URL: null, GETTY_REQUIRE_SESSION: null, GETTY_ENFORCE_OWNER_WRITES: '0', GETTY_REQUIRE_ADMIN_WRITE: '0' })); });
afterAll(() => { try { restoreBaseline && restoreBaseline(); } catch {} });

describe('Tip Goal validation', () => {
  let agent;
  beforeAll(async () => {
    if (appRef.startTestServer) {
      server = await appRef.startTestServer();
      agent = request(server);
    } else {
      agent = request(appRef);
    }
  });
  afterAll(done => { if (server) server.close(done); else done(); });

  it('rejects missing goal amount', async () => {
    const res = await agent
      .post('/api/tip-goal')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('accepts minimal valid payload', async () => {
    const res = await agent
      .post('/api/tip-goal')
      .send({ monthlyGoal: 10 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
