const request = require('supertest');
const app = require('../server');

describe('Additional API tests', () => {
  test('GET /api/tts-setting returns boolean', async () => {
    const res = await request(app).get('/api/tts-setting');
    expect(res.status).toBe(200);
    expect(typeof res.body.ttsEnabled).toBe('boolean');
  });

  test('POST /api/tts-setting validates payload', async () => {
  const bad = await request(app).post('/api/tts-setting').send({});
  expect(bad.status).toBe(200);
  expect(bad.body).toHaveProperty('ttsEnabled', false);

    const ok = await request(app).post('/api/tts-setting').send({ ttsEnabled: true });
    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);
    expect(ok.body).toHaveProperty('ttsEnabled', true);
  });

  test('GET /api/tts-language returns language code', async () => {
    const res = await request(app).get('/api/tts-language');
    expect(res.status).toBe(200);
    expect(['en','es']).toContain(res.body.ttsLanguage);
  });

  test('POST /api/tts-language validates allowed values', async () => {
    const bad = await request(app).post('/api/tts-language').send({ ttsLanguage: 'fr' });
    expect(bad.status).toBe(400);

    const ok = await request(app).post('/api/tts-language').send({ ttsLanguage: 'es' });
    expect(ok.status).toBe(200);
    expect(ok.body).toHaveProperty('ttsLanguage', 'es');
  });

  test('GET /api/goal-audio-settings returns shape', async () => {
    const res = await request(app).get('/api/goal-audio-settings');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('audioSource');
    expect(res.body).toHaveProperty('hasCustomAudio');
  });

  test('DELETE /api/goal-audio-settings resets settings', async () => {
    const res = await request(app).delete('/api/goal-audio-settings');
    expect([200,204]).toContain(res.status);
    // our endpoint returns JSON { success: true }
    if (res.status === 200) {
      expect(res.body).toHaveProperty('success', true);
    }
  });
});
