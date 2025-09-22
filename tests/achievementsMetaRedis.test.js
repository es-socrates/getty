const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');
const { addressFromOwnerPublicKey } = require('../lib/wallet-auth');

function fakePublicKey(seed) {
  return Buffer.from(`ach-meta-redis-${seed}`).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function walletLogin(agent, seed='R') {
  const publicKey = fakePublicKey(seed);
  const address = addressFromOwnerPublicKey(publicKey);
  const nr = await agent.post('/api/auth/wallet/nonce').send({ address });
  expect(nr.status).toBe(200);
  const vr = await agent.post('/api/auth/wallet/verify').send({ address, publicKey, signature: 'TEST' });
  expect(vr.status).toBe(200);
  const raw = vr.headers['set-cookie'].find(c=>c.startsWith('getty_wallet_session='));
  const cookie = raw.split(';')[0];
  return { cookie };
}

describe('Achievements meta persists via redis layer', () => {
  let app; let restore; let server; let agent;
  beforeAll(async () => {
    ({ app, restore } = freshServer({
      GETTY_MULTI_TENANT_WALLET: '1',
      GETTY_WALLET_AUTH_ALLOW_DUMMY: '1',
      GETTY_REQUIRE_SESSION: '1'
    }));
    if (app.startTestServer) server = await app.startTestServer();
    agent = request(server || app);
  });
  afterAll(done => { try { restore && restore(); } catch {} if (server) server.close(done); else done(); });

  test('meta not null after save then fresh GET (redis cache path)', async () => {
    const sess = await walletLogin(agent, 'M');

    const save = await agent.post('/api/achievements/config').set('Cookie', sess.cookie).send({ enabled: true, theme: 'light', position: 'top-left', claimid: 'claimABC' });
    expect(save.status).toBe(200);
    expect(save.body.meta).toBeTruthy();
    const v1 = save.body.meta.__version;

    const get2 = await agent.get('/api/achievements/config').set('Cookie', sess.cookie);
    expect(get2.status).toBe(200);
    expect(get2.body.meta).toBeTruthy();
    expect(get2.body.meta.__version).toBe(v1);
  });
});
