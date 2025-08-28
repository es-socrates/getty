const express = require('express');
const request = require('supertest');

process.env.NODE_ENV = 'test';

const registerTipGoalRoutes = require('../routes/tip-goal');
const registerLastTipRoutes = require('../routes/last-tip');

function makeApp(requireNs = false, withNs = false) {
  if (requireNs) process.env.GETTY_REQUIRE_SESSION = '1';
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  if (withNs) {
    app.use((req, _res, next) => { req.ns = { pub: 'ns:test' }; next(); });
  }
  const strictLimiter = (_req, _res, next) => next();
  const goalAudioUpload = { single: () => (_req, _res, next) => next() };
  const wss = { broadcast: () => {} };

  const TG_FILE = require('path').join(process.cwd(), 'config', 'tip-goal-config.json');
  const GA_FILE = require('path').join(process.cwd(), 'config', 'goal-audio-settings.json');

  const tipGoal = { sendGoalUpdate: () => {}, updateWalletAddress: () => {} };
  const lastTip = { updateWalletAddress: () => ({}) };
  const tipWidget = { updateWalletAddress: () => ({}) };

  registerTipGoalRoutes(app, strictLimiter, goalAudioUpload, tipGoal, wss, TG_FILE, GA_FILE, { store: null });
  registerLastTipRoutes(app, lastTip, tipWidget, { store: null, wss });
  return app;
}

describe('GETTY_REQUIRE_SESSION flag enforcement', () => {
  test('POSTs are 401 without session when flag is set (no store)', async () => {
    const app = makeApp(true, false);
    const agent = request(app);
    let res = await agent.post('/api/tip-goal').send({ monthlyGoal: 5 });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'no_session');
    res = await agent.post('/api/last-tip').send({ walletAddress: 'X' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'no_session');
  });

  test('POSTs succeed with session when flag is set (no store → file path)', async () => {
    const app = makeApp(true, true);
    const agent = request(app);
    let res = await agent.post('/api/tip-goal').send({ monthlyGoal: 3, currentAmount: 1, walletAddress: '' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    res = await agent.post('/api/last-tip').send({ title: 'T', walletAddress: '' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
