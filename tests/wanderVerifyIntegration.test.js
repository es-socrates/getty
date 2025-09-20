const request = require('supertest');
const app = require('../server');

describe('Wander verify integration', () => {
  test('nonce -> verify sets cookie and returns walletHash', async () => {
    if (process.env.GETTY_MULTI_TENANT_WALLET !== '1') {
      console.warn('[wanderVerifyIntegration] skipping: GETTY_MULTI_TENANT_WALLET != 1');
      return;
    }

    const address = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno123456789';

    const nonceRes = await request(app)
      .post('/api/auth/wander/nonce')
      .send({ address })
      .expect(200);
    expect(nonceRes.body).toHaveProperty('nonce');
    expect(nonceRes.body).toHaveProperty('message');

    const verifyRes = await request(app)
      .post('/api/auth/wander/verify')
      .send({ address, publicKey: 'PUBKEY_PLACEHOLDER', signature: process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY === '1' ? 'TEST' : 'SIG' });

    if (process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY === '1') {
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toHaveProperty('walletHash');
      expect(verifyRes.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringMatching(/getty_wallet_session=/)])
      );
    } else {
      expect([400,401]).toContain(verifyRes.status);
    }
  });
});
