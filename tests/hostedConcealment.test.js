const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');

describe('Hosted concealment (masking) behavior', () => {
  let app; let restore;
  beforeAll(() => { ({ app, restore } = freshServer({ REDIS_URL: 'redis://localhost:6379', GETTY_REQUIRE_SESSION: '1', GETTY_STRICT_LOCAL_ADMIN: '1' })); });
  afterAll(() => { try { restore && restore(); } catch {} });

  test('Chat config concealed without namespace', async () => {
    const res = await request(app).get('/api/chat-config');
    expect(res.status).toBe(200);
    expect(res.body.chatUrl).toBe('');
  });

  test('Social media config concealed without namespace', async () => {
    const res = await request(app).get('/api/socialmedia-config');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.config)).toBe(true);
    expect(res.body.config.length).toBe(0);
  });

  test('GIF config concealed without namespace', async () => {
    const res = await request(app).get('/api/tip-notification-gif');
    expect(res.status).toBe(200);
    expect(res.body.gifPath).toBe('');
  });
});
