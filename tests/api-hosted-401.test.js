const express = require('express');
const request = require('supertest');

process.env.NODE_ENV = 'test';

const registerTipGoalRoutes = require('../routes/tip-goal');
const registerLastTipRoutes = require('../routes/last-tip');

function makeAppHosted() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const store = {
    redis: {},
    async get() { return null; },
    async set() { return true; }
  };

  const strictLimiter = (_req, _res, next) => next();
  const goalAudioUpload = { single: () => (_req, _res, next) => next() };

  const wss = { broadcast: () => {} };

  const TG_FILE = require('path').join(process.cwd(), 'config', 'tip-goal-config.json');
  const GA_FILE = require('path').join(process.cwd(), 'config', 'goal-audio-settings.json');

  const tipGoal = {};
  const lastTip = { updateWalletAddress: () => ({}) };
  const tipWidget = { updateWalletAddress: () => ({}) };

  registerTipGoalRoutes(app, strictLimiter, goalAudioUpload, tipGoal, wss, TG_FILE, GA_FILE, { store });
  registerLastTipRoutes(app, lastTip, tipWidget, { store, wss });

  return app;
}

describe('Hosted mode 401 enforcement (no session)', () => {
  let app;
  let agent;
  beforeAll(() => {
    app = makeAppHosted();
    agent = request(app);
  });

  it('POST /api/tip-goal returns 401 no_session without ns', async () => {
    const res = await agent.post('/api/tip-goal').send({ monthlyGoal: 5 });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'no_session');
  });

  it('POST /api/last-tip returns 401 no_session without ns', async () => {
    const res = await agent.post('/api/last-tip').send({ walletAddress: 'X' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'no_session');
  });
});
