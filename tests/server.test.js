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

  it('GET /api/modules requires widget token by default', async () => {
    const unauth = await request(app).get('/api/modules');
    expect(unauth.status).toBe(401);
    expect(unauth.body).toHaveProperty('error', 'widget_token_required');
  });

  it('GET /api/modules?public=1 returns JSON without secrets', async () => {
    const res = await request(app).get('/api/modules?public=1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('externalNotifications');
    const cfg = res.body.externalNotifications?.config || {};
    expect(cfg).not.toHaveProperty('discordWebhook');
    expect(cfg).not.toHaveProperty('telegramBotToken');
    expect(cfg).not.toHaveProperty('telegramChatId');
  });
});
