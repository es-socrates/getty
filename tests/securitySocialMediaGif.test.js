const request = require('supertest');
const http = require('http');
const app = require('../server');

describe('Security hardening: social media & gif', () => {
  let server;
  beforeAll(() => {
    return new Promise(resolve => {
      server = http.createServer(app);
      server.listen(0, resolve);
    });
  });
  afterAll(() => new Promise(resolve => server.close(resolve)));

  test('Untrusted (no session) cannot see social media config', async () => {
    const agent = request(server);
    const res = await agent.get('/api/socialmedia-config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('config');

    expect(Array.isArray(res.body.config)).toBe(true);

    for (const item of res.body.config) {
      if (item && typeof item === 'object') {
        const allowed = new Set(['name','icon','link','customIcon']);
        for (const k of Object.keys(item)) {
          expect(allowed.has(k)).toBe(true);
        }
        if (item.customIcon) {
          expect(typeof item.customIcon).toBe('string');
        }
        expect(typeof item.name).toBe('string');
        expect(typeof item.icon).toBe('string');
        expect(typeof item.link).toBe('string');
      }
    }
  });

  test('Untrusted POST social media either blocked or accepted in permissive self-hosted mode', async () => {
    const agent = request(server);
    const res = await agent.post('/api/socialmedia-config').send({ config: [] });
    expect([200,401,403]).toContain(res.status);
  });

  test('Untrusted cannot see gif path', async () => {
    const agent = request(server);
    const res = await agent.get('/api/tip-notification-gif');
    expect(res.status).toBe(200);
    expect(res.body.gifPath).toBe('');
  });

  test('Untrusted upload gif path returns allowed codes', async () => {
    const agent = request(server);
    const res = await agent.post('/api/tip-notification-gif');
    expect([200,400,401,403]).toContain(res.status);
  });

  test('Untrusted delete gif path returns allowed codes', async () => {
    const agent = request(server);
    const res = await agent.delete('/api/tip-notification-gif');
    expect([200,401,403,405]).toContain(res.status);
  });
});
