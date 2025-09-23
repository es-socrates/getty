const express = require('express');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.GETTY_TEST_FORCE_OPEN = '1';

const registerTipGoalRoutes = require('../routes/tip-goal');

function buildHostedApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  const memory = new Map();
  const store = {
    redis: {},
    async get(ns, key, defVal) { const nsMap = memory.get(ns); if (!nsMap) return defVal ?? null; return nsMap.has(key) ? nsMap.get(key) : (defVal ?? null); },
    async set(ns, key, val) { if (!memory.has(ns)) memory.set(ns, new Map()); memory.get(ns).set(key, val); return true; },
    async getConfig(ns, filename, defVal) { const existing = await this.get(ns, filename, null); return existing || defVal; },
    async setConfig(ns, filename, val) { return this.set(ns, filename, val); }
  };
  app.use((req, _res, next) => { req.ns = { pub: 'ns:public:getDerived' }; next(); });
  const strictLimiter = (_req,_res,next)=>next();
  const goalAudioUpload = { single: () => (_req,_res,next)=>next() };
  const wss = { broadcast: () => {} };
  const TG_FILE = require('path').join(process.cwd(), 'config', 'tip-goal-config.json');
  const GA_FILE = require('path').join(process.cwd(), 'config', 'goal-audio-settings.json');
  const tipGoal = { AR_TO_USD: 0.30, sendGoalUpdate: () => {} };
  registerTipGoalRoutes(app, strictLimiter, goalAudioUpload, tipGoal, wss, TG_FILE, GA_FILE, { store });
  return { app, store };
}

describe('Tip Goal GET derived fields', () => {
  let agent;
  beforeAll(() => { const { app } = buildHostedApp(); agent = request(app); });

  test('GET returns derived fields after POST', async () => {

    const postRes = await agent.post('/api/tip-goal').send({
      walletAddress: 'nu2vtfSxaRzVNcqDD7Jvgol5bZ-d0rO8OHAFe2s4uaM',
      monthlyGoal: 10,
      currentAmount: 4,
      theme: 'classic'
    });
    expect(postRes.status).toBe(200);

    const getRes = await agent.get('/api/tip-goal');
    expect(getRes.status).toBe(200);
    const body = getRes.body;
    expect(body.success).toBe(true);
    expect(body.monthlyGoal).toBe(10);
    expect(body.currentAmount).toBe(4);
    expect(body.currentTips).toBe(4);
    expect(typeof body.progress).toBe('number');
    expect(body.progress).toBeGreaterThan(0);
    expect(body.progress).toBeLessThanOrEqual(100);
    expect(body.exchangeRate).toBe(0.30);
    expect(typeof body.usdValue).toBe('string');
    expect(typeof body.goalUsd).toBe('string');
  });
});
