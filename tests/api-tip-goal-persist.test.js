const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');
let appRef; let restoreBaseline;
beforeAll(() => { ({ app: appRef, restore: restoreBaseline } = freshServer({ REDIS_URL: null, GETTY_REQUIRE_SESSION: null, GETTY_ENFORCE_OWNER_WRITES: '0', GETTY_REQUIRE_ADMIN_WRITE: '0' })); });
afterAll(() => { try { restoreBaseline && restoreBaseline(); } catch {} });

const CONFIG_DIR = process.env.GETTY_CONFIG_DIR ? process.env.GETTY_CONFIG_DIR : path.join(process.cwd(), 'config');
const CONFIG_PATH = path.join(CONFIG_DIR, 'tip-goal-config.json');

describe('Tip Goal persistence', () => {
  let server;
  let agent;
  beforeAll(async () => {
    if (appRef.startTestServer) {
      server = await appRef.startTestServer();
      agent = request(server);
    } else {
      agent = request(appRef);
    }
  });
  afterAll(done => { if (server) server.close(done); else done(); });

  it('saves title and current amount then survives simulated restart', async () => {

    try { if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH); } catch { /* ignore error */ }
    if (process.env.JEST_WORKER_ID) {
      const workerPath = path.join(CONFIG_DIR, `tip-goal-config.${process.env.JEST_WORKER_ID}.json`);
      try { if (fs.existsSync(workerPath)) fs.unlinkSync(workerPath); } catch { /* ignore error */ }
    }
    const title = 'Monthly tip goal 🎖️';
    const res = await agent
      .post('/api/tip-goal')
      .field('walletAddress','')
      .field('monthlyGoal','8')
      .field('currentAmount','0.1')
      .field('title', title);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH,'utf8'));
  const dataLayer = raw && raw.data && typeof raw.data === 'object' ? raw.data : raw;
  expect(dataLayer.title).toBe(title);
  expect(dataLayer.currentAmount).toBeCloseTo(0.1, 5);

    delete require.cache[require.resolve('../modules/tip-goal')];
    const { TipGoalModule } = require('../modules/tip-goal');
    const { Server } = require('ws');
    const dummyWss = new Server({ noServer: true });
    const oldWorkerId = process.env.JEST_WORKER_ID;
    process.env.JEST_WORKER_ID = '';
    const fresh = new TipGoalModule(dummyWss);
    process.env.JEST_WORKER_ID = oldWorkerId;

  expect(fresh.title).toBe(title);
  expect(fresh.currentTipsAR).toBeCloseTo(0.1, 5);
  expect(fresh.monthlyGoalAR).toBe(8);
  });
});
