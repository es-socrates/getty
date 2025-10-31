import './achievements.css';

const root = document.getElementById('ach-root') || document.querySelector('[data-ach-embed]');
const isEmbed = !!(root && root.hasAttribute('data-ach-embed'));
const embedMaxItems = (() => {
  try {
    if (!root) return 50;
    const value = parseInt(root.getAttribute('data-ach-max') || '50', 10);
    return Number.isFinite(value) && value > 0 ? Math.min(200, Math.max(5, value)) : 50;
  } catch {
    return 50;
  }
})();

const qs = (selector, el = document) => el.querySelector(selector);
const h = (tag, cls) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
};

let i18n = { 'ach.widget.unlocked': 'Achievement unlocked', 'ach.widget.now': 'Now' };
let currentLang = 'en';

function sanitizeLangCode(code) {
  try {
    if (!code || typeof code !== 'string') return '';
    return code.toLowerCase().replace(/_/g, '-').split('-')[0];
  } catch {
    return '';
  }
}

function readCookie(name) {
  try {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]+)`));
    return match && match[1] ? decodeURIComponent(match[1]) : '';
  } catch {
    return '';
  }
}

async function detectPreferredLanguage() {
  let preferred = '';
  try {
    const url = new URL(window.location.href);
    preferred = url.searchParams.get('lang') || url.searchParams.get('language') || '';
  } catch {}
  if (!preferred) {
    try {
      preferred =
        localStorage.getItem('getty-language') ||
        localStorage.getItem('lang') ||
        localStorage.getItem('language') ||
        localStorage.getItem('i18nextLng') ||
        '';
    } catch {}
  }
  if (!preferred) preferred = readCookie('getty_lang');
  if (!preferred) preferred = readCookie('lang');
  if (!preferred) preferred = readCookie('language');
  if (!preferred) {
    try {
      preferred = navigator.language || (navigator.languages && navigator.languages[0]) || '';
    } catch {}
  }
  if (!preferred && document.documentElement && document.documentElement.lang) {
    preferred = document.documentElement.lang;
  }
  return sanitizeLangCode(preferred);
}

async function loadLang(forcedLang) {
  let lang = sanitizeLangCode(forcedLang);
  if (!lang) lang = await detectPreferredLanguage();
  if (!lang) {
    try {
      const response = await fetch('/api/language', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        lang = sanitizeLangCode(data && data.currentLanguage);
      }
    } catch {}
  }
  if (!lang) lang = 'en';

  try {
    const runtime = await fetch(`/shared-i18n/${lang}.json`, { cache: 'no-store' });
    if (runtime.ok) {
      i18n = await runtime.json();
      currentLang = lang;
      if (document.documentElement) document.documentElement.lang = lang;
      return;
    }
  } catch {}

  if (lang !== 'en') {
    try {
      const fallback = await fetch('/shared-i18n/en.json', { cache: 'no-store' });
      if (fallback.ok) {
        i18n = await fallback.json();
        currentLang = 'en';
        if (document.documentElement) document.documentElement.lang = 'en';
        return;
      }
    } catch {}
  }

  currentLang = 'en';
}

const t = (key, fallback) => (i18n && i18n[key]) || fallback || key;
const nowLabel = () => t('ach.widget.now', 'Now');

try {
  window.addEventListener('storage', (event) => {
    if (!event) return;
    if (event.key === 'getty-language' || event.key === 'lang' || event.key === 'language') {
      const next = sanitizeLangCode(event.newValue || '');
      if (next && next !== currentLang) {
        loadLang(next);
      }
    }
  });
} catch {}

let sharedAudio = { audioSource: 'remote', hasCustomAudio: false, enabled: true, volume: 0.5 };
const REMOTE_SOUND_URL = 'https://52agquhrbhkx3u72ikhun7oxngtan55uvxqbp4pzmhslirqys6wq.arweave.net/7oBoUPEJ1X3T-kKPRv3XaaYG97St4Bfx-WHktEYYl60';

async function loadSharedAudio() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const widgetToken = urlParams.get('token');
    const endpoint = widgetToken
      ? `/api/goal-audio-settings?widgetToken=${encodeURIComponent(widgetToken)}`
      : '/api/goal-audio-settings';
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      sharedAudio = {
        audioSource: data.audioSource || 'remote',
        hasCustomAudio: !!data.hasCustomAudio,
        enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
        volume:
          typeof data.volume === 'number' && data.volume >= 0 && data.volume <= 1
            ? data.volume
            : 0.5
      };
    }
  } catch {}
}

function resolveAchievementSound(urlFromCfg) {
  if (sharedAudio.audioSource === 'custom' && sharedAudio.hasCustomAudio) return '/api/goal-custom-audio';
  return urlFromCfg || REMOTE_SOUND_URL;
}

async function getAchievementAudioUrl(urlFromCfg) {
  const baseUrl = resolveAchievementSound(urlFromCfg);
  if (baseUrl === '/api/goal-custom-audio') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const widgetToken = urlParams.get('token');
      const endpoint = widgetToken
        ? `/api/goal-custom-audio?widgetToken=${encodeURIComponent(widgetToken)}`
        : '/api/goal-custom-audio';
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        return data.url;
      }
    } catch (error) {
      console.error('Error fetching custom audio URL:', error);
    }
  }
  return baseUrl;
}

const perceptual = (value) => Math.pow(value, 2);

async function playSound(urlFromCfg, volOverride) {
  try {
    if (!sharedAudio.enabled) return;
    const audioUrl = await getAchievementAudioUrl(urlFromCfg);
    const linear =
      typeof volOverride === 'number'
        ? Math.max(0, Math.min(1, volOverride))
        : typeof sharedAudio.volume === 'number'
          ? Math.max(0, Math.min(1, sharedAudio.volume))
          : 0.5;
    const effective = perceptual(linear);
    const audio = new Audio(audioUrl);
    audio.volume = effective;
    audio.play().catch(() => {});
  } catch {}
}

async function getJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`http ${response.status}`);
  return response.json();
}

let cfg = {
  enabled: true,
  theme: 'light',
  position: 'top-right',
  sound: { enabled: false, url: '', volume: 0.5 },
  dnd: false,
  historySize: 10
};
let queue = [];
let showing = false;

function applyPosition() {
  if (!root) return;
  if (isEmbed) {
    root.classList.add('ach-embed');
    return;
  }
  root.classList.remove('ach-pos-top-right', 'ach-pos-top-left', 'ach-pos-bottom-right', 'ach-pos-bottom-left');
  const map = {
    'top-right': 'ach-pos-top-right',
    'top-left': 'ach-pos-top-left',
    'bottom-right': 'ach-pos-bottom-right',
    'bottom-left': 'ach-pos-bottom-left'
  };
  root.classList.add(map[cfg.position] || 'ach-pos-top-right');
}

async function notify(item) {
  if (!cfg.enabled || cfg.dnd) return;
  if (!root) return;
  if (isEmbed) {
    const card = buildCard(item);
    if (root.firstChild) root.insertBefore(card, root.firstChild);
    else root.appendChild(card);
    if (cfg.sound && cfg.sound.enabled) await playSound(cfg.sound.url, cfg.sound.volume);
    try {
      trimEmbeddedOverflow();
    } catch {}
    return;
  }

  queue.push(item);
  if (!showing) flush();
}

async function flush() {
  if (!queue.length) {
    showing = false;
    return;
  }
  showing = true;
  const item = queue.shift();
  const card = buildCard(item);
  if (root) root.appendChild(card);
  if (cfg.sound && cfg.sound.enabled) await playSound(cfg.sound.url, cfg.sound.volume);
  const duration = 8000;
  setTimeout(() => {
    try {
      card.classList.add('ach-hide');
    } catch {}
    setTimeout(() => {
      try {
        card.remove();
      } catch {}
      flush();
    }, 260);
  }, duration);
}

function trophySvg() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 9a5 5 0 0 0 5-5h-5" />
      <path d="M7 9a5 5 0 0 1-5-5h5" />
    </svg>
  `;
}

