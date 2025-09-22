/* eslint-env jest */
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { freshServer } = require('./helpers/freshServer');
const { addressFromOwnerPublicKey } = require('../lib/wallet-auth');

function fakePublicKey(seed) {
  return Buffer.from(`live-draft-wrapper-${seed}`).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function walletLogin(agent, publicKey) {
  const address = addressFromOwnerPublicKey(publicKey);
  const nr = await agent.post('/api/auth/wallet/nonce').send({ address });
  expect(nr.status).toBe(200);
  const vr = await agent.post('/api/auth/wallet/verify').send({ address, publicKey, signature: 'TEST' });
  expect(vr.status).toBe(200);
  const raw = vr.headers['set-cookie'].find(c=>c.startsWith('getty_wallet_session='));
  expect(raw).toBeTruthy();
  const cookie = raw.split(';')[0];
  return { address, walletHash: vr.body.walletHash, cookie };
}

describe('live announcement draft tenant wrapper', () => {
  let app; let restore; let server;
  beforeAll(async () => {
    ({ app, restore } = freshServer({
      GETTY_MULTI_TENANT_WALLET: '1',
      GETTY_WALLET_AUTH_ALLOW_DUMMY: '1',
      GETTY_REQUIRE_SESSION: '1',
      GETTY_REQUIRE_ADMIN_WRITE: '0',
      GETTY_ENFORCE_OWNER_WRITES: '0',
      GETTY_SILENCE_REDIS_TEST: '1'
    }));
    if (app.startTestServer) server = await app.startTestServer();
  });
  afterAll(done => { try { restore && restore(); } catch {} if (server) server.close(done); else done(); });

  test('POST live draft persists wrapper & GET returns meta', async () => {
    const agent = () => request(app);
    const sess = await walletLogin(agent(), fakePublicKey('L1'));

    const draft = {
      title: 'My Live Title',
      description: 'Desc',
      channelUrl: 'https://odysee.com/@channel:abc/live',
      signature: 'Sig',
      auto: true,
      livePostClaimId: 'abcdef123456'
    };
    const r1 = await agent().post('/api/external-notifications/live/config')
      .set('Cookie', sess.cookie)
      .send(draft);
    expect(r1.status).toBe(200);
    expect(r1.body.success).toBe(true);

    if (r1.body.meta) {
      expect(r1.body.meta).toHaveProperty('__version');
      expect(r1.body.meta).toHaveProperty('checksum');
    }

    const tenantFile = path.join(process.cwd(), 'tenant', sess.walletHash, 'config', 'live-announcement-config.json');
    expect(fs.existsSync(tenantFile)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(tenantFile, 'utf8'));
    expect(raw).toHaveProperty('__version');
    expect(raw).toHaveProperty('checksum');
    expect(raw).toHaveProperty('data');
    expect(raw.data.title).toBe('My Live Title');

    const r2 = await agent().get('/api/external-notifications/live/config')
      .set('Cookie', sess.cookie);
    expect(r2.status).toBe(200);
    expect(r2.body.success).toBe(true);
    expect(r2.body.config.title).toBe('My Live Title');
    if (r2.body.meta) {
      expect(r2.body.meta).toHaveProperty('__version');
      expect(r2.body.meta).toHaveProperty('checksum');
    }
  });
});
