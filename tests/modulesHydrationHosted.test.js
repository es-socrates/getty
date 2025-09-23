const request = require('supertest');

process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.GETTY_REQUIRE_SESSION = '1';
process.env.NODE_ENV = 'test';

const ADMIN_NS = 'admintest123';
const PUB_NS = 'pubtest123';

global.__lastAdminNamespace = ADMIN_NS;
global.__lastPublicNamespace = PUB_NS;

let app; let store;

describe('Modules hydration in hosted mode', () => {
  beforeAll(async () => {

    const srv = require('../server');
    app = srv.app || srv;
    store = app.get('store');
    if (!store) throw new Error('Store not found on app');

  await store.set(ADMIN_NS, 'adminToken', ADMIN_NS);

    await store.setConfig(ADMIN_NS, 'tip-goal-config.json', {
      walletAddress: 'WALLET_ADMIN_ABC',
      monthlyGoal: 8,
      currentAmount: 4,
      theme: 'modern'
    });

    await store.setConfig(PUB_NS, 'last-tip-config.json', {
      walletAddress: 'WALLET_PUBLIC_DEF',
      title: 'Latest Donation'
    });
  });

  test('GET /api/modules returns hydrated wallets & progress', async () => {
    const res = await request(app)
      .get('/api/modules')

      .set('Cookie', [`getty_admin_token=${ADMIN_NS}`]);

    expect(res.status).toBe(200);
    const body = res.body || {};

    // eslint-disable-next-line no-console
    console.log('[DEBUG modules payload]', JSON.stringify(body, null, 2));
    expect(body.tipGoal).toBeDefined();
    expect(body.tipGoal.walletAddress).toBe('WALLET_ADMIN_ABC');

    expect(body.tipGoal.monthlyGoal).toBe(8);
    expect(body.tipGoal.currentAmount).toBe(4);
    if (typeof body.tipGoal.progress === 'number') {
      expect(Math.round(body.tipGoal.progress)).toBe(50);
    }

    expect(body.lastTip).toBeDefined();
  const ltWallet = body.lastTip.walletAddress;

  const effLtWallet = (typeof ltWallet === 'object' && ltWallet && ltWallet.walletAddress) ? ltWallet.walletAddress : ltWallet;
  expect(typeof effLtWallet).toBe('string');
  expect(effLtWallet.length).toBeGreaterThan(0);

    expect(body.tipWidget).toBeDefined();
    const twWallet = body.tipWidget.walletAddress;
    const effTwWallet = (typeof twWallet === 'object' && twWallet && twWallet.walletAddress) ? twWallet.walletAddress : twWallet;
    expect(typeof effTwWallet).toBe('string');
    expect(effTwWallet.length).toBeGreaterThan(0);
  });
});
