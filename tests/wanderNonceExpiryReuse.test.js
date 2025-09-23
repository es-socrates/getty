const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');

describe('wander nonce expiry & reuse', () => {
  let app; let restore; let agent;
  beforeAll(() => {
    ({ app, restore } = freshServer({
      REDIS_URL: null,
      GETTY_MULTI_TENANT_WALLET: '1',
      GETTY_WALLET_AUTH_ALLOW_DUMMY: '1'
    }));
    agent = request.agent(app);
  });
  afterAll(() => { try { restore && restore(); } catch {} });

  it('rejects reuse of a nonce after successful verify', async () => {
    const address = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    const nr = await agent.post('/api/auth/wander/nonce').send({ address });
    expect(nr.status).toBe(200);
    const vr = await agent.post('/api/auth/wander/verify').send({ address, publicKey: 'FAKE_PUBLIC_KEY_BASE64URL', signature: 'TEST' });
    expect(vr.status).toBe(200);

    const vr2 = await agent.post('/api/auth/wander/verify').send({ address, publicKey: 'FAKE_PUBLIC_KEY_BASE64URL', signature: 'TEST' });
    expect(vr2.status).toBe(400);
    expect(vr2.body.error).toBe('nonce_not_found');
  });

  it('rejects expired nonce', async () => {
    const address = 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
    const nr = await agent.post('/api/auth/wander/nonce').send({ address });
    expect(nr.status).toBe(200);

    const realNow = Date.now;
    Date.now = () => realNow() + 10 * 60 * 1000;
    const vr = await agent.post('/api/auth/wander/verify').send({ address, publicKey: 'FAKE_PUBLIC_KEY_BASE64URL', signature: 'TEST' });
    Date.now = realNow;
    expect(vr.status).toBe(400);
    expect(vr.body.error).toBe('nonce_expired');
  });
});
