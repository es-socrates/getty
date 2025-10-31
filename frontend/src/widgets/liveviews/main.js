import './liveviews.css';
import enTranslations from 'shared-i18n/en.json';
import esTranslations from 'shared-i18n/es.json';

const FALLBACK_TRANSLATIONS = {
  en: enTranslations,
  es: esTranslations
};

function normalizeLanguageCode(lang) {
  if (!lang || typeof lang !== 'string') return 'en';
  return lang.toLowerCase().split('-')[0] || 'en';
}

let currentLanguage = normalizeLanguageCode(document.documentElement?.lang || 'en');

function notify(message, type = 'error') {
  try {
    if (window.showAlert) return window.showAlert(message, type);
  } catch (e) {}
  try {
    const el = document.createElement('div');
    el.textContent = message;
    el.setAttribute('role', 'status');
    el.className = `lv-toast ${type === 'success' ? 'lv-toast-success' : 'lv-toast-error'}`;
    document.body.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 2500);
  } catch (err) {
    console.log(`[${type}]`, message);
  }
}

function t(key) {
  try {
    if (window.__i18n && typeof window.__i18n.t === 'function') return window.__i18n.t(key);
    if (window.languageManager && typeof window.languageManager.getText === 'function') {
      return window.languageManager.getText(key);
    }
  } catch (e) {}
  const lang = FALLBACK_TRANSLATIONS[currentLanguage] ? currentLanguage : 'en';
  const bundle = FALLBACK_TRANSLATIONS[lang] || {};
  if (bundle && Object.prototype.hasOwnProperty.call(bundle, key)) {
    return bundle[key];
  }
  if (lang !== 'en' && FALLBACK_TRANSLATIONS.en && Object.prototype.hasOwnProperty.call(FALLBACK_TRANSLATIONS.en, key)) {
    return FALLBACK_TRANSLATIONS.en[key];
  }
  return key;
}

if (!window.languageManager && window.__i18n && typeof window.__i18n.t === 'function') {
  window.languageManager = {
    getText: (k) => window.__i18n.t(k),
    updatePageLanguage: () => {
      renderLiveviewsUI();
    }
  };
}

function setCurrentLanguage(lang) {
  currentLanguage = normalizeLanguageCode(lang);
}

function refreshLanguageFromGlobals() {
  try {
    if (window.__i18n && typeof window.__i18n.current === 'string') {
      setCurrentLanguage(window.__i18n.current);
      return;
    }
  } catch (e) {}
  try {
    if (window.languageManager && typeof window.languageManager.current === 'string') {
      setCurrentLanguage(window.languageManager.current);
      return;
    }
  } catch (e) {}
}

const LIVEVIEWS_FONT_STACK = 'Roobert, Tajawal, Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';

const liveviewsState = {
  live: false,
  count: 0,
  labelIsCustom: false,
  customLabel: '',
  adminActive: false,
  adminCount: 0
};

function getViewerLabel() {
  if (liveviewsState.labelIsCustom && liveviewsState.customLabel.trim()) {
    return liveviewsState.customLabel;
  }
  return t('viewers');
}

function renderLiveviewsUI() {
  const liveButtonEl = document.getElementById('live-button') || document.querySelector('.live-button');
  if (liveButtonEl) {
    const key = liveviewsState.live ? 'liveNow' : 'notLive';
    if (liveButtonEl.getAttribute('data-i18n') !== key) {
      liveButtonEl.setAttribute('data-i18n', key);
    }
    liveButtonEl.textContent = t(key);
  }

  const liveviewsStatus = document.getElementById('liveviews-status');
  if (liveviewsStatus) {
    if (liveviewsState.adminActive) {
      const adminCount = typeof liveviewsState.adminCount === 'number' && !Number.isNaN(liveviewsState.adminCount)
        ? liveviewsState.adminCount
        : 0;
      liveviewsStatus.textContent = `${t('liveNow')}: ${adminCount} ${t('views')}`;
    } else {
      liveviewsStatus.textContent = t('notLive');
    }
  }

  const viewerCountEl = document.getElementById('viewer-count');
  if (viewerCountEl) {
    const count = typeof liveviewsState.count === 'number' && !Number.isNaN(liveviewsState.count)
      ? liveviewsState.count
      : 0;
    viewerCountEl.textContent = `${count} ${getViewerLabel()}`;
  }
}

