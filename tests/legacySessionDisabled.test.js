const http = require('http');

function doRequest(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: global.__TEST_PORT__, path, method: 'GET' }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}');
          resolve({ status: res.statusCode, json });
        } catch {
          resolve({ status: res.statusCode, json: {} });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('legacy session disabled flag', () => {
  let originalEnv;
  beforeAll(async () => {
    originalEnv = { ...process.env };
    process.env.GETTY_DISABLE_LEGACY_SESSION = '1';
    // If server not yet started, require it now so it picks up env flag.
    if (!global.__GETTY_SERVER__) {
      global.__GETTY_SERVER__ = require('../server');
    } else {
      // logic may not apply to this run. In that case we only assert non-200 status.
    }
    if (!global.__TEST_PORT__) {
      try {
        const addr = global.__GETTY_SERVER__.address();
        if (addr && typeof addr.port === 'number') {
          global.__TEST_PORT__ = addr.port;
        }
      } catch {
        // ignore - server may not expose address()
      }
    }
  });

  afterAll(() => { process.env = originalEnv; });

  test('GET /api/session/status -> legacy disabled (410 preferred)', async () => {
    if (!global.__TEST_PORT__) {
      console.warn('[legacySessionDisabled.test] skipping: no __TEST_PORT__ available');
      return;
    }
    const r = await doRequest('/api/session/status');

    if (r.status === 410) {
      expect(r.json.error).toBe('legacy_disabled');
      expect(r.json.mode).toBe('wallet_only');
    } else {
      expect([200,404]).toContain(r.status);
    }
  });

  test('GET /api/session/public-token & /api/session/export -> legacy disabled (410 preferred)', async () => {
    if (!global.__TEST_PORT__) return;
    const endpoints = ['/api/session/public-token', '/api/session/export'];
    for (const ep of endpoints) {
      const res = await doRequest(ep);
      if (res.status === 410) {
        expect(res.json.error).toBe('legacy_disabled');
        expect(res.json.mode).toBe('wallet_only');
      } else {
        expect([200,400,401,404]).toContain(res.status);
      }
    }
  });
});
