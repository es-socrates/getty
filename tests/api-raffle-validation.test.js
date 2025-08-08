const request = require('supertest');
const app = require('../server');

describe('Raffle settings validation', () => {
  it('rejects invalid payload (missing prize)', async () => {
    const res = await request(app)
      .post('/api/raffle/settings')
      .send({ duration: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
  });

  it('accepts minimal valid payload', async () => {
    const res = await request(app)
      .post('/api/raffle/settings')
      .send({ prize: 'Sticker Pack' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
