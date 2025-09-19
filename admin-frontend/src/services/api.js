import axios from 'axios';

let __csrfToken = null;
let __csrfPromise = null;
let __lastFetchTs = 0;
const CSRF_HEADER = (import.meta.env?.VITE_GETTY_CSRF_HEADER || 'x-csrf-token').toLowerCase();
const CSRF_MAX_AGE_MS = 1000 * 60 * 30;

async function fetchCsrfToken(force = false) {
  if (!force && __csrfToken && (Date.now() - __lastFetchTs) < CSRF_MAX_AGE_MS) return __csrfToken;
  if (__csrfPromise && !force) return __csrfPromise;
  __csrfPromise = fetch('/api/admin/csrf', { credentials: 'include' })
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
      console.error('[csrf] failed to fetch token', e.message || e);
      __csrfToken = null;
      return null;
    })
    .finally(() => { __csrfPromise = null; });
  return __csrfPromise;
}

const api = axios.create({ baseURL: '/' });

api.interceptors.request.use(async (config) => {
  try {
    const method = (config.method || 'get').toLowerCase();
    const unsafe = ['post','put','patch','delete'].includes(method);
    if (unsafe) {
      if (!__csrfToken) await fetchCsrfToken();
      if (__csrfToken) {
        config.headers = config.headers || {};

        if (!config.headers[CSRF_HEADER] && !config.headers[CSRF_HEADER.toLowerCase()]) {
          config.headers[CSRF_HEADER] = __csrfToken;
        }
      }
    }
  } catch {

  }
  return config;
});

api.interceptors.response.use(
  r => r,
  async err => {
    try {
      const code = err?.response?.data?.error || err?.response?.data?.code;
      if (code === 'admin_required') {
        try { window.dispatchEvent(new CustomEvent('getty:admin-required')); } catch {}
      }
      if (code === 'invalid_csrf') {

        await fetchCsrfToken(true);
      }
    } catch {}
    console.error('API error', err?.response?.data || err.message);
    return Promise.reject(err);
  }
);

export function isAdminRequiredError(e) {
  try { return (e?.response?.data?.error === 'admin_required'); } catch { return false; }
}

export default api;
