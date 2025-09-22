const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');

describe('External notifications mask + reveal contract', () => {
  let app; let restore;
  beforeAll(() => { ({ app, restore } = freshServer({ GETTY_REQUIRE_SESSION: '1', GETTY_TENANT_DEBUG: '1', GETTY_REQUIRE_ADMIN_WRITE: '0' })); });
  afterAll(() => { try { restore && restore(); } catch {} });

  const payload = {
    discordWebhook: 'https://discord.com/api/webhooks/abc123/XYZ',
    telegramBotToken: '123456:ABCDEF',
    telegramChatId: '-100987654321',
    liveDiscordWebhook: 'https://discord.com/api/webhooks/live789/LMN',
    liveTelegramBotToken: '999999:LIVEBOT',
    liveTelegramChatId: '-100111222333'
  };

  test('Save secrets then GET hides them but sets flags', async () => {
    const saveRes = await request(app).post('/api/external-notifications').send(payload);
    expect(saveRes.status).toBe(200);
    expect(saveRes.body.success).toBe(true);

    const getRes = await request(app).get('/api/external-notifications');
    expect(getRes.status).toBe(200);
    const cfg = getRes.body.config;

    expect(cfg.discordWebhook).toBe('');
    expect(cfg.telegramBotToken).toBe('');
    expect(cfg.telegramChatId).toBe('');
    expect(cfg.liveDiscordWebhook).toBe('');
    expect(cfg.liveTelegramBotToken).toBe('');
    expect(cfg.liveTelegramChatId).toBe('');
    expect(cfg.hasDiscordWebhook).toBe(true);
    expect(cfg.hasTelegramBotToken).toBe(true);
    expect(cfg.hasTelegramChatId).toBe(true);
    expect(cfg.hasLiveDiscordWebhook).toBe(true);
    expect(cfg.hasLiveTelegramBotToken).toBe(true);
    expect(cfg.hasLiveTelegramChatId).toBe(true);
  });

  const revealFields = [
    'discordWebhook',
    'telegramBotToken',
    'telegramChatId',
    'liveDiscordWebhook',
    'liveTelegramBotToken',
    'liveTelegramChatId'
  ];

  test.each(revealFields)('Reveal endpoint returns real value for %s', async (field) => {
    const res = await request(app).get('/api/external-notifications/reveal').query({ field });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.field).toBe(field);
    expect(res.body.value).toBe(payload[field]);
  });
});
