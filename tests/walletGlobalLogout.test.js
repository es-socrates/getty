const request = require('supertest');
const crypto = require('crypto');
const { freshServer } = require('./helpers/freshServer');
let appRef; let restoreHosted; let server;
beforeAll(async () => { ({ app: appRef, restore: restoreHosted } = freshServer({ GETTY_MULTI_TENANT_WALLET: '1', GETTY_WALLET_AUTH_ALLOW_DUMMY: '1' })); if (appRef.startTestServer) server = await appRef.startTestServer(); });
afterAll(done => { try { restoreHosted && restoreHosted(); } catch {} if (server) server.close(done); else done(); });

function pubKeyAndAddress() {
  const pub = crypto.randomBytes(4096/8);
  const hash = crypto.createHash('sha256').update(pub).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const pubB64Url = pub.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return { publicKey: pubB64Url, address: hash };
}

describe('Global wallet logout flow', () => {
  test('nonce -> verify -> logout clears cookie; revoke endpoint now Gone (410) in wallet-only mode', async () => {
    const { publicKey, address } = pubKeyAndAddress();

  const nr = await request(appRef)
      .post('/api/auth/wander/nonce')
      .send({ address })
      .expect(200);
    expect(nr.body).toHaveProperty('nonce');
    expect(nr.body).toHaveProperty('message');

  const vr = await request(appRef)
      .post('/api/auth/wander/verify')
      .send({ address, publicKey, signature: 'TEST' })
      .expect(200);
    expect(vr.body.success).toBe(true);
    const setCookies = vr.headers['set-cookie'] || [];
    const walletCookie = setCookies.find(c => c.startsWith('getty_wallet_session='));
    expect(walletCookie).toBeTruthy();

  const lg = await request(appRef)
      .post('/api/auth/wander/logout')
      .set('Cookie', walletCookie)
      .expect(200);
    expect(lg.body.success).toBe(true);
    const cleared = (lg.headers['set-cookie'] || []).find(c => c.startsWith('getty_wallet_session='));
    expect(cleared).toBeTruthy();

    expect(/getty_wallet_session=;/.test(cleared) || /Max-Age=0/.test(cleared) || /Expires=/i.test(cleared)).toBe(true);

  await request(appRef)
      .get('/api/auth/wander/me')
      .set('Cookie', walletCookie)
      .expect(200);

  await request(appRef)
      .get('/api/auth/wander/me')
      .expect(401);

  await request(appRef)
      .post('/api/session/revoke')
      .send({ scope: 'all' })
      .expect(res => {
        if (![404,410].includes(res.status)) throw new Error('expected 404 or 410');
      });
  });
});
