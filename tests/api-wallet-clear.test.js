const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');
let appRef; let restoreBaseline; let server;
beforeAll(async () => { ({ app: appRef, restore: restoreBaseline } = freshServer({ REDIS_URL: null, GETTY_REQUIRE_SESSION: null, GETTY_ENFORCE_OWNER_WRITES: '0', GETTY_REQUIRE_ADMIN_WRITE: '0' })); if (appRef.startTestServer) server = await appRef.startTestServer(); });
afterAll(done => { try { restoreBaseline && restoreBaseline(); } catch {} if (server) server.close(done); else done(); });

const TG_PATH = path.join(process.cwd(), 'config', 'tip-goal-config.json');
const LT_PATH = path.join(process.cwd(), 'config', 'last-tip-config.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

describe('Wallet clear behavior', () => {
  let agent;
  beforeAll(() => { agent = request(appRef); });

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