function buildCard(item) {
  const card = h('div', `ach-card${cfg.theme === 'dark' ? ' dark' : ''}`);
  try {
    if (item && item.id) card.setAttribute('data-id', String(item.id));
  } catch {}
  const icon = h('div', 'ach-icon');
  icon.innerHTML = trophySvg();
  try {
    if (item && item.category) icon.setAttribute('data-cat', String(item.category));
  } catch {}
  const content = h('div', 'ach-content');
  const app = h('div', 'ach-app');
  app.textContent = t('ach.widget.unlocked', 'Achievement unlocked');
  const title = h('div', 'ach-title');
  const desc = h('div', 'ach-desc');
  const { titleKey, descKey } = item || {};
  const resolvedTitle = titleKey ? t(titleKey, item.title || 'Achievement') : item.title || 'Achievement';
  const resolvedDesc = descKey ? t(descKey, item.desc || '') : item.desc || '';
  title.textContent = resolvedTitle;
  desc.textContent = resolvedDesc;
  const time = h('div', 'ach-time');
  time.textContent = nowLabel();
  content.appendChild(app);
  content.appendChild(title);
  content.appendChild(desc);
  card.appendChild(icon);
  card.appendChild(content);
  card.appendChild(time);
  return card;
}

function trimEmbeddedOverflow() {
  if (!root) return;
  if (root.children && root.children.length > embedMaxItems) {
    fadeOutAndRemoveLast();
  }
}

