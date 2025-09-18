const fs = require('fs');
const path = require('path');
const request = require('supertest');

process.env.NODE_ENV = 'test';
const app = require('../server');

const TG_PATH = path.join(process.cwd(), 'config', 'tip-goal-config.json');
const LT_PATH = path.join(process.cwd(), 'config', 'last-tip-config.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

describe('Wallet clear behavior', () => {
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

  describe('Tip Goal', () => {
  it('persists wallet and ignores empty clear attempt (preservation policy)', async () => {
  try { if (fs.existsSync(TG_PATH)) fs.unlinkSync(TG_PATH); } catch { /* ignore error */ }
      const r1 = await agent
        .post('/api/tip-goal')
        .field('walletAddress', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
        .field('monthlyGoal', '5')
        .field('currentAmount', '0');
      expect(r1.status).toBe(200);
      expect(fs.existsSync(TG_PATH)).toBe(true);
      const afterSet = readJson(TG_PATH);
      expect(afterSet.walletAddress).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');

      const r2 = await agent
        .post('/api/tip-goal')
        .field('walletAddress', '')
        .field('monthlyGoal', '5')
        .field('currentAmount', '0');
      expect(r2.status).toBe(200);
      const afterClear = readJson(TG_PATH);
      expect(afterClear).toHaveProperty('walletAddress');
      expect(afterClear.walletAddress).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    });
  });

  describe('Last Tip', () => {
  it('persists wallet and ignores empty clear attempt (preservation policy)', async () => {
  try { if (fs.existsSync(LT_PATH)) fs.unlinkSync(LT_PATH); } catch { /* ignore error */ }
      const r1 = await agent
        .post('/api/last-tip')
        .send({ walletAddress: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
        .set('Content-Type', 'application/json');
      expect(r1.status).toBe(200);
      expect(fs.existsSync(LT_PATH)).toBe(true);
      const afterSet = readJson(LT_PATH);
      expect(afterSet.walletAddress).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');

      const r2 = await agent
        .post('/api/last-tip')
        .send({ walletAddress: '' })
        .set('Content-Type', 'application/json');
      expect(r2.status).toBe(200);
      const afterClear = readJson(LT_PATH);
      expect(afterClear).toHaveProperty('walletAddress');
      expect(afterClear.walletAddress).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    });
  });
});
