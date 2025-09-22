const request = require('supertest');
process.env.NODE_ENV = 'test';

let app;

describe('Modules tipGoal derived fields stability', () => {
  beforeAll(() => {
      process.env.GETTY_REQUIRE_SESSION = '0';
      delete require.cache[require.resolve('../server')];
      app = require('../server');
    });

  test('After POST, /api/modules returns consistent derived fields (no zero regression)', async () => {

    const post = await request(app).post('/api/tip-goal').send({
      walletAddress: 'nu2vtfSxaRzVNcqDD7Jvgol5bZ-d0rO8OHAFe2s4uaM',
      monthlyGoal: 5,
      currentAmount: 2,
      theme: 'classic'
    });
    expect(post.status).toBe(200);

    const mod1 = await request(app).get('/api/modules');
    expect(mod1.status).toBe(200);
    const tg1 = mod1.body.tipGoal || {};
    expect(typeof tg1.progress).toBe('number');
    expect(tg1.currentTips).toBe(2);
    expect(tg1.currentAmount).toBe(2);
    expect(tg1.monthlyGoal).toBe(5);

    const mod2 = await request(app).get('/api/modules');
    const tg2 = mod2.body.tipGoal || {};
    expect(tg2.currentTips).toBe(2);
    expect(tg2.currentAmount).toBe(2);
    expect(tg2.monthlyGoal).toBe(5);
    expect(tg2.progress).toBeGreaterThan(0);
  });
});
