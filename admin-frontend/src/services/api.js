import axios from 'axios';

let __csrfToken = null;
let __csrfPromise = null;
let __lastFetchTs = 0;
let __csrfDisabled = false;

// eslint-disable-next-line no-undef
const __definedCsrfHeader = (typeof __GETTY_CSRF_HEADER__ !== 'undefined' && __GETTY_CSRF_HEADER__) || '';
const CSRF_HEADER = (__definedCsrfHeader || (globalThis.process && globalThis.process.env && globalThis.process.env.VITE_GETTY_CSRF_HEADER) || 'x-csrf-token').toLowerCase();
const CSRF_MAX_AGE_MS = 1000 * 60 * 30;

async function fetchCsrfToken(force = false) {
  if (__csrfDisabled) return null;
  if (!force && __csrfToken && (Date.now() - __lastFetchTs) < CSRF_MAX_AGE_MS) return __csrfToken;
  if (__csrfPromise && !force) return __csrfPromise;
  const fullUrl = ((typeof window !== 'undefined' && window.API_BASE) || '') + '/api/admin/csrf';
  __csrfPromise = fetch(fullUrl, { credentials: 'include' })
    .then(r => {
      if (r.ok) return r.json();

      if ([401,403,404].includes(r.status)) {
        __csrfDisabled = true;
        return Promise.reject(new Error('csrf_disabled'));
      }
      return Promise.reject(new Error('csrf_fetch_failed'));
    })
    .then(j => {
      if (j && typeof j.csrfToken === 'string') {
        __csrfToken = j.csrfToken;
        __lastFetchTs = Date.now();
        return __csrfToken;
      }
      throw new Error('csrf_missing_token');
    })
    .catch(e => {
      if (e && e.message === 'csrf_disabled') {
        if (!shouldSuppressCsrfLogs()) {
          try { console.warn('[csrf] disabled (no route or no admin session) – suppressing further attempts'); } catch {}
        }
      } else if (!shouldSuppressCsrfLogs()) {
        console.error('[csrf] failed to fetch token', e.message || e);
      }
      __csrfToken = null;
      return null;
    })
    .finally(() => { __csrfPromise = null; });
  return __csrfPromise;
}

const api = axios.create({ baseURL: (typeof window !== 'undefined' && window.API_BASE) || '/' });

function shouldSuppressCsrfLogs() {
  try {
    let env = (globalThis.process && globalThis.process.env && globalThis.process.env.NODE_ENV) || undefined;
    // eslint-disable-next-line no-undef
    const verboseDefined = (typeof __GETTY_VERBOSE_CSRF__ !== 'undefined' && __GETTY_VERBOSE_CSRF__);
    const flag = (verboseDefined || (globalThis.process && globalThis.process.env && globalThis.process.env.VITE_GETTY_VERBOSE_CSRF));
    if (flag === '1' || flag === 'true') return false;
    return env === 'test';
  } catch { return false; }
}

api.interceptors.request.use(async (config) => {
  try {
    const method = (config.method || 'get').toLowerCase();
    const unsafe = ['post','put','patch','delete'].includes(method);
    if (unsafe && !__csrfDisabled) {
      if (!__csrfToken) await fetchCsrfToken();
      if (__csrfToken) {
        config.headers = config.headers || {};

        config.headers[CSRF_HEADER] = __csrfToken;
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
        const originalConfig = err.config || {};
        if (!originalConfig.__csrfRetried) {
          __csrfToken = null;
          await fetchCsrfToken(true);
            originalConfig.__csrfRetried = true;
          try {
            return await api.request({ ...originalConfig });
          } catch {

          }
        } else {
          __csrfToken = null;
          await fetchCsrfToken(true);
        }
      }
    } catch {}
    if (!shouldSuppressCsrfLogs()) {
      console.error('API error', err?.response?.data || err.message);
    }
    return Promise.reject(err);
  }
);

export function isAdminRequiredError(e) {
  try { return (e?.response?.data?.error === 'admin_required'); } catch { return false; }
}

export function isCsrfSoftDisabled() { return __csrfDisabled; }

export default api;

export async function fetchJson(url, opts = {}) {
  const { method = 'GET', body, headers = {}, raw = false } = opts;
  const finalHeaders = { ...headers };
  let payload = body;
  if (body && typeof body === 'object' && !(body instanceof FormData) && !headers['Content-Type']) {
    finalHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  try {
    const unsafe = ['post','put','patch','delete'];
    if (unsafe.includes(method.toLowerCase()) && __csrfToken) {
      finalHeaders[CSRF_HEADER] = __csrfToken;
    }
  } catch { /* noop */ }
  const fullUrl = ((typeof window !== 'undefined' && window.API_BASE) || '') + url;
  const res = await fetch(fullUrl, { method, body: payload, headers: finalHeaders, credentials: 'include' });
  if (!res.ok) {
    let bodyText = '';
    let parsed = null;
    try { bodyText = await res.text(); } catch {}
    try { parsed = bodyText ? JSON.parse(bodyText) : null; } catch { parsed = null; }
    const errCode = parsed && (parsed.error || parsed.code);

    if (res.status === 401 && url.includes('/api/auth/wander/me')) {
      if (raw) return res;
      return parsed || { error: errCode || 'unauthorized' };
    }
    
    if (errCode === 'legacy_removed' && parsed && parsed.mode === 'wallet_only') {
      try { window.dispatchEvent(new CustomEvent('getty:legacy-removed-wallet-only')); } catch {}
    }
    if (res.status === 401) {
      if (errCode === 'bad_signature') {
        try { window.dispatchEvent(new CustomEvent('getty:wallet-bad-signature', { detail: { url } })); } catch {}
      } else {
        try { window.dispatchEvent(new CustomEvent('getty:wallet-session-stale')); } catch {}
      }
    } else if (errCode === 'bad_signature') {
      try { window.dispatchEvent(new CustomEvent('getty:wallet-bad-signature', { detail: { url } })); } catch {}
    }
    const err = new Error(errCode || bodyText || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = errCode;
    throw err;
  }
  if (raw) return res;
  try { return await res.json(); } catch { return {}; }
}
