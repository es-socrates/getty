export function loadScriptOnce(src, id = '') {
  return new Promise((resolve, reject) => {
    try {
      if (id && document.getElementById(id)) return resolve();
      const existing = Array.from(document.scripts).some((s) => s.src && s.src.includes(src));
      if (existing && !id) return resolve();
      const el = document.createElement('script');
      if (id) el.id = id;
      el.src = src;
      el.async = true;
      el.onload = () => {
        try {
          const ev = new Event('DOMContentLoaded');
          document.dispatchEvent(ev);
        } catch {}
        resolve();
      };
      el.onerror = (e) => reject(e);
      document.head.appendChild(el);
    } catch (e) {
      reject(e);
    }
  });
}

export function markLoaded(key) {
  try {
    document.documentElement.setAttribute(`data-${key}-loaded`, '1');
  } catch (_) {}
}
