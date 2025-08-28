/* eslint-env jest */
/* eslint-disable no-undef */
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

process.env.NODE_ENV = 'test';

const registerTipGoalRoutes = require('../routes/tip-goal');
const registerLastTipRoutes = require('../routes/last-tip');

function makeHostedAppNoSession() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const store = { redis: {}, async get() { return null; }, async set() { return true; } };
  const strictLimiter = (_req, _res, next) => next();
  const goalAudioUpload = { single: () => (_req, _res, next) => next() };
  const wss = { broadcast: () => {} };

  const TG_FILE = path.join(process.cwd(), 'config', 'tip-goal-config.json');
  const GA_FILE = path.join(process.cwd(), 'config', 'goal-audio-settings.json');

  const tipGoal = { sendGoalUpdate: () => {}, updateWalletAddress: () => {} };
  const lastTip = { updateWalletAddress: () => ({}) };
  const tipWidget = { updateWalletAddress: () => ({}) };

  registerTipGoalRoutes(app, strictLimiter, goalAudioUpload, tipGoal, wss, TG_FILE, GA_FILE, { store });
  registerLastTipRoutes(app, lastTip, tipWidget, { store, wss });
  return { app, TG_FILE, LT_FILE: path.join(process.cwd(), 'config', 'last-tip-config.json') };
}

describe('Hosted masking for wallet on GET without session', () => {
  let app; let TG_FILE; let LT_FILE; let agent;
  beforeAll(() => {
    ({ app, TG_FILE, LT_FILE } = makeHostedAppNoSession());
    agent = request(app);
  });

  beforeEach(() => {
    fs.writeFileSync(TG_FILE, JSON.stringify({ walletAddress: 'SEED_WALLET_TG', monthlyGoal: 1, currentAmount: 0 }, null, 2));
    fs.writeFileSync(LT_FILE, JSON.stringify({ walletAddress: 'SEED_WALLET_LT', title: 'Last tip' }, null, 2));
  });

  afterEach(() => {
    try { fs.unlinkSync(TG_FILE); } catch { /* noop for tests */ }
    try { fs.unlinkSync(LT_FILE); } catch { /* noop for tests */ }
  });

  test('GET /api/tip-goal masks walletAddress in hosted without ns', async () => {
    const res = await agent.get('/api/tip-goal');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.walletAddress).toBeUndefined();
  });

  test('GET /api/last-tip masks walletAddress in hosted without ns', async () => {
    const res = await agent.get('/api/last-tip');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.walletAddress).toBeUndefined();
  });
});
