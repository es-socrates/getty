/* eslint-disable no-undef */
const axios = require('axios');

let __csrfToken = null;
let __csrfPromise = null;
let __lastFetchTs = 0;
const CSRF_HEADER = (process.env.VITE_GETTY_CSRF_HEADER || 'x-csrf-token').toLowerCase();
const CSRF_MAX_AGE_MS = 1000 * 60 * 30;

async function fetchCsrfToken(force = false) {
  if (!force && __csrfToken && (Date.now() - __lastFetchTs) < CSRF_MAX_AGE_MS) return __csrfToken;
  if (__csrfPromise && !force) return __csrfPromise;
  __csrfPromise = global.fetch('/api/admin/csrf', { credentials: 'include' })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error('csrf_fetch_failed'))))
    .then(j => {
      if (j && typeof j.csrfToken === 'string') {
        __csrfToken = j.csrfToken;
        __lastFetchTs = Date.now();
        return __csrfToken;
      }
      throw new Error('csrf_missing_token');
    })
    .catch(e => {
      if (!shouldSuppressCsrfLogs()) {
        console.error('[csrf] failed to fetch token', e.message || e);
      }
      __csrfToken = null;
      return null;
    })
    .finally(() => { __csrfPromise = null; });
  return __csrfPromise;
}

const api = axios.create({ baseURL: '/' });

function shouldSuppressCsrfLogs() {
  try {
    const env = process.env.NODE_ENV;
    const verbose = process.env.VITE_GETTY_VERBOSE_CSRF;
    if (verbose === '1' || verbose === 'true') return false;
    return env === 'test';
  } catch { return false; }
}

api.interceptors.request.use(async (config) => {
  try {
    const method = (config.method || 'get').toLowerCase();
    const unsafe = ['post','put','patch','delete'].includes(method);
    if (unsafe) {
      if (!__csrfToken) await fetchCsrfToken();
      if (__csrfToken) {
        config.headers = config.headers || {};
        config.headers[CSRF_HEADER] = __csrfToken;
      }
    }
  } catch { /* swallow request interceptor errors */ }
  return config;
});

api.interceptors.response.use(
  r => r,
  async err => {
    try {
      const code = err?.response?.data?.error || err?.response?.data?.code;
      if (code === 'invalid_csrf') {
          const originalConfig = err.config || {};
          if (!originalConfig.__csrfRetried) {
            __csrfToken = null;
            await fetchCsrfToken(true);
            originalConfig.__csrfRetried = true;
            try { return await api.request({ ...originalConfig }); } catch { /* fallthrough */ }
          } else {
            __csrfToken = null;
            await fetchCsrfToken(true);
          }
      }
  } catch { /* swallow response interceptor errors */ }
    return Promise.reject(err);
  }
);

api.resetCsrf = function(){
  __csrfToken = null;
  __csrfPromise = null;
  __lastFetchTs = 0;
};

globalThis.__apiShim = api;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
