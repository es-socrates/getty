const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { freshServer } = require('./helpers/freshServer');
let appRef; let restoreBaseline;
beforeAll(() => { ({ app: appRef, restore: restoreBaseline } = freshServer({ REDIS_URL: null, GETTY_REQUIRE_SESSION: null, GETTY_ENFORCE_OWNER_WRITES: '0', GETTY_REQUIRE_ADMIN_WRITE: '0' })); });
afterAll(() => { try { restoreBaseline && restoreBaseline(); } catch {} });

const CONFIG_DIR = process.env.GETTY_CONFIG_DIR ? (path.isAbsolute(process.env.GETTY_CONFIG_DIR) ? process.env.GETTY_CONFIG_DIR : path.join(process.cwd(), process.env.GETTY_CONFIG_DIR)) : path.join(process.cwd(), 'config');
const CHAT_CONFIG_FILE = path.join(CONFIG_DIR, 'chat-config.json');

function readConfig() {
  if (fs.existsSync(CHAT_CONFIG_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(CHAT_CONFIG_FILE, 'utf8'));
      if (raw && typeof raw === 'object') {
        if (raw.data && typeof raw.data === 'object') return raw.data; // hybrid wrapper
        return raw;
      }
    } catch {}
    return {};
  }
  return {};
}

describe('Chat themeCSS API', () => {
  const existing = readConfig();
  const basePayload = {
    chatUrl: existing.chatUrl || 'wss://localhost',
    bgColor: '#000',
    msgBgColor: '#0a0e12'
  };

  test('persists clean themeCSS', async () => {
    const css = '.message { color: red; }';
    const res = await request(appRef).post('/api/chat').send({ ...basePayload, themeCSS: css });
    expect(res.status).toBe(200);
    const returnedCss = res.body.themeCSS || (res.body.data && res.body.data.themeCSS) || '';
    expect(returnedCss).toContain('color: red');
    const stored = readConfig();
    expect(stored.themeCSS).toContain('color: red');
  });

  test('sanitizes malicious constructs', async () => {
    const malicious = `@import url(https://evil); .a{color:blue;} div{expression(alert(1))} .b{background:url(javascript:alert(2))} <script>alert(3)</script>`;
    const res = await request(appRef).post('/api/chat').send({ ...basePayload, themeCSS: malicious });
    expect(res.status).toBe(200);
    const returned = res.body.themeCSS || (res.body.data && res.body.data.themeCSS) || '';
    expect(returned).not.toMatch(/@import/);
    expect(returned).not.toMatch(/expression\s*\(/i);
    expect(returned).not.toMatch(/javascript:/i);
    expect(returned).not.toMatch(/<script>/i);
    expect(returned).toMatch(/color:blue/);
  });

  test('rejects payload longer than 20000 and accepts trimmed version', async () => {
    const long = 'x'.repeat(21000);
    const resTooLong = await request(appRef).post('/api/chat').send({ ...basePayload, themeCSS: long });
    expect(resTooLong.status).toBe(400);
    const acceptable = 'x'.repeat(20000);
    const resOk = await request(appRef).post('/api/chat').send({ ...basePayload, themeCSS: acceptable });
    expect(resOk.status).toBe(200);
    const okCss = resOk.body.themeCSS || (resOk.body.data && resOk.body.data.themeCSS) || '';
    expect(okCss.length).toBe(20000);
  });
});
