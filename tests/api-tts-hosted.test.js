const express = require('express');
const request = require('supertest');

process.env.NODE_ENV = 'test';

const registerTtsRoutes = require('../routes/tts');

function makeAppHosted() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const store = {
    redis: {},
    async get() { return null; },
    async set() { return true; }
  };

  const limiter = (_req, _res, next) => next();
  const wss = { broadcast: () => {}, clients: new Set() };

  process.env.REDIS_URL = 'redis://example.com:6379';

  app.use((req, _res, next) => { req.ns = { admin: null, pub: null }; next(); });

  registerTtsRoutes(app, wss, limiter, { store });
  return app;
}

describe('Hosted TTS masking and 401', () => {
  let app;
  beforeAll(() => {
    app = makeAppHosted();
  });

  test('GET /api/tts-setting returns defaults when anonymous in hosted', async () => {
    const res = await request(app).get('/api/tts-setting');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ttsEnabled: true, ttsAllChat: false });
  });

  test('GET /api/tts-language returns default when anonymous in hosted', async () => {
    const res = await request(app).get('/api/tts-language');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ttsLanguage: 'en' });
  });

  test('POST /api/tts-setting returns 401 session_required when anonymous in hosted', async () => {
    const res = await request(app).post('/api/tts-setting').send({ ttsEnabled: false });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'session_required');
  });

  test('POST /api/tts-language returns 401 session_required when anonymous in hosted', async () => {
    const res = await request(app).post('/api/tts-language').send({ ttsLanguage: 'es' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'session_required');
  });
});
