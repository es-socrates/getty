const request = require('supertest');

describe('Masking secrets and sensitive fields when GETTY_REQUIRE_SESSION=1', () => {
  let app;
  const OLD_ENV = process.env;

  beforeAll(() => {
    process.env = { ...OLD_ENV, NODE_ENV: 'test', GETTY_REQUIRE_SESSION: '1' };
    jest.resetModules();
    app = require('../server');
  });

  afterAll(() => {
    process.env = OLD_ENV;
    try { app?.disposeGetty?.(); } catch { /* ignore */ }
  });

  test('GET /api/external-notifications hides secrets and lastTips', async () => {
    const res = await request(app).get('/api/external-notifications');
    expect(res.status).toBe(200);
    expect(res.body?.config?.discordWebhook).toBe('');
    expect(res.body?.config?.telegramBotToken).toBe('');
    expect(res.body?.config?.telegramChatId).toBe('');
    expect(Array.isArray(res.body?.lastTips)).toBe(true);
  });

  test('GET /api/socialmedia-config returns empty list when unauthenticated', async () => {
    const res = await request(app).get('/api/socialmedia-config');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.config)).toBe(true);
  });

  test('GET /api/announcement masks messages when unauthenticated', async () => {
    const res = await request(app).get('/api/announcement');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.config?.messages)).toBe(true);
  });

  test('GET /api/raffle/settings strips internals when unauthenticated', async () => {
    const res = await request(app).get('/api/raffle/settings');
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('participants');
    expect(res.body).not.toHaveProperty('previousWinners');
  });

  test('GET /api/obs-ws-config hides password when unauthenticated', async () => {
    const res = await request(app).get('/api/obs-ws-config');
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('password');
  });

  test('GET /api/chat-config hides URLs when unauthenticated', async () => {
    const res = await request(app).get('/api/chat-config');
    expect(res.status).toBe(200);
    expect(typeof res.body.chatUrl === 'string').toBe(true);
    expect(res.body.chatUrl === '' || res.body.chatUrl.startsWith('')).toBe(true);
  });

  test('GET /config/liveviews-config.json masks claimid when unauthenticated', async () => {
    const res = await request(app).get('/config/liveviews-config.json');
    expect(res.status).toBe(200);
    expect(typeof res.body.claimid === 'string').toBe(true);
  });
});
