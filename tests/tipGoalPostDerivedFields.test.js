const express = require('express');
const request = require('supertest');

process.env.NODE_ENV = 'test';

const registerTipGoalRoutes = require('../routes/tip-goal');

function buildHostedApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  const memory = new Map();
  const store = {
    redis: {},
    async get(ns, key, defVal) { const nsMap = memory.get(ns); if (!nsMap) return defVal ?? null; return nsMap.has(key) ? nsMap.get(key) : (defVal ?? null); },
    async set(ns, key, val) { if (!memory.has(ns)) memory.set(ns, new Map()); memory.get(ns).set(key, val); return true; }
  };
  app.use((req, _res, next) => { req.ns = { pub: 'ns:public:derived' }; next(); });
  const strictLimiter = (_req,_res,next)=>next();
  const goalAudioUpload = { single: () => (_req,_res,next)=>next() };
  const wss = { broadcast: () => {} };
  const TG_FILE = require('path').join(process.cwd(), 'config', 'tip-goal-config.json');
  const GA_FILE = require('path').join(process.cwd(), 'config', 'goal-audio-settings.json');
  const tipGoal = { AR_TO_USD: 0.25, sendGoalUpdate: () => {} };
  registerTipGoalRoutes(app, strictLimiter, goalAudioUpload, tipGoal, wss, TG_FILE, GA_FILE, { store });
  return { app, store };
}

describe('Tip Goal POST derived fields', () => {
  let agent;
  beforeAll(() => { const { app } = buildHostedApp(); agent = request(app); });

  test('POST returns derived non-persistent fields', async () => {
    const res = await agent.post('/api/tip-goal').send({
      walletAddress: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      monthlyGoal: 6,
      currentAmount: 2,
      theme: 'modern-list',
      title: 'Meta mensual 🎯'
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.monthlyGoal).toBe(6);
    expect(res.body.currentAmount).toBe(2);
    expect(res.body.currentTips).toBe(2);
    expect(typeof res.body.progress).toBe('number');
    expect(res.body.progress).toBeGreaterThan(0);
    expect(res.body.progress).toBeLessThanOrEqual(100);
    if (res.body.exchangeRate) {
      expect(typeof res.body.usdValue).toBe('string');
      expect(typeof res.body.goalUsd).toBe('string');
    }
  });
});
