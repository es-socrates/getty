/* eslint-env jest */
if (!globalThis.importMetaShim) {
  globalThis.importMetaShim = { env: { VITE_GETTY_CSRF_HEADER: 'x-csrf-token' } };
  if (!globalThis.import) {
    try {
      Object.defineProperty(globalThis, 'import', { value: { meta: globalThis.importMetaShim } });
    } catch {
      // ignore
    }
  } else if (!globalThis.import.meta) {
    globalThis.import.meta = globalThis.importMetaShim;
  }
}

const api = require('./apiShim');
const AxiosMockAdapter = require('axios-mock-adapter');

const originalFetch = global.fetch;

function mockFetchSequence(responses) {
  let i = 0;
  global.fetch = jest.fn(async () => {
    const r = responses[i] || responses[responses.length - 1];
    i++;
    if (r.error) {
      return { ok: false, status: r.status || 500, json: async () => ({}) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ csrfToken: r.token })
    };
  });
}

describe('api CSRF handling', () => {
  let mock;
  // eslint-disable-next-line no-undef
  beforeEach(() => {
    if (api.resetCsrf) api.resetCsrf();
    if (originalFetch) global.fetch = originalFetch;
    mock = new AxiosMockAdapter(api);
  });
  // eslint-disable-next-line no-undef
  afterEach(() => {
    mock.reset();
    if (originalFetch) global.fetch = originalFetch;
  });

  test('adds csrf header on first unsafe POST after fetching token', async () => {
    mockFetchSequence([{ token: 't123' }]);
    mock.onPost('/api/announcement/settings').reply(config => {
      const hdr = config.headers || {};
      return hdr['x-csrf-token'] === 't123' ? [200, { ok: true }] : [400, { error: 'missing' }];
    });

    const r = await api.post('/api/announcement/settings', { a: 1 });
    expect(r.data.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('auto-retries once after invalid_csrf and succeeds transparently', async () => {
    mockFetchSequence([{ token: 'tokA' }, { token: 'tokB' }]);

    let callCount = 0;
    mock.onPost('/api/announcement/settings').reply(config => {
      callCount++;
      const hdr = config.headers || {};
      if (callCount === 1) {

        return [403, { error: 'invalid_csrf' }];
      }

      return hdr['x-csrf-token'] === 'tokB' ? [200, { ok: true }] : [403, { error: 'invalid_csrf' }];
    });

    const r = await api.post('/api/announcement/settings', { a: 2 });
    expect(r.data.ok).toBe(true);
    expect(callCount).toBe(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('concurrent unsafe posts share the same token fetch', async () => {
    mockFetchSequence([{ token: 'shared1' }]);

    mock.onPost('/api/chat').reply(200, { ok: 1 });
    mock.onPost('/api/raffle').reply(200, { ok: 2 });

    const [r1, r2] = await Promise.all([
      api.post('/api/chat', { m: 1 }),
      api.post('/api/raffle', { m: 2 })
    ]);

    expect(r1.data.ok).toBe(1);
    expect(r2.data.ok).toBe(2);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('does not refetch token within max age window', async () => {
    mockFetchSequence([{ token: 'fresh' }]);
    mock.onPost('/api/chat').reply(200, { ok: true });

    await api.post('/api/chat', { a: 1 });
    await api.post('/api/chat', { a: 2 });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('recovers when initial csrf fetch fails then invalid_csrf forces refresh', async () => {
    mockFetchSequence([{ error: true, status: 500 }, { token: 'good1' }]);

    let first = true;
    mock.onPost('/api/secure').reply(config => {
      const hdr = config.headers || {};
      if (first) { first = false; return [403, { error: 'invalid_csrf' }]; }
      return hdr['x-csrf-token'] === 'good1' ? [200, { ok: 'recovered' }] : [403, { error: 'invalid_csrf' }];
    });

    const r = await api.post('/api/secure', { z: 1 });
    expect(r.data.ok).toBe('recovered');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
