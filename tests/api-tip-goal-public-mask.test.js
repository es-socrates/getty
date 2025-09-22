/* eslint-env node, jest */
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { freshServer } = require('./helpers/freshServer');

describe('Public tip-goal masking preserves progress', () => {
  let app; let restore; let server; let agent;
  const cfgDir = process.env.GETTY_CONFIG_DIR || path.join(process.cwd(),'config');
  const cfgFile = path.join(cfgDir,'tip-goal-config.json');

  beforeAll(async () => {
    ({ app, restore } = freshServer({ REDIS_URL: null, GETTY_REQUIRE_SESSION: null }));
    if (app.startTestServer) server = await app.startTestServer();
    agent = request(server || app);
  });
  afterAll(done => { try { restore && restore(); } catch {} if (server) server.close(done); else done(); });

  test('Data stays when wallet omitted', async () => {
    try { if (fs.existsSync(cfgFile)) fs.unlinkSync(cfgFile); } catch {}

    const create = await agent.post('/api/tip-goal').field('walletAddress','').field('monthlyGoal','20').field('currentAmount','5').field('theme','modern-list');
    expect(create.status).toBe(200);

    const raw = JSON.parse(fs.readFileSync(cfgFile,'utf8'));
    if (raw.data) raw.data.walletAddress = ''; else raw.walletAddress='';
    fs.writeFileSync(cfgFile, JSON.stringify(raw,null,2));

    const res = await agent.get('/api/modules');
    expect(res.status).toBe(200);
    expect(res.body.tipGoal).toBeTruthy();

    expect(res.body.tipGoal.walletAddress === undefined || res.body.tipGoal.walletAddress === '').toBe(true);

    expect(res.body.tipGoal.monthlyGoal).toBe(20);
    expect(res.body.tipGoal.currentAmount).toBe(5);
    expect(['modern-list','classic']).toContain(res.body.tipGoal.theme);
  });
});
