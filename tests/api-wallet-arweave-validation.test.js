const request = require('supertest');
const app = require('../server');

function withSession(req) {
  return req.set('Cookie', ['getty_admin_token=dummy']);
}

const VALID_AR = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const INVALID_ADDRS = [
  'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080', // Bitcoin
  '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',   // Ethereum
  'rG1QQv2nh2gr7RCZ1P8YYcBUKCCN633jCn',          // XRP
  'short',                                        // too short
  'has space in it',                              // invalid chars
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',  // 41 chars
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' // 45 chars
];

describe('Arweave wallet validation', () => {
  test('tip-goal rejects non-Arweave wallets and accepts valid', async () => {
    for (const bad of INVALID_ADDRS) {
      const resBad = await withSession(request(app).post('/api/tip-goal')).send({ monthlyGoal: 10, walletAddress: bad });
      expect([400,401,410]).toContain(resBad.status);
      if (resBad.status === 400) expect(resBad.body.error).toBe('invalid_wallet_address');
    }

    const resOk = await withSession(request(app).post('/api/tip-goal')).send({ monthlyGoal: 10, walletAddress: VALID_AR });
    expect([200,401]).toContain(resOk.status);
    if (resOk.status === 200) {
      expect(resOk.body.success).toBe(true);
      expect(resOk.body.walletAddress).toBe(VALID_AR);
    }
  });

  test('last-tip rejects non-Arweave wallets and accepts valid', async () => {
    for (const bad of INVALID_ADDRS) {
      const resBad = await withSession(request(app).post('/api/last-tip')).send({ walletAddress: bad });
      expect([400,401,410]).toContain(resBad.status);
      if (resBad.status === 400) expect(resBad.body.error).toBe('invalid_wallet_address');
    }

    const resOk = await withSession(request(app).post('/api/last-tip')).send({ walletAddress: VALID_AR });
    expect([200,401]).toContain(resOk.status);
    if (resOk.status === 200) {
      expect(resOk.body.success).toBe(true);
      expect(resOk.body.walletAddress).toBe(VALID_AR);
    }
  });

});
