const request = require('supertest');

describe('Notifications masking under GETTY_REQUIRE_SESSION=1', () => {
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

  test('GET /api/tip-notification-gif hides position when unauthenticated', async () => {
    const res = await request(app).get('/api/tip-notification-gif');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('gifPath');
    expect(res.body).toHaveProperty('width');
    expect(res.body).toHaveProperty('height');
    expect(res.body).not.toHaveProperty('position');
  });

  test('GET /api/goal-audio-settings masks custom audio state when unauthenticated', async () => {
    const res = await request(app).get('/api/goal-audio-settings');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ audioSource: 'remote', hasCustomAudio: false });
  });

  test('GET /api/audio-settings masks custom audio state when unauthenticated', async () => {
    const res = await request(app).get('/api/audio-settings');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ audioSource: 'remote', hasCustomAudio: false });
  });
});
