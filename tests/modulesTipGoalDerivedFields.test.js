const request = require('supertest');
process.env.NODE_ENV = 'test';

let app;

describe('Modules tipGoal derived fields stability', () => {
  beforeAll(() => {
      process.env.GETTY_REQUIRE_SESSION = '0';
      process.env.REDIS_URL = ''; // Disable Redis for this test
      delete require.cache[require.resolve('../server')];
      try { delete require.cache[require.resolve('../modules/tip-goal')]; } catch {}
      app = require('../server');
    });

  test('After POST, /api/modules returns consistent derived fields (no zero regression)', async () => {
    const fs = require('fs');
    const path = require('path');
    const cfgDir = process.env.GETTY_CONFIG_DIR || path.join(process.cwd(),'config');
    const cfgFile = path.join(cfgDir,'tip-goal-config.json');
    try { if (fs.existsSync(cfgFile)) fs.unlinkSync(cfgFile); } catch {}
    const workerFile = path.join(cfgDir, `tip-goal-config.${process.env.JEST_WORKER_ID}.json`);
    try { if (fs.existsSync(workerFile)) fs.unlinkSync(workerFile); } catch {}
    const tenantFile = path.join(process.cwd(), 'tenant', 'local', 'config', 'tip-goal-config.json');
    try { if (fs.existsSync(tenantFile)) fs.unlinkSync(tenantFile); } catch {}

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
