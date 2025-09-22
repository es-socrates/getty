const fs = require('fs');
const path = require('path');
const { freshServer } = require('./helpers/freshServer');


describe('Last Tip persistence', () => {
  let appRef; let restore; let server;

  beforeAll(async () => {
    ({ app: appRef, restore } = freshServer({
      GETTY_REQUIRE_SESSION: '0',
      GETTY_SILENCE_REDIS_TEST: '1'
    }));
    server = await appRef.startTestServer();
  });

  afterAll(done => { try { restore && restore(); } catch {} if (server) server.close(done); else done(); });

  it('persists last donation cache across process restart simulation', async () => {
    const configPath = path.join(process.cwd(), 'config', 'last-tip-config.json');
    fs.writeFileSync(configPath, JSON.stringify({ walletAddress: 'TEST_WALLET_PERSIST' }, null, 2));

    const lastTipModule = require('../modules/last-tip');

    const lt = new lastTipModule({ clients: new Set() });
    lt.walletAddress = 'TEST_WALLET_PERSIST';
    lt.lastDonation = { from: 'Tester', amount: '1.234', txId: 'FAKE_TX_1', timestamp: Math.floor(Date.now()/1000) };
    lt.saveDonationCache();

    const lt2 = new lastTipModule({ clients: new Set() });
    lt2.walletAddress = 'TEST_WALLET_PERSIST';
    const cached = lt2.getLastDonation();
    expect(cached).toBeTruthy();
    expect(cached.txId).toBe('FAKE_TX_1');
  });
});
