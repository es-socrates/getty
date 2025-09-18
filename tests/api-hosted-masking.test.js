const request = require('supertest');
const fs = require('fs');
const path = require('path');

let app;
const ORIGINAL_ENV = { ...process.env };

beforeAll(() => {

  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

  process.env.GETTY_REQUIRE_SESSION = '1';
  jest.resetModules();
  app = require('../server');
});

afterAll(() => {
  for (const k of Object.keys(process.env)) {
    if (!(k in ORIGINAL_ENV)) delete process.env[k];
  }
  for (const [k, v] of Object.entries(ORIGINAL_ENV)) process.env[k] = v;
  jest.resetModules();
});

const CHAT_CONFIG_FILE = path.join(process.cwd(), 'config', 'chat-config.json');
const LIVEVIEWS_CONFIG_FILE = path.join(process.cwd(), 'config', 'liveviews-config.json');

function readJson(file) {
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
  }
  return null;
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

describe('Hosted anonymous masking', () => {
  const origChat = readJson(CHAT_CONFIG_FILE);
  const origLive = readJson(LIVEVIEWS_CONFIG_FILE);

  afterAll(() => {
    try {
      if (origChat === null) fs.existsSync(CHAT_CONFIG_FILE) && fs.unlinkSync(CHAT_CONFIG_FILE);
      else writeJson(CHAT_CONFIG_FILE, origChat);
  } catch { /* ignore restore error */ }
    try {
      if (origLive === null) fs.existsSync(LIVEVIEWS_CONFIG_FILE) && fs.unlinkSync(LIVEVIEWS_CONFIG_FILE);
      else writeJson(LIVEVIEWS_CONFIG_FILE, origLive);
  } catch { /* ignore restore error */ }
  });

  test('GET /api/chat-config masks chatUrl and odyseeWsUrl when anonymous in hosted', async () => {
    writeJson(CHAT_CONFIG_FILE, {
      chatUrl: 'wss://example.com/chat?id=123',
      odyseeWsUrl: 'wss://odysee.example/ws',
      bgColor: '#111111',
      textColor: '#eeeeee',
      themeCSS: '.x{color:red;}'
    });

    const res = await request(app)
      .get('/api/chat-config')
      .set('X-Forwarded-For', '203.0.113.10');
    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
    expect(res.body.chatUrl).toBe('');
    expect(res.body.odyseeWsUrl).toBe('');
    expect(res.body.bgColor).toBe('#111111');
    expect(res.body.textColor).toBe('#eeeeee');
    expect(typeof res.body.themeCSS).toBe('string');
  });

  test('GET /config/liveviews-config.json masks claimid when anonymous in hosted', async () => {
    writeJson(LIVEVIEWS_CONFIG_FILE, {
      bg: '#fff',
      color: '#000',
      font: 'Arial',
      size: '28',
      icon: '',
      claimid: 'abcd1234efgh5678',
      viewersLabel: 'viewers'
    });

    const res = await request(app)
      .get('/config/liveviews-config.json')
      .set('X-Forwarded-For', '203.0.113.10');
    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
    expect(res.body.claimid).toBe('');
    expect(res.body.viewersLabel).toBe('viewers');
    expect(res.body.bg).toBe('#fff');
    expect(res.body.color).toBe('#000');
  });
});