if (typeof MutationObserver === 'function') {
  try {
    const langObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'lang') {
          try {
            const newLang = mutation.target?.getAttribute?.('lang');
            if (newLang) setCurrentLanguage(newLang);
          } catch (e) {}
          renderLiveviewsUI();
          break;
        }
      }
    });
    langObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  } catch (e) {}
}

function ensureLanguageHooks(attempts = 20) {
  try {
    if (window.__i18n && typeof window.__i18n.setLanguage === 'function' && !window.__i18n.__liveviewsHooked) {
      const originalSetLanguage = window.__i18n.setLanguage.bind(window.__i18n);
      window.__i18n.setLanguage = async function patchedSetLanguage(lang) {
        const result = await originalSetLanguage(lang);
        try {
          setCurrentLanguage(lang);
          renderLiveviewsUI();
        } catch (e) {}
        return result;
      };
      try { setCurrentLanguage(window.__i18n.current); } catch (e) {}
      window.__i18n.__liveviewsHooked = true;
    }
  } catch (e) {}

  try {
    if (window.languageManager && typeof window.languageManager.updatePageLanguage === 'function' && !window.languageManager.__liveviewsHooked) {
      const originalUpdate = window.languageManager.updatePageLanguage.bind(window.languageManager);
      window.languageManager.updatePageLanguage = function patchedUpdatePageLanguage(...args) {
        const result = originalUpdate(...args);
        try {
          refreshLanguageFromGlobals();
          renderLiveviewsUI();
        } catch (e) {}
        return result;
      };
      try { refreshLanguageFromGlobals(); } catch (e) {}
      window.languageManager.__liveviewsHooked = true;
    }
  } catch (e) {}

  if (
    attempts > 0 &&
    (!window.__i18n || !window.__i18n.__liveviewsHooked || !window.languageManager || !window.languageManager.__liveviewsHooked)
  ) {
    setTimeout(() => ensureLanguageHooks(attempts - 1), 100);
  }
}

ensureLanguageHooks();
refreshLanguageFromGlobals();

try {
  window.addEventListener('storage', (event) => {
    if (!event) return;
    if (event.key === 'getty-language' && typeof event.newValue === 'string' && event.newValue) {
      try {
        setCurrentLanguage(event.newValue);
        if (window.__i18n && typeof window.__i18n.setLanguage === 'function') {
          window.__i18n.setLanguage(event.newValue);
        }
      } catch (e) {}
    }
  });
} catch (e) {}

async function applyPreferredLanguage() {
  let preferred = '';
  try {
    const url = new URL(window.location.href);
    const qp = url.searchParams.get('lang') || url.searchParams.get('language');
    if (qp) preferred = qp;
  } catch (e) {}
  try {
    if (!preferred) {
      preferred = localStorage.getItem('getty-language') || localStorage.getItem('lang') || '';
      if (!preferred) {
        preferred = localStorage.getItem('language') || '';
      }
      if (!preferred) {
        preferred = localStorage.getItem('i18nextLng') || '';
      }
    }
  } catch (e) {}
  if (!preferred) {
    try {
      const cookieMatch = document.cookie.match(/(?:^|; )getty_lang=([^;]+)/);
      if (cookieMatch && cookieMatch[1]) {
        preferred = decodeURIComponent(cookieMatch[1]);
      }
    } catch (e) {}
  }
  if (!preferred) {
    try {
      const cookieMatch = document.cookie.match(/(?:^|; )lang=([^;]+)/);
      if (cookieMatch && cookieMatch[1]) {
        preferred = decodeURIComponent(cookieMatch[1]);
      }
    } catch (e) {}
  }
  try {
    console.debug('[Liveviews] preferred language candidate', preferred);
  } catch (e) {}
  if (!preferred) return;

  try {
    if (window.__i18n && typeof window.__i18n.setLanguage === 'function') {
      if (window.__i18n.current !== preferred) {
        await window.__i18n.setLanguage(preferred);
      }
      setCurrentLanguage(window.__i18n.current || preferred);
    } else if (window.languageManager && typeof window.languageManager.setLanguage === 'function') {
      if (window.languageManager.current !== preferred) {
        await window.languageManager.setLanguage(preferred);
      }
      setCurrentLanguage(window.languageManager.current || preferred);
    }
  } catch (e) {}
}

