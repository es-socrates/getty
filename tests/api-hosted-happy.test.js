const express = require('express');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.GETTY_TEST_FORCE_OPEN = '1';

const registerTipGoalRoutes = require('../routes/tip-goal');
const registerLastTipRoutes = require('../routes/last-tip');

function makeAppHostedWithSession() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const memory = new Map();
  const store = {
    redis: {},
    async get(ns, key, defVal) {
      const nsMap = memory.get(ns);
      if (!nsMap) return defVal ?? null;
      return nsMap.has(key) ? nsMap.get(key) : (defVal ?? null);
    },
    async set(ns, key, val) {
      if (!memory.has(ns)) memory.set(ns, new Map());
      memory.get(ns).set(key, val);
      return true;
    }
  };

  app.use((req, _res, next) => {
    req.ns = { pub: 'ns:public:abc123' };
    next();
  });

  const strictLimiter = (_req, _res, next) => next();
  const goalAudioUpload = { single: () => (_req, _res, next) => next() };

  const wss = { broadcast: () => {} };

  const TG_FILE = require('path').join(process.cwd(), 'config', 'tip-goal-config.json');
  const GA_FILE = require('path').join(process.cwd(), 'config', 'goal-audio-settings.json');

  const tipGoal = { sendGoalUpdate: () => {} };
  const lastTip = { updateWalletAddress: () => ({}) };
  const tipWidget = { updateWalletAddress: () => ({}) };

  registerTipGoalRoutes(app, strictLimiter, goalAudioUpload, tipGoal, wss, TG_FILE, GA_FILE, { store });
  registerLastTipRoutes(app, lastTip, tipWidget, { store, wss });

  return { app, store };
}

describe('Hosted mode happy path with session namespace', () => {
  let app;
  let agent;
  let store;
  beforeAll(() => {
    const built = makeAppHostedWithSession();
    app = built.app;
    store = built.store;
    agent = request(app);
  });

  test('POST /api/tip-goal succeeds (200) and persists to store', async () => {
    const res = await agent
      .post('/api/tip-goal')
      .send({ monthlyGoal: 10, currentAmount: 2, walletAddress: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);

    const cfg = await store.get('ns:public:abc123', 'tip-goal-config', null);
    expect(cfg).toBeTruthy();
    expect(cfg).toMatchObject({ monthlyGoal: 10, currentAmount: 2, walletAddress: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });
  });

  test('POST /api/last-tip succeeds (200) and cross-propagates wallet to tip-goal in store', async () => {
    const res = await agent
      .post('/api/last-tip')
      .send({ walletAddress: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', title: 'Hello' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    const lastTipCfg = await store.get('ns:public:abc123', 'last-tip-config', null);
    expect(lastTipCfg).toBeTruthy();
    expect(lastTipCfg.walletAddress).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    const tipGoalCfg = await store.get('ns:public:abc123', 'tip-goal-config', null);
    expect(tipGoalCfg).toBeTruthy();
    expect(tipGoalCfg.walletAddress).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  });
});
