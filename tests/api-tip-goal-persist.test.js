const fs = require('fs');
const path = require('path');
const request = require('supertest');

process.env.NODE_ENV = 'test';
const app = require('../server');

const CONFIG_PATH = path.join(process.cwd(), 'config', 'tip-goal-config.json');

describe('Tip Goal persistence', () => {
  let server;
  let agent;
  beforeAll(async () => {
    if (app.startTestServer) {
      server = await app.startTestServer();
      agent = request(server);
    } else {
      agent = request(app);
    }
  });
  afterAll(done => { if (server) server.close(done); else done(); });

  it('saves title and current amount then survives simulated restart', async () => {

    try { if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH); } catch { /* ignore error */ }
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
    expect(raw.title).toBe(title);
    expect(raw.currentAmount).toBeCloseTo(0.1, 5);

    delete require.cache[require.resolve('../modules/tip-goal')];
    const { TipGoalModule } = require('../modules/tip-goal');
    const { Server } = require('ws');
    const dummyWss = new Server({ noServer: true });
    const fresh = new TipGoalModule(dummyWss);

    expect(fresh.title).toBe(title);
    expect(fresh.currentTipsAR).toBeCloseTo(0.1, 5);
    expect(fresh.monthlyGoalAR).toBe(8);
  });
});
