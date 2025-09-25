const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');

describe('Welcome landing flow', () => {
  let app;
  let restore;
  let store;

  beforeAll(() => {
    ({ app, restore } = freshServer({ REDIS_URL: '', GETTY_REQUIRE_SESSION: '0', GETTY_WELCOME_TEST_REDIRECT: '1' }));
    store = app.get('store');
    if (!store) throw new Error('Store not available');
  });

  afterAll(() => {
    try { restore && restore(); } catch {}
  });

  test('redirects to dashboard when widget token cookie is valid', async () => {
    const token = 'test-widget-token-123';
    await store.set(token, 'walletHash', 'hash-abc');

    const res = await request(app)
      .get('/')
      .set('Accept', 'text/html')
      .set('Cookie', [`getty_widget_token=${token}`]);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`/user/${encodeURIComponent(token)}`);
  });

  test('clears stale widget token cookie when mapping is missing', async () => {
    const res = await request(app)
      .get('/')
      .set('Accept', 'text/html')
      .set('Cookie', ['getty_widget_token=stale-token']);

    expect([200, 302]).toContain(res.status);
    const setCookie = res.headers['set-cookie'] || [];
    expect(setCookie.some((c) => /getty_widget_token=;/i.test(c))).toBe(true);
  });
});
