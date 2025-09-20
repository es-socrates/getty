const request = require('supertest');
const app = require('../server');

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
      const res = await request(app).get(ep).set('Accept','application/json');
      expect([410,404]).toContain(res.status);
      if (res.status === 410) {
        expect(res.body).toHaveProperty('error');
        expect(String(res.body.error)).toMatch(/legacy_removed|legacy_disabled/);
      }
    }
  });
});
