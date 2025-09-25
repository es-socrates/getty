const request = require('supertest');
const fs = require('fs');
const path = require('path');

const TMP_DIR = path.join(__dirname, 'tmp-ext-live-only');
const CONFIG_DIR = path.join(TMP_DIR, 'config');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

beforeAll(() => {
  ensureDir(CONFIG_DIR);

  const cfgFile = path.join(CONFIG_DIR, 'external-notifications-config.json');
  fs.writeFileSync(cfgFile, JSON.stringify({
    liveDiscordWebhook: 'https://discord.com/api/webhooks/TEST/ONLY_LIVE',
    template: 'Live: {from} {amount}'
  }, null, 2));
  process.env.GETTY_CONFIG_DIR = CONFIG_DIR;
  process.env.NODE_ENV = 'test';

  Object.keys(require.cache).forEach(k => {
    if (k.endsWith(path.sep + 'server.js')) delete require.cache[k];
    if (k.includes(path.sep + 'modules' + path.sep + 'external-notifications.js')) delete require.cache[k];
  });
});

afterAll(() => {
  try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch {}
});

describe('externalNotifications configured (live-only discord webhook)', () => {
  let app;
  beforeAll(() => {
    app = require('../server');
  });

  test('GET /api/modules marks externalNotifications.configured=true with live-only discord webhook', async () => {
  const res = await request(app).get('/api/modules?public=1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('externalNotifications');
    const mod = res.body.externalNotifications;
    expect(mod.configured).toBe(true);
    expect(mod.config).toBeDefined();
    expect(mod.config.hasLiveDiscord).toBe(true);
    expect(mod.config.hasDiscord).toBe(false);
    expect(mod.config.hasTelegram).toBe(false);
  });
});
