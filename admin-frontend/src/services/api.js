import axios from 'axios';

const api = axios.create({ baseURL: '/' });

api.interceptors.response.use(
  r => r,
  err => {
    try {
      const code = err?.response?.data?.error || err?.response?.data?.code;
      if (code === 'admin_required') {
        try {
          const ev = new CustomEvent('getty:admin-required');
          window.dispatchEvent(ev);
        } catch {}
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
