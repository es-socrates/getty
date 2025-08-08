const request = require('supertest');
const app = require('../server');

describe('Language API', () => {
  test('GET /api/language returns current and available languages', async () => {
    const res = await request(app).get('/api/language');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('currentLanguage');
    expect(res.body).toHaveProperty('availableLanguages');
    expect(res.body.availableLanguages).toEqual(expect.arrayContaining(['en','es']));
  });

  test('POST /api/language rejects invalid language', async () => {
    const res = await request(app).post('/api/language').send({ language: 'fr' });
    expect(res.status).toBe(400);
  });

  test('POST /api/language accepts es', async () => {
    const res = await request(app).post('/api/language').send({ language: 'es' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('language', 'es');
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
