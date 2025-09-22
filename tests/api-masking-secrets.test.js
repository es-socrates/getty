const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');

describe('Masking secrets and sensitive fields when GETTY_REQUIRE_SESSION=1', () => {
  let app; let restore;
  beforeAll(() => { ({ app, restore } = freshServer({ GETTY_REQUIRE_SESSION: '1' })); });
  afterAll(() => { try { restore && restore(); } catch {} });

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
    const chatUrl = res.body?.chatUrl;
    const odyseeWsUrl = res.body?.odyseeWsUrl;

    if (typeof chatUrl !== 'undefined') {
      expect(typeof chatUrl === 'string').toBe(true);
      expect(!/^wss?:/i.test(chatUrl)).toBe(true);
    }
    if (typeof odyseeWsUrl !== 'undefined') {
      expect(typeof odyseeWsUrl === 'string').toBe(true);
      expect(!/^wss?:/i.test(odyseeWsUrl)).toBe(true);
    }
  });

  test('GET /config/liveviews-config.json masks claimid when unauthenticated', async () => {
    const res = await request(app).get('/config/liveviews-config.json');
    expect(res.status).toBe(200);
    expect(typeof res.body.claimid === 'string').toBe(true);
  });

  test('GET /api/modules masks socialmedia status when unauthenticated', async () => {
    const res = await request(app).get('/api/modules');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('socialmedia');
    expect(res.body.socialmedia.configured).toBe(false);
    expect(res.body.socialmedia.entries).toBe(0);
    expect(res.body.masked).toBe(true);
  });

  test('GET /api/modules masks external notifications for unauthenticated', async () => {
    const res = await request(app).get('/api/modules');
    expect(res.status).toBe(200);
    const ext = res.body.externalNotifications;
    expect(ext.active).toBe(false);
    expect(Array.isArray(ext.lastTips)).toBe(true);
    expect(ext.lastTips.length).toBe(0);
    expect(ext.config.hasDiscord).toBe(false);
    expect(ext.config.hasTelegram).toBe(false);
    expect(ext.config.template).toBe('');
  });

  test('GET /api/modules omits raffle section when unauthenticated', async () => {
    const res = await request(app).get('/api/modules');
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('raffle');
  });
});
