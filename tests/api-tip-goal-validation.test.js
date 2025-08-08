const request = require('supertest');
const app = require('../server');

describe('Tip Goal validation', () => {
  it('rejects missing goal amount', async () => {
    const res = await request(app)
      .post('/api/tip-goal')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('accepts minimal valid payload', async () => {
    const res = await request(app)
      .post('/api/tip-goal')
      .send({ monthlyGoal: 10 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
