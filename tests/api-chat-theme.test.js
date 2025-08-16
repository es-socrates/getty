const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../server');

const CHAT_CONFIG_FILE = path.join(process.cwd(), 'config', 'chat-config.json');

function readConfig() {
  if (fs.existsSync(CHAT_CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CHAT_CONFIG_FILE, 'utf8'));
  }
  return {};
}

describe('Chat themeCSS API', () => {
  const basePayload = {
    chatUrl: 'https://example.com/chat',
    bgColor: '#000',
    msgBgColor: '#111'
  };

  test('persists clean themeCSS', async () => {
    const css = '.message { color: red; }';
    const res = await request(app).post('/api/chat').send({ ...basePayload, themeCSS: css });
    expect(res.status).toBe(200);
    expect(res.body.themeCSS).toContain('color: red');
    const stored = readConfig();
    expect(stored.themeCSS).toContain('color: red');
  });

  test('sanitizes malicious constructs', async () => {
    const malicious = `@import url(https://evil); .a{color:blue;} div{expression(alert(1))} .b{background:url(javascript:alert(2))} <script>alert(3)</script>`;
    const res = await request(app).post('/api/chat').send({ ...basePayload, themeCSS: malicious });
    expect(res.status).toBe(200);
    const returned = res.body.themeCSS;
    expect(returned).not.toMatch(/@import/);
    expect(returned).not.toMatch(/expression\s*\(/i);
    expect(returned).not.toMatch(/javascript:/i);
    expect(returned).not.toMatch(/<script>/i);
    expect(returned).toMatch(/color:blue/);
  });

  test('rejects payload longer than 20000 and accepts trimmed version', async () => {
    const long = 'x'.repeat(21000);
    const resTooLong = await request(app).post('/api/chat').send({ ...basePayload, themeCSS: long });
    expect(resTooLong.status).toBe(400);
    const acceptable = 'x'.repeat(20000);
    const resOk = await request(app).post('/api/chat').send({ ...basePayload, themeCSS: acceptable });
    expect(resOk.status).toBe(200);
    expect(resOk.body.themeCSS.length).toBe(20000);
  });
});
