const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');

async function loginWallet(baseAgent, address) {

  const nonceRes = await baseAgent.post('/api/auth/wander/nonce').send({ address });
  expect(nonceRes.status).toBe(200);

  const verifyRes = await baseAgent.post('/api/auth/wander/verify').send({ address, publicKey: 'FAKE', signature: 'TEST' });
  expect(verifyRes.status).toBe(200);
  const walletHash = verifyRes.body && verifyRes.body.walletHash;
  expect(walletHash).toBeTruthy();
  return { walletHash };
}

describe('SocialMedia multi-tenant persistence & visibility', () => {
  let app; let restore; let server; let agentA; let agentB;

  beforeAll(async () => {
    ({ app, restore } = freshServer({
      GETTY_MULTI_TENANT_WALLET: '1',
      GETTY_WALLET_AUTH_ALLOW_DUMMY: '1',
      GETTY_REQUIRE_SESSION: '1',
      GETTY_REQUIRE_ADMIN_WRITE: '0',
      REDIS_URL: null
    }));
    server = await app.startTestServer(0);
  agentA = request.agent(server);
  agentB = request.agent(server);

  await loginWallet(agentA, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  await loginWallet(agentB, 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
  });

  afterAll(done => { try { restore && restore(); } catch {} if (server) server.close(done); else done(); });

  test('wallet A saves and retrieves its social media config', async () => {
    const payloadA = { config: [{ name: 'MyX', icon: 'x', link: 'https://example.com/a' }] };
    const saveRes = await agentA.post('/api/socialmedia-config').send(payloadA);
    expect(saveRes.status).toBe(200);
    expect(saveRes.body).toHaveProperty('success', true);

    const getRes = await agentA.get('/api/socialmedia-config');
    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveProperty('success', true);
    expect(Array.isArray(getRes.body.config)).toBe(true);
    expect(getRes.body.config.length).toBe(1);
    expect(getRes.body.config[0]).toMatchObject({ name: 'MyX', icon: 'x', link: 'https://example.com/a' });
  });

  test('wallet B does not see wallet A items, and can save its own', async () => {
    const getBEmpty = await agentB.get('/api/socialmedia-config');
    expect(getBEmpty.status).toBe(200);
    expect(getBEmpty.body).toHaveProperty('success', true);
    expect(Array.isArray(getBEmpty.body.config)).toBe(true);
    expect(getBEmpty.body.config.length === 0 || getBEmpty.body.config.every(i => i.name !== 'MyX')).toBe(true);

    const payloadB = { config: [{ name: 'ChannelB', icon: 'youtube', link: 'https://example.com/b' }] };
    const saveB = await agentB.post('/api/socialmedia-config').send(payloadB);
    expect(saveB.status).toBe(200);
    expect(saveB.body).toHaveProperty('success', true);

    const getBAfter = await agentB.get('/api/socialmedia-config');
    expect(getBAfter.status).toBe(200);
    expect(getBAfter.body).toHaveProperty('success', true);
    expect(getBAfter.body.config.some(i => i.name === 'ChannelB')).toBe(true);

    const getAAgain = await agentA.get('/api/socialmedia-config');
    expect(getAAgain.status).toBe(200);
    expect(getAAgain.body.config.some(i => i.name === 'MyX')).toBe(true);
    expect(getAAgain.body.config.some(i => i.name === 'ChannelB')).toBe(false);
  });
});
