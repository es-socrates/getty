const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');
const { loadTenantConfig } = require('../lib/tenant-config');
let appRef; let restoreBaseline;

const CONFIG_DIR = process.env.GETTY_CONFIG_DIR ? process.env.GETTY_CONFIG_DIR : path.join(process.cwd(), 'config');
const CONFIG_PATH = path.join(CONFIG_DIR, 'chat-config.json');

async function readConfigFile() {
  const result = await loadTenantConfig({ ns: { admin: null } }, null, CONFIG_PATH, 'chat-config.json');
  return result;
}

describe('Chat config hybrid persistence', () => {
  let server; let agent;
  beforeAll(async () => {
    ({ app: appRef, restore: restoreBaseline } = freshServer({ REDIS_URL: null, GETTY_REQUIRE_SESSION: null, GETTY_ENFORCE_OWNER_WRITES: '0', GETTY_REQUIRE_ADMIN_WRITE: '0' }));
    if (appRef.startTestServer) {
      server = await appRef.startTestServer();
      agent = request(server);
    } else {
      agent = request(appRef);
    }
  });
  afterAll(done => { try { restoreBaseline && restoreBaseline(); } catch {} if (server) server.close(done); else done(); });

  test('creates wrapper and manages version as expected', async () => {
  try { if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH); } catch { /* ignore */ }

    const basePayload = {
      chatUrl: 'wss://relay.example/ws',
      odyseeWsUrl: 'https://odysee.com/$/api',
      bgColor: '#111111',
      msgBgColor: '#222222',
      msgBgAltColor: '#333333',
      borderColor: '#444444',
      textColor: '#555555',
      usernameColor: '#666666',
      usernameBgColor: '#777777',
      donationColor: '#888888',
      donationBgColor: '#999999',
      themeCSS: '.chat { color: #fff; }',
      avatarRandomBg: true
    };

    const res1 = await agent.post('/api/chat').send(basePayload);
    expect(res1.status).toBe(200);
    expect(res1.body).toHaveProperty('success', true);
    expect(res1.body).toHaveProperty('meta');
    const v1 = res1.body.meta.__version;
    const c1 = res1.body.meta.checksum;
    expect(typeof v1).toBe('number');
    expect(typeof c1).toBe('string');

    const onDisk1 = await readConfigFile();
    expect(onDisk1.meta).toHaveProperty('__version', v1);
    expect(onDisk1.meta).toHaveProperty('checksum', c1);
    expect(onDisk1).toHaveProperty('data');
    expect(onDisk1.data).toHaveProperty('chatUrl', basePayload.chatUrl);

    const res2 = await agent.post('/api/chat').send({ ...basePayload });
    expect(res2.status).toBe(200);
    expect(res2.body).toHaveProperty('success', true);
    expect(res2.body.meta.__version).toBe(v1);
    expect(res2.body.meta.checksum).toBe(c1);

    const res3 = await agent.post('/api/chat').send({ ...basePayload, bgColor: '#abcdef' });
    expect(res3.status).toBe(200);
    expect(res3.body).toHaveProperty('success', true);
    expect(res3.body.meta.__version).toBeGreaterThan(v1);
    expect(res3.body.meta.checksum).not.toBe(c1);
  });
});
