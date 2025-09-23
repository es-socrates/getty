const request = require('supertest');

describe('multi-tenant wallet isolation for tip goal & last tip', () => {
  let app;
  let server;
  beforeAll((done) => {
    process.env.REDIS_URL = '';
    process.env.GETTY_MULTI_TENANT_WALLET = '1';
    process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY = '1';
    process.env.GETTY_REQUIRE_SESSION = '1';
    process.env.GETTY_DISABLE_GLOBAL_FALLBACK = '1';
    jest.resetModules();
    app = require('../server');
    server = app.listen(0, () => { done(); });
  });
  afterAll((done) => { try { server.close(()=>done()); } catch { done(); } });

  const walletA = 'X1lJkYQyJbVv8mPcXh0G3J9Qp7eUx4lB9yKJt1J0vRw';
  const walletB = 'Z2d8mBbLqW3R5nS0dKpQ7yVhTt9eFx2aCc4MmNnPpSs';

  async function login(agent, address) {
    const nr = await agent.post('/api/auth/wander/nonce').send({ address });
    expect(nr.status).toBe(200);
    const vr = await agent.post('/api/auth/wander/verify').send({ address, publicKey: 'FAKE_PUBLIC_KEY_BASE64URL', signature: 'TEST' });
    expect(vr.status).toBe(200);
  }

  it('wallet A config remains isolated from wallet B', async () => {
    const agentA = request.agent(app);
    const agentB = request.agent(app);

    await login(agentA, walletA);
    await login(agentB, walletB);

    const createGoal = await agentA
      .post('/api/tip-goal')
      .send({ walletAddress: walletA, monthlyGoal: 25, currentAmount: 5, theme: 'classic' });
    expect(createGoal.status).toBe(200);
    expect(createGoal.body.success).toBe(true);

    const setLast = await agentA
      .post('/api/last-tip')
      .send({ walletAddress: walletA, title: 'Last tip A' });
    expect(setLast.status).toBe(200);

    const goalA = await agentA.get('/api/tip-goal');
    expect(goalA.status).toBe(200);
    expect(goalA.body.monthlyGoal).toBe(25);

    const lastA = await agentA.get('/api/last-tip');
    expect([200,404]).toContain(lastA.status);

    const goalB = await agentB.get('/api/tip-goal');
    if (goalB.status === 200) {
      expect(goalB.body.walletAddress).not.toBe(walletA);
      expect(goalB.body.monthlyGoal).not.toBe(25);
    } else {
      expect(goalB.status).toBe(404);
    }

    const lastB = await agentB.get('/api/last-tip');
    if (lastB.status === 200) {
      expect(lastB.body.walletAddress).not.toBe(walletA);
      expect(lastB.body.title).not.toBe('Last tip A');
    } else {
      expect(lastB.status).toBe(404);
    }
  });
});