function getNonce() {
  try {
    const meta = document.querySelector('meta[property="csp-nonce"]');
    return (meta && (meta.nonce || meta.getAttribute('nonce'))) || document.head?.dataset?.cspNonce || '';
  } catch (e) {
    return '';
  }
}

function ensureStyleTag(id) {
  let tag = document.getElementById(id);
  if (!tag) {
    tag = document.createElement('style');
    tag.id = id;
    const nonce = getNonce();
    if (nonce) tag.setAttribute('nonce', nonce);
    document.head.appendChild(tag);
  } else {
    try {
      const nonce = getNonce();
      if (nonce && !tag.getAttribute('nonce')) tag.setAttribute('nonce', nonce);
    } catch (e) {}
  }
  return tag;
}

function setLiveviewsVars({ bg, fg, font, sizePx }) {
  try {
    const tag = ensureStyleTag('liveviews-inline-vars');
    const declarations = [
      bg ? `--lv-bg:${bg};` : '',
      fg ? `--lv-fg:${fg};` : '',
      font ? `--lv-font:${font};` : '',
      sizePx ? `--lv-size-px:${sizePx};` : ''
    ]
      .filter(Boolean)
      .join('');
    tag.textContent = declarations ? `#viewer-count{${declarations}}` : '';
  } catch (e) {}
}

