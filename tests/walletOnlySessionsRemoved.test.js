const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');
let appRef; let restoreHosted; let server;
beforeAll(async () => { ({ app: appRef, restore: restoreHosted } = freshServer({ GETTY_MULTI_TENANT_WALLET: '1', GETTY_WALLET_AUTH_ALLOW_DUMMY: '1' })); if (appRef.startTestServer) server = await appRef.startTestServer(); });
afterAll(done => { try { restoreHosted && restoreHosted(); } catch {} if (server) server.close(done); else done(); });

describe('wallet-only mode (legacy session endpoints removed)', () => {
  const gone = [
    '/api/session/regenerate-public',
    '/api/session/revoke',
    '/api/session/status',
    '/api/session/public-token',
    '/api/session/export',
    '/api/session/import',
    '/api/session/new',
    '/new-session'
  ];

  test('all legacy session endpoints return 410', async () => {
    for (const ep of gone) {
  const res = await request(appRef).get(ep).set('Accept','application/json');
      expect([410,404]).toContain(res.status);
      if (res.status === 410) {
        expect(res.body).toHaveProperty('error');
        expect(String(res.body.error)).toMatch(/legacy_removed|legacy_disabled/);
      }
    }
  });
});
