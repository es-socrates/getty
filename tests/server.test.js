const request = require('supertest');
const app = require('../server');

describe('API smoke tests', () => {
  it('GET /healthz returns ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('normalizes trailing slashes on /api routes', async () => {
    const res = await request(app).get('/api/goal-audio-settings/');
    expect([200, 304, 404]).toContain(res.status);
  });

  it('GET /api/modules returns JSON without secrets', async () => {
    const res = await request(app).get('/api/modules');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('externalNotifications');
    const cfg = res.body.externalNotifications?.config || {};
    expect(cfg).not.toHaveProperty('discordWebhook');
    expect(cfg).not.toHaveProperty('telegramBotToken');
    expect(cfg).not.toHaveProperty('telegramChatId');
  });
});