async function fetchLiveviewsConfig() {
  try {
    const res = await fetch('/config/liveviews-config.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('No config file');
    return await res.json();
  } catch (e) {
    return {
      bg: '#222222',
      color: '#ffffff',
      font: LIVEVIEWS_FONT_STACK,
      size: '32',
      icon: ''
    };
  }
}

function applyLiveviewsConfig(config) {
  liveviewsState.labelIsCustom = !!(config.viewersLabel && config.viewersLabel.trim());
  liveviewsState.customLabel = liveviewsState.labelIsCustom ? config.viewersLabel.trim() : '';
  if (typeof liveviewsState.count !== 'number' || Number.isNaN(liveviewsState.count)) {
    liveviewsState.count = 0;
  }

  const viewerCountEl = document.getElementById('viewer-count');
  if (viewerCountEl) {
    const sizePx = (config.size || '32').toString().endsWith('px') ? config.size : `${config.size}px`;
    setLiveviewsVars({ bg: config.bg, fg: config.color, font: config.font, sizePx });
  }

  renderLiveviewsUI();

  let iconEl = document.getElementById('liveviews-icon');

  const liveButtonEl = document.querySelector('.live-button');
  let iconSize = 40;
  if (liveButtonEl) {
    iconSize = liveButtonEl.offsetHeight;
  }

  if (!iconEl && config.icon && viewerCountEl && viewerCountEl.parentNode) {
    iconEl = document.createElement('img');
    iconEl.id = 'liveviews-icon';
    iconEl.className = 'liveviews-avatar';
    viewerCountEl.parentNode.insertBefore(iconEl, viewerCountEl);
  }
  if (iconEl && config.icon) {
    iconEl.src = config.icon;
    iconEl.classList.remove('hidden');
    iconEl.classList.add('liveviews-avatar');
    if (iconSize) {
      iconEl.style.width = `${iconSize}px`;
      iconEl.style.height = `${iconSize}px`;
    }
  } else if (iconEl) {
    iconEl.classList.add('hidden');
  }
}

async function fetchViewerCountAndDisplay(url) {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Network response was not ok: status ${response.status}, ${response.statusText}`);
    }
    const data = await response.json();
    try {
      console.log('[Liveviews] endpoint:', url);
      console.log('[Liveviews] API response:', data);
    } catch (e) {}

    let config = window._liveviewsConfigCache;
    if (!config) {
      try {
        const configRes = await fetch('/config/liveviews-config.json', { cache: 'no-cache' });
        if (configRes.ok) config = await configRes.json();
      } catch (e) {
        config = {};
      }
    }
    const bg = config && config.bg ? config.bg : '#222222';
    const color = config && config.color ? config.color : '#ffffff';
    const font = config && config.font ? config.font : LIVEVIEWS_FONT_STACK;
    const size = config && config.size ? config.size : '32';
    liveviewsState.labelIsCustom = !!(config && typeof config.viewersLabel === 'string' && config.viewersLabel.trim());
    liveviewsState.customLabel = liveviewsState.labelIsCustom ? config.viewersLabel.trim() : '';
    try {
      const sizePx = size.toString().endsWith('px') ? size : `${size}px`;
      setLiveviewsVars({ bg, fg: color, font, sizePx });
    } catch (e) {}
    const previousLive = liveviewsState.live;
    if (data && data.data && typeof data.data.ViewerCount !== 'undefined') {
      const nowLive = !!data.data.Live;
      liveviewsState.live = nowLive;
      liveviewsState.count = typeof data.data.ViewerCount === 'number' ? data.data.ViewerCount : 0;
      renderLiveviewsUI();
      if (previousLive !== nowLive) reportStreamState(nowLive, liveviewsState.count);
    } else if (data && data.data && typeof data.data.Live !== 'undefined') {
      const nowLive = !!data.data.Live;
      liveviewsState.live = nowLive;
      liveviewsState.count = 0;
      renderLiveviewsUI();
      if (previousLive !== nowLive) reportStreamState(nowLive, 0);
    } else {
      liveviewsState.live = false;
      liveviewsState.count = 0;
      renderLiveviewsUI();
      if (previousLive !== false) reportStreamState(false, 0);
    }
  } catch (error) {
    console.error('Error details:', error);
    const viewerCountEl = document.getElementById('viewer-count');
    const liveButtonEl = document.getElementById('live-button') || document.querySelector('.live-button');
    const liveviewsStatusEl = document.getElementById('liveviews-status');
    const config = window._liveviewsConfigCache || {};
    const bg = config && config.bg ? config.bg : '#222222';
    const color = config && config.color ? config.color : '#ffffff';
    const font = config && config.font ? config.font : LIVEVIEWS_FONT_STACK;
    const size = config && config.size ? config.size : '32';
    liveviewsState.labelIsCustom = !!(config && typeof config.viewersLabel === 'string' && config.viewersLabel.trim());
    liveviewsState.customLabel = liveviewsState.labelIsCustom ? config.viewersLabel.trim() : '';
    try {
      const sizePx = size.toString().endsWith('px') ? size : `${size}px`;
      setLiveviewsVars({ bg, fg: color, font, sizePx });
    } catch (e) {}
    const previousLive = liveviewsState.live;
    liveviewsState.live = false;
    liveviewsState.count = 0;
    if (viewerCountEl || liveButtonEl || liveviewsStatusEl) {
      renderLiveviewsUI();
    }
    if (previousLive !== false) reportStreamState(false);
  }
}

async function startViewerCountUpdates(url, interval = 10000) {
  await fetchViewerCountAndDisplay(url);
  setTimeout(() => startViewerCountUpdates(url, interval), interval);
}

function isValidUrl() {
  return true;
}

function validateIconSize(fileInput) {
  const file = fileInput.files[0];
  if (!file) return true;
  if (file.size > 1024 * 1024) {
    notify('The icon is too big. Maximum size: 1MB.', 'error');
    fileInput.value = '';
    return false;
  }
  return true;
}

window.addEventListener('DOMContentLoaded', async () => {
  await applyPreferredLanguage();
  try {
    console.debug('[Liveviews] current lang', window.__i18n && window.__i18n.current);
    console.debug('[Liveviews] liveNow translation', window.__i18n && window.__i18n.t ? window.__i18n.t('liveNow') : 'n/a');
  } catch (e) {}
  renderLiveviewsUI();

  function updateLiveviewsStatusAdmin(liveviews) {
    liveviewsState.adminActive = !!(liveviews && liveviews.active);
    liveviewsState.adminCount = typeof liveviews?.count === 'number' ? liveviews.count : 0;
    if (typeof liveviews?.count === 'number') {
      liveviewsState.count = liveviews.count;
    }
    const viewerCount = document.getElementById('viewer-count');
    if (viewerCount) {
      const config = window._liveviewsConfigCache || {};
      liveviewsState.labelIsCustom = !!(config && typeof config.viewersLabel === 'string' && config.viewersLabel.trim());
      liveviewsState.customLabel = liveviewsState.labelIsCustom ? config.viewersLabel.trim() : '';
      try {
        const sizePx = (config.size || '32').toString().endsWith('px')
          ? config.size || '32'
          : `${config.size || '32'}px`;
        setLiveviewsVars({
          bg: config.bg || '#222222',
          fg: config.color || '#ffffff',
          font: config.font || LIVEVIEWS_FONT_STACK,
          sizePx
        });
      } catch (e) {}
    }
    renderLiveviewsUI();
  }

  if (window.ws) {
    window.ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'liveviews_state') {
          updateLiveviewsStatusAdmin(msg);
        }
      } catch (e) {}
    });
  }

  async function updateLiveviewsStatusAdminFromAPI(url) {
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      try {
        console.log('[Liveviews Admin] endpoint:', url);
        console.log('[Liveviews Admin] API response:', data);
      } catch (e) {}
      if (data && data.data && typeof data.data.ViewerCount !== 'undefined') {
        updateLiveviewsStatusAdmin({ active: data.data.Live, count: data.data.ViewerCount });
      } else if (data && data.data && typeof data.data.Live !== 'undefined') {
        updateLiveviewsStatusAdmin({ active: data.data.Live, count: 0 });
      } else {
        updateLiveviewsStatusAdmin({ active: false, count: 0 });
      }
    } catch (e) {
      updateLiveviewsStatusAdmin({ active: false, count: 0 });
    }
  }

  function startAdminViewerCountUpdates(url, interval = 10000) {
    if (!url) return;
    updateLiveviewsStatusAdminFromAPI(url);
    setTimeout(() => startAdminViewerCountUpdates(url, interval), interval);
  }

  const config = await fetchLiveviewsConfig();
  window._liveviewsConfigCache = config;
  applyLiveviewsConfig(config);

  const claimidInput = document.getElementById('liveviews-claimid');
  if (claimidInput && config.claimid) claimidInput.value = config.claimid;
  const viewersLabelInput = document.getElementById('liveviews-viewers-label');
  if (viewersLabelInput && config.viewersLabel) viewersLabelInput.value = config.viewersLabel;

  const viewerCountInit = document.getElementById('viewer-count');
  if (viewerCountInit) {
    liveviewsState.labelIsCustom = !!(config.viewersLabel && config.viewersLabel.trim());
    liveviewsState.customLabel = liveviewsState.labelIsCustom ? config.viewersLabel.trim() : '';
    liveviewsState.count = 0;
    try {
      const sizePx = (config.size || '32').toString().endsWith('px')
        ? config.size || '32'
        : `${config.size || '32'}px`;
      setLiveviewsVars({
        bg: config.bg || '#222222',
        fg: config.color || '#ffffff',
        font: config.font || LIVEVIEWS_FONT_STACK,
        sizePx
      });
    } catch (e) {}
    renderLiveviewsUI();
  }

  const apiUrl = '/api/liveviews/status';

  startViewerCountUpdates(apiUrl);
  startAdminViewerCountUpdates(apiUrl);
  const iconInput = document.getElementById('liveviews-icon-input');
  if (iconInput) {
    const warning = document.createElement('div');
    warning.className = 'liveviews-warning';
    warning.innerText = 'The icon must weigh a maximum of 1MB.';
    iconInput.parentNode.insertBefore(warning, iconInput);
    iconInput.addEventListener('change', () => {
      validateIconSize(iconInput);
    });
  }

  const colorPickerIds = ['liveviews-bg-color', 'liveviews-font-color'];
  colorPickerIds.forEach((id) => {
    const el = document.getElementById(id);
    const hexLabel = document.getElementById(`${id}-hex`);
    if (el) {
      el.classList.add('color-picker');
      if (hexLabel) {
        hexLabel.textContent = el.value;
        el.addEventListener('input', () => {
          hexLabel.textContent = el.value;
        });
      }
    }
  });

  const widget = document.querySelector('.liveviews-widget');
  const liveButton = document.querySelector('.live-button');
  const viewerCount = document.getElementById('viewer-count');
  if (widget) {
    widget.classList.add('liveviews-flex-center');
  }
  if (liveButton && viewerCount) {
    liveButton.classList.add('mr-0');
    viewerCount.classList.add('ml-2p5');
  }

  renderLiveviewsUI();
});

function reportStreamState(isLive, viewers) {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token') || '';
    const endpoint = '/api/stream-history/event';
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        live: !!isLive,
        at: Date.now(),
        viewers: typeof viewers === 'number' ? viewers : undefined
      })
    }).catch(() => {});
  } catch (e) {}
}

async function loadLiveviewsViewersLabel() {
  const input = document.getElementById('liveviews-viewers-label');
  if (input) {
    try {
      const res = await fetch('/config/liveviews-config.json', { cache: 'no-cache' });
      if (res.ok) {
        const config = await res.json();
        if (config && typeof config.viewersLabel === 'string' && config.viewersLabel.trim()) {
          input.value = config.viewersLabel;
        }
      }
    } catch (e) {}
  }
}

async function saveLiveviewsViewersLabel() {
  const input = document.getElementById('liveviews-viewers-label');
  if (input) {
    const label = input.value || 'viewers';
    localStorage.setItem('liveviews-viewers-label', label);

    try {
      const res = await fetch('/api/save-liveviews-label', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ viewersLabel: label })
      });
      if (!res.ok) throw new Error('Could not save to backend');
    } catch (e) {
      notify('Error saving the label in the backend: ' + (e.message || e), 'error');
    }
  }
}

if (window.location.pathname.startsWith('/admin')) {
  document.addEventListener('DOMContentLoaded', async () => {
    await loadLiveviewsViewersLabel();

    const config = await fetchLiveviewsConfig();
    const iconPreview = document.getElementById('liveviews-icon-preview');
    const iconMeta = document.getElementById('liveviews-icon-meta');
    const removeBtn = document.getElementById('liveviews-remove-icon');
    if (config.icon && iconPreview) {
      iconPreview.innerHTML = `<img src="${config.icon}" alt="icon" class="liveviews-admin-preview">`;
      if (removeBtn) removeBtn.classList.remove('hidden');
      if (iconMeta) iconMeta.textContent = '';
    } else if (iconPreview) {
      iconPreview.innerHTML = '';
      if (removeBtn) removeBtn.classList.add('hidden');
      if (iconMeta) iconMeta.textContent = '';
    }

    if (removeBtn) {
      removeBtn.onclick = function () {
        iconPreview.innerHTML = '';
        if (iconMeta) iconMeta.textContent = '';
        if (iconInput) iconInput.value = '';
        removeBtn.classList.add('hidden');

        iconInput.dataset.remove = '1';
      };
    }

    const iconInput = document.getElementById('liveviews-icon-input');
    if (iconInput) {
      iconInput.addEventListener('change', (event) => {
        const file = event.target.files && event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (iconPreview) {
              iconPreview.innerHTML = `<img src="${e.target.result}" alt="icon" class="liveviews-admin-preview">`;
            }
          };
          reader.readAsDataURL(file);
          if (iconMeta) {
            iconMeta.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
          }
          if (removeBtn) removeBtn.classList.remove('hidden');
          iconInput.dataset.remove = '';
        } else {
          if (iconPreview) iconPreview.innerHTML = '';
          if (iconMeta) iconMeta.textContent = '';
          if (removeBtn) removeBtn.classList.add('hidden');
        }
      });
    }
  });

  document.getElementById('liveviews-save')?.addEventListener('click', async (e) => {
    e.preventDefault();
    let bg = document.getElementById('liveviews-bg-color')?.value;
    let color = document.getElementById('liveviews-font-color')?.value;
    let font = document.getElementById('liveviews-font-family')?.value;
    let size = document.getElementById('liveviews-size')?.value;
    let claimid = document.getElementById('liveviews-claimid')?.value;
    let viewersLabel = document.getElementById('liveviews-viewers-label')?.value;

    if (!bg) bg = '#222222';
    if (!color) color = '#ffffff';
    if (!font) font = LIVEVIEWS_FONT_STACK;
    if (!size) size = '32';
    if (!claimid) claimid = '';
    if (!viewersLabel) viewersLabel = 'viewers';
    const iconInput = document.getElementById('liveviews-icon-input');
    const iconFile = iconInput && iconInput.files && iconInput.files[0] ? iconInput.files[0] : null;
    const removeIcon = iconInput && iconInput.dataset.remove === '1';

    const formData = new FormData();
    formData.append('bg', bg);
    formData.append('color', color);
    formData.append('font', font);
    formData.append('size', size);
    formData.append('claimid', claimid);
    formData.append('viewersLabel', viewersLabel);
    if (iconFile) {
      formData.append('icon', iconFile);
    }
    if (removeIcon) {
      formData.append('removeIcon', '1');
    }

    try {
      const res = await fetch('/config/liveviews-config.json', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Could not save configuration');

      const saveBtn = document.getElementById('liveviews-save');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.classList.add('saved');
        const span = saveBtn.querySelector('span[data-i18n]');
        const oldText = span?.textContent;
        if (span) span.textContent = t('saved') || 'Saved!';
        setTimeout(() => {
          if (span && oldText) span.textContent = oldText;
          saveBtn.classList.remove('saved');
          saveBtn.disabled = false;
        }, 1500);
      }

      const newConfig = await fetchLiveviewsConfig();
      const iconPreview = document.getElementById('liveviews-icon-preview');
      const iconMeta = document.getElementById('liveviews-icon-meta');
      const removeBtn = document.getElementById('liveviews-remove-icon');
      if (newConfig.icon && iconPreview) {
        iconPreview.innerHTML = `<img src="${newConfig.icon}" alt="icon" class="liveviews-admin-preview">`;
        if (removeBtn) removeBtn.classList.remove('hidden');
        if (iconMeta) iconMeta.textContent = '';
      } else if (iconPreview) {
        iconPreview.innerHTML = '';
        if (removeBtn) removeBtn.classList.add('hidden');
        if (iconMeta) iconMeta.textContent = '';
      }
      if (iconInput) iconInput.value = '';
      if (iconInput) iconInput.dataset.remove = '';

      window._liveviewsConfigCache = newConfig;
      const claimidInput = document.getElementById('liveviews-claimid');
      if (claimidInput && newConfig.claimid) claimidInput.value = newConfig.claimid;
      const viewersLabelInput = document.getElementById('liveviews-viewers-label');
      if (viewersLabelInput && newConfig.viewersLabel) viewersLabelInput.value = newConfig.viewersLabel;
      const viewerCountSave = document.getElementById('viewer-count');
      if (viewerCountSave) {
        const label = newConfig.viewersLabel || 'viewers';
        const count = typeof newConfig.count === 'number' ? newConfig.count : 0;
        viewerCountSave.textContent = `${count} ${label}`;
        try {
          const sizePx = (newConfig.size || '32').toString().endsWith('px')
            ? newConfig.size || '32'
            : `${newConfig.size || '32'}px`;
          setLiveviewsVars({
            bg: newConfig.bg || '#222222',
            fg: newConfig.color || '#ffffff',
            font: newConfig.font || LIVEVIEWS_FONT_STACK,
            sizePx
          });
        } catch (err) {}
      }
    } catch (err) {
      notify('Error saving configuration: ' + (err.message || err), 'error');
    }
  });
}
