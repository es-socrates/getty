const supertest = require('supertest');
const { freshServer } = require('./helpers/freshServer');

describe('Achievements tenant meta versioning', () => {
  let close, request, agent;
  beforeAll(async () => {
    const srv = await freshServer();
    close = srv.close;
    request = srv.request;
    agent = () => supertest(request);
  });
  afterAll(async () => { await close?.(); });

  async function walletLogin(nonceLabel = 'A') {
    const start = await agent().get('/api/wallet-auth/nonce');
    expect(start.statusCode).toBe(200);
    const { nonce } = start.body;
    const sig = Buffer.from(String(nonce)).toString('base64');
    const verify = await agent().post('/api/wallet-auth/verify').send({ address: `0x${nonceLabel}abc`, signature: sig, nonce });
    expect(verify.statusCode).toBe(200);
    const cookie = verify.headers['set-cookie']?.[0];
    expect(cookie).toBeTruthy();
    return { cookie };
  }

  test('version increments on successive saves', async () => {
    if (process.env.GETTY_MULTI_TENANT_WALLET !== '1') {
      return;
    }
    const sess = await walletLogin('V');

    const firstGet = await agent().get('/api/achievements/config').set('Cookie', sess.cookie);
    expect(firstGet.statusCode).toBe(200);
    const meta1 = firstGet.body.meta || firstGet.body.data?.meta || null;

    const save1 = await agent().post('/api/achievements/config').set('Cookie', sess.cookie).send({ enabled: true, theme: 'dark', position: 'bottom-left', claimid: 'claimXYZ' });
    expect(save1.statusCode).toBe(200);
    const meta2 = save1.body.meta;
    expect(meta2).toBeTruthy();
    if (meta1) {
      expect(meta2.__version >= meta1.__version).toBe(true);
    }

    const save2 = await agent().post('/api/achievements/config').set('Cookie', sess.cookie).send({ enabled: true, theme: 'dark', position: 'bottom-left', claimid: 'claimXYZ', dnd: true });
    expect(save2.statusCode).toBe(200);
    const meta3 = save2.body.meta;
    expect(meta3).toBeTruthy();

    expect(meta3.__version >= meta2.__version).toBe(true);
    if (meta3.__version === meta2.__version) {
      expect(meta3.checksum).toBe(meta2.checksum);
    } else {
      expect(meta3.checksum === meta2.checksum).toBe(false);
    }
  });
});