function fadeOutAndRemoveLast() {
  const last = root && root.lastElementChild;
  if (!last) return;
  try {
    last.classList.add('ach-hide');
  } catch {}
  setTimeout(() => {
    try {
      last.remove();
    } catch {}
  }, 260);
}

let ws = null;
let currentNamespace = null;
let wsPortOverride = null;
let attemptedDevFallback = false;

function resolveSocketHost() {
  if (wsPortOverride) {
    return `${window.location.hostname}:${wsPortOverride}`;
  }
  return window.location.host;
}

async function getCurrentNamespace() {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/auth/wander/me', true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            const authData = JSON.parse(xhr.responseText);
            resolve(authData.walletHash || null);
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      }
    };
    xhr.onerror = function () {
      resolve(null);
    };
    xhr.send();
  });
}

async function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  let url = `${protocol}://${resolveSocketHost()}`;
  if (currentNamespace) {
    url += '/?ns=' + encodeURIComponent(currentNamespace);
  } else {
    url += '/';
  }

  try {
    ws = new WebSocket(url);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg && msg.type === 'achievement' && msg.data) {
          notify(msg.data);
        }
        if (msg && msg.type === 'achievement-clear' && msg.data && msg.data.id) {
          const clearId = String(msg.data.id);
          try {
            queue = queue.filter((it) => String(it?.id) !== clearId);
          } catch {}
          try {
            const nodes = root ? root.querySelectorAll('.ach-card[data-id]') : [];
            nodes && nodes.forEach && nodes.forEach((node) => {
              if (String(node.getAttribute('data-id')) === clearId) {
                try {
                  node.classList.add('ach-hide');
                } catch {}
                setTimeout(() => {
                  try {
                    node.remove();
                  } catch {}
                }, 260);
              }
            });
          } catch {}
        }
        if (msg && msg.type === 'goalAudioSettingsUpdate' && msg.data) {
          try {
            sharedAudio = {
              audioSource: msg.data.audioSource || sharedAudio.audioSource,
              hasCustomAudio: !!msg.data.hasCustomAudio,
              enabled: typeof msg.data.enabled === 'boolean' ? msg.data.enabled : sharedAudio.enabled,
              volume:
                typeof msg.data.volume === 'number' && msg.data.volume >= 0 && msg.data.volume <= 1
                  ? msg.data.volume
                  : sharedAudio.volume
            };
          } catch {}
        }
      } catch {}
    };
    ws.onopen = () => {};
    ws.onerror = () => {};
    ws.onclose = () => {
      try {
        if (
          import.meta.env.DEV &&
          !attemptedDevFallback &&
          !wsPortOverride &&
          window.location.port &&
          window.location.port !== (import.meta.env.VITE_BACKEND_PORT || '3000')
        ) {
          attemptedDevFallback = true;
          wsPortOverride = import.meta.env.VITE_BACKEND_PORT || '3000';
        }
      } catch {}
      setTimeout(connectWebSocket, 1000);
    };
  } catch {}
}

async function boot() {
  await loadLang();
  try {
    const response = await getJson('/api/achievements/config');
    cfg = response.data || cfg;
  } catch {}
  await loadSharedAudio();
  applyPosition();
  if (!root) return;

  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');
  if (tokenFromUrl) {
    currentNamespace = tokenFromUrl;
  } else {
    currentNamespace = await getCurrentNamespace();
  }

  try {
    const status = await getJson('/api/achievements/status');
    if (status && Array.isArray(status.notifications)) {
      const recent = status.notifications.slice(-Math.max(1, Math.min(cfg.historySize || 10, 20)));
      const previousSound = cfg.sound?.enabled;
      if (previousSound) cfg.sound.enabled = false;
      for (const notification of recent) {
        await notify(notification);
      }
      cfg.sound.enabled = !!previousSound;
    }
  } catch {}

  connectWebSocket();

  setInterval(async () => {
    const newNamespace = tokenFromUrl ? tokenFromUrl : await getCurrentNamespace();
    if (newNamespace !== currentNamespace) {
      try {
        console.log('Namespace changed, reconnecting WebSocket...');
      } catch {}
      currentNamespace = newNamespace;
      if (ws) {
        try {
          ws.close();
        } catch {}
        ws = null;
      }
      connectWebSocket();
    }
  }, 5000);
}

if (root) {
  boot();
}
