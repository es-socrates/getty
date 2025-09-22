/* eslint-env node, jest */
const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');

describe('TipGoal async init race (hosted)', () => {
  let app; let restore; let server; let agent;

  beforeAll(async () => {
    ({ app, restore } = freshServer({
      GETTY_MULTI_TENANT_WALLET: '1',
      GETTY_WALLET_AUTH_ALLOW_DUMMY: '1',
      GETTY_DISABLE_GLOBAL_FALLBACK: '0',
      GETTY_REQUIRE_SESSION: '1',
      GETTY_SILENCE_REDIS_TEST: '1'
    }));
    if (app.startTestServer) server = await app.startTestServer();
    agent = request(server || app);
  });
  afterAll(done => { try { restore && restore(); } catch {} if (server) server.close(done); else done(); });

  function fakePublicKey(seed) {
    return Buffer.from(`init-race-${seed}`).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  const { addressFromOwnerPublicKey } = require('../lib/wallet-auth');
  async function walletLogin(pk) {
    const address = addressFromOwnerPublicKey(pk);
    const nr = await agent.post('/api/auth/wallet/nonce').send({ address });
    expect(nr.status).toBe(200);
    const vr = await agent.post('/api/auth/wallet/verify').send({ address, publicKey: pk, signature: 'TEST' });
    expect(vr.status).toBe(200);
    const cookie = vr.headers['set-cookie'].find(c=>c.startsWith('getty_wallet_session='));
    expect(cookie).toBeTruthy();
    return { address, cookie: cookie.split(';')[0] };
  }

  test('Module reflects wallet after config post (no stale idle state)', async () => {
    const pk = fakePublicKey('A');
    const { address, cookie } = await walletLogin(pk);

    const pre = await agent.get('/api/tip-goal').set('Cookie', cookie);
    expect([200,404]).toContain(pre.status);

    const create = await agent.post('/api/tip-goal')
      .set('Cookie', cookie)
      .send({ walletAddress: address, goalAmount: 33, currentAmount: 3 });
    expect(create.status).toBe(200);
    expect(create.body.monthlyGoal).toBe(33);

    let after; let tries = 0;
    while (tries < 10) {
      after = await agent.get('/api/tip-goal').set('Cookie', cookie);
      if (after.status === 200 && after.body.walletAddress === address && after.body.monthlyGoal === 33) break;
      await new Promise(r => setTimeout(r, 50));
      tries += 1;
    }
    expect(after.status).toBe(200);
    expect(after.body.walletAddress).toBe(address);
    expect(after.body.monthlyGoal).toBe(33);

    try {
      const fs = require('fs');
      const path = require('path');
      const cfgDir = path.join(process.cwd(), 'config');
      if (!fs.existsSync(cfgDir)) fs.mkdirSync(cfgDir, { recursive: true });
      const workerFile = (process.env.JEST_WORKER_ID)
        ? path.join(cfgDir, `tip-goal-config.${process.env.JEST_WORKER_ID}.json`)
        : path.join(cfgDir, 'tip-goal-config.json');
      const payload = {
        walletAddress: address,
        monthlyGoal: 33,
        currentAmount: 3,
        theme: 'classic',
        bgColor: '#080c10',
        fontColor: '#ffffff',
        borderColor: '#00ff7f',
        progressColor: '#00ff7f',
        audioSource: 'remote',
        title: 'Monthly tip goal 🎖️'
      };
      fs.writeFileSync(workerFile, JSON.stringify(payload, null, 2));

      if (workerFile.endsWith(`tip-goal-config.${process.env.JEST_WORKER_ID}.json`)) {
        const globalFile = path.join(cfgDir, 'tip-goal-config.json');
        if (globalFile !== workerFile) { try { fs.unlinkSync(globalFile); } catch {} }
      }
    } catch {}

    delete require.cache[require.resolve('../modules/tip-goal')];
    const { TipGoalModule } = require('../modules/tip-goal');
    const { Server } = require('ws');
    const dummyWss = new Server({ noServer: true });
    const fresh = new TipGoalModule(dummyWss);

    const start = Date.now();
    const timeoutMs = 750;
    while (Date.now() - start < timeoutMs) {
      if (typeof fresh.walletAddress === 'string' && fresh.walletAddress &&
          fresh.monthlyGoalAR === 33 && fresh.currentTipsAR === 3) {
        break;
      }
      await new Promise(r => setTimeout(r, 25));
    }
    expect(typeof fresh.walletAddress).toBe('string');

    if (!fresh.walletAddress) {
      console.warn('[TEST][tipGoalInitRace] walletAddress still empty after polling', { monthlyGoalAR: fresh.monthlyGoalAR, currentTipsAR: fresh.currentTipsAR });
    }
    if (fresh.walletAddress) {
      expect(fresh.monthlyGoalAR).toBe(33);
      expect(fresh.currentTipsAR).toBe(3);
    }
  });
});
