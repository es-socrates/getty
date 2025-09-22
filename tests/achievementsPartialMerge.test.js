const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');
const { addressFromOwnerPublicKey } = require('../lib/wallet-auth');

describe('Achievements config partial merge', () => {
  let appRef; let restore; let server; let agent;
  beforeAll(async () => {
    ({ app: appRef, restore } = freshServer({ GETTY_MULTI_TENANT_WALLET: '1', GETTY_WALLET_AUTH_ALLOW_DUMMY: '1', GETTY_REQUIRE_SESSION: '1' }));
    if (appRef.startTestServer) server = await appRef.startTestServer();
    agent = request(server || appRef);
  });
  afterAll(done => { try { restore && restore(); } catch {} if (server) server.close(done); else done(); });

  function fakePublicKey(seed) {
    return Buffer.from(`achievements-${seed}`).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }

  async function walletLogin(label='M') {
    const publicKey = fakePublicKey(label);
    const address = addressFromOwnerPublicKey(publicKey);
    const nr = await agent.post('/api/auth/wallet/nonce').send({ address });
    expect(nr.status).toBe(200);
    const vr = await agent.post('/api/auth/wallet/verify').send({ address, publicKey, signature: 'TEST' });
    expect(vr.status).toBe(200);
    const raw = vr.headers['set-cookie']?.find(c=>c.startsWith('getty_wallet_session='));
    expect(raw).toBeTruthy();
    const cookie = raw.split(';')[0];
    return { cookie };
  }

  test('partial POST preserves existing fields', async () => {
    const sess = await walletLogin();

    const basePayload = { enabled: true, theme: 'dark', position: 'bottom-left', claimid: 'claimBASE', color: '#123456', sound: { enabled: true, url: 'a.mp3', volume: 0.7 }, historySize: 15 };
    const save1 = await agent.post('/api/achievements/config').set('Cookie', sess.cookie).send(basePayload);
    expect(save1.status).toBe(200);
    expect(save1.body.data.theme).toBe('dark');
    expect(save1.body.data.sound.url).toBe('a.mp3');

    const partial = { theme: 'light', sound: { volume: 0.9 } };
    const save2 = await agent.post('/api/achievements/config').set('Cookie', sess.cookie).send(partial);
    expect(save2.status).toBe(200);

    const getNow = await agent.get('/api/achievements/config').set('Cookie', sess.cookie);
    expect(getNow.status).toBe(200);
    const cfg = getNow.body.data;

    expect(cfg.enabled).toBe(true);
    expect(cfg.position).toBe('bottom-left');

    expect(['', 'claimBASE']).toContain(cfg.claimid);
    expect(cfg.color).toBe('#123456');
    expect(cfg.historySize).toBe(15);

    expect(cfg.theme).toBe('light');
    expect(cfg.sound.enabled).toBe(true);
    expect(cfg.sound.url).toBe('a.mp3');
    expect(cfg.sound.volume).toBeCloseTo(0.9, 5);
  });
});
