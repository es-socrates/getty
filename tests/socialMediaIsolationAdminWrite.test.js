const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');

describe('SocialMedia isolation with admin write requirement', () => {
  let app; let restore; let server; let agentA; let agentB;

  async function login(agent, address) {
    const nonceRes = await agent.post('/api/auth/wander/nonce').send({ address });
    expect(nonceRes.status).toBe(200);
    const verifyRes = await agent.post('/api/auth/wander/verify').send({ address, publicKey: 'FAKE', signature: 'TEST' });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.walletHash).toBeTruthy();
    return verifyRes.body.walletHash;
  }

  beforeAll(async () => {
    ({ app, restore } = freshServer({
      GETTY_MULTI_TENANT_WALLET: '1',
      GETTY_WALLET_AUTH_ALLOW_DUMMY: '1',
      GETTY_REQUIRE_SESSION: '1',
      GETTY_REQUIRE_ADMIN_WRITE: '1',
      REDIS_URL: null
    }));
    server = await app.startTestServer(0);
    agentA = request.agent(server);
    agentB = request.agent(server);
    await login(agentA, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    await login(agentB, 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
  });

  afterAll(done => { try { restore && restore(); } catch {} if (server) server.close(done); else done(); });

  test('Each wallet sees only its own social media items when admin writes enforced', async () => {
    const payloadA = { config: [{ name: 'Alpha', icon: 'x', link: 'https://example.com/a' }] };
    const saveA = await agentA.post('/api/socialmedia-config').send(payloadA);
    expect(saveA.status).toBe(200);
    expect(saveA.body.success).toBe(true);

    const payloadB = { config: [{ name: 'Beta', icon: 'youtube', link: 'https://example.com/b' }] };
    const saveB = await agentB.post('/api/socialmedia-config').send(payloadB);
    expect(saveB.status).toBe(200);
    expect(saveB.body.success).toBe(true);

    const getA = await agentA.get('/api/socialmedia-config');
    expect(getA.status).toBe(200);
    expect(getA.body.success).toBe(true);
    expect(getA.body.config.some(i => i.name === 'Alpha')).toBe(true);
    expect(getA.body.config.some(i => i.name === 'Beta')).toBe(false);

    const getB = await agentB.get('/api/socialmedia-config');
    expect(getB.status).toBe(200);
    expect(getB.body.success).toBe(true);
    expect(getB.body.config.some(i => i.name === 'Beta')).toBe(true);
    expect(getB.body.config.some(i => i.name === 'Alpha')).toBe(false);
  });
});
