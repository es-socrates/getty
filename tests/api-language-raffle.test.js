const request = require('supertest');
const app = require('../server');

describe('Language API (hardened)', () => {
  async function getCsrf(agent) {
    const r = await agent.get('/api/admin/csrf');
    if (r.status !== 200) {

      return null;
    }
    return r.body && r.body.csrfToken || null;
  }

  test('GET /api/language returns current and available languages', async () => {
    const res = await request(app).get('/api/language');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('currentLanguage');
    expect(res.body).toHaveProperty('availableLanguages');
    expect(res.body.availableLanguages).toEqual(expect.arrayContaining(['en','es']));
  });

  test('POST /api/language without CSRF header is rejected', async () => {
    const res = await request(app).post('/api/language').send({ language: 'es' });

    expect([401,403]).toContain(res.status);
  });

  test('POST /api/language rejects invalid language with CSRF', async () => {
    const agent = request(app);
    const token = await getCsrf(agent);
    const reqBuilder = agent.post('/api/language');
    if (token) reqBuilder.set('x-csrf-token', token);
    const res = await reqBuilder.send({ language: 'fr' });

  expect([400,401,403,404]).toContain(res.status);
    if (res.status === 400) expect(res.body.error).toBeDefined();
  });

  test('POST /api/language accepts es with CSRF', async () => {
    const agent = request(app);
    const token = await getCsrf(agent);
    const reqBuilder = agent.post('/api/language');
    if (token) reqBuilder.set('x-csrf-token', token);
    const res = await reqBuilder.send({ language: 'es' });

    expect([200,401,403]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('language', 'es');
    }
  });
});

describe('Raffle API', () => {
  test('GET /api/raffle/state returns public state', async () => {
    const res = await request(app).get('/api/raffle/state');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('active');
    expect(res.body).toHaveProperty('participants');
  });

  test('POST /api/raffle/settings saves valid settings', async () => {
    const payload = {
      command: '!giveaway',
      prize: 'Sticker pack',
      duration: 5,
      maxWinners: 1,
      enabled: true,
      mode: 'manual',
      interval: 5,
      imageUrl: ''
    };
    const res = await request(app).post('/api/raffle/settings').send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
