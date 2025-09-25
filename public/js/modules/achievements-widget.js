const root = document.getElementById('ach-root') || document.querySelector('[data-ach-embed]');
const isEmbed = !!(root && root.hasAttribute('data-ach-embed'));
const embedMaxItems = (() => {
  try {
    if (!root) return 50;
    const v = parseInt(root.getAttribute('data-ach-max') || '50', 10);
    return Number.isFinite(v) && v > 0 ? Math.min(200, Math.max(5, v)) : 50;
  } catch { return 50; }
})();

function qs(sel, el = document) { return el.querySelector(sel); }
function h(tag, cls) { const el = document.createElement(tag); if (cls) el.className = cls; return el; }
let __i18n = { 'ach.widget.unlocked': 'Achievement unlocked', 'ach.widget.now': 'Now' };
async function loadLang() {
  try {
    const r = await fetch('/api/language', { cache: 'no-store' });
    const j = await r.json();
    const lang = (j && j.currentLanguage) || 'en';
    const file = `/shared-i18n/${lang}.json`;
    const rr = await fetch(file, { cache: 'no-store' });
    if (rr.ok) { __i18n = await rr.json(); }
  } catch { /* keep defaults */ }
}
function t(key, fallback) { return (__i18n && __i18n[key]) || fallback || key; }
function nowLabel() { return t('ach.widget.now', 'Now'); }

let sharedAudio = { audioSource: 'remote', hasCustomAudio: false, enabled: true, volume: 0.5 };
const REMOTE_SOUND_URL = 'https://52agquhrbhkx3u72ikhun7oxngtan55uvxqbp4pzmhslirqys6wq.arweave.net/7oBoUPEJ1X3T-kKPRv3XaaYG97St4Bfx-WHktEYYl60';

async function loadSharedAudio() {
  try {
    const r = await fetch('/api/audio-settings', { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      sharedAudio = {
        audioSource: j.audioSource || 'remote',
        hasCustomAudio: !!j.hasCustomAudio,
        enabled: typeof j.enabled === 'boolean' ? j.enabled : true,
        volume: typeof j.volume === 'number' && j.volume >= 0 && j.volume <= 1 ? j.volume : 0.5,
      };
    }
  } catch {}
}

function resolveAchievementSound(urlFromCfg) {
  if (sharedAudio.audioSource === 'custom' && sharedAudio.hasCustomAudio) return '/api/custom-audio';

  return urlFromCfg || REMOTE_SOUND_URL;
}

async function getAchievementAudioUrl(urlFromCfg) {
  const baseUrl = resolveAchievementSound(urlFromCfg);
  if (baseUrl === '/api/custom-audio') {
    try {
      const response = await fetch(baseUrl);
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

function perceptual(vol) { return Math.pow(vol, 2); }

async function playSound(urlFromCfg, volOverride) {
  try {
    if (!sharedAudio.enabled) return;
    const audioUrl = await getAchievementAudioUrl(urlFromCfg);
    const linear = typeof volOverride === 'number'
      ? Math.max(0, Math.min(1, volOverride))
      : (typeof sharedAudio.volume === 'number' ? Math.max(0, Math.min(1, sharedAudio.volume)) : 0.5);
    const effective = perceptual(linear);
    const a = new Audio(audioUrl);
    a.volume = effective;
    a.play().catch(()=>{});
  } catch {}
}

async function getJson(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error('http '+r.status); return r.json(); }

let cfg = { enabled: true, theme: 'light', position: 'top-right', sound: { enabled: false, url: '', volume: 0.5 }, dnd: false, historySize: 10 };
let queue = [];
let showing = false;

function applyPosition() {
  if (!root) return;
  if (isEmbed) { root.classList.add('ach-embed'); return; }
  root.classList.remove('ach-pos-top-right','ach-pos-top-left','ach-pos-bottom-right','ach-pos-bottom-left');
  const map = { 'top-right':'ach-pos-top-right', 'top-left':'ach-pos-top-left', 'bottom-right':'ach-pos-bottom-right', 'bottom-left':'ach-pos-bottom-left' };
  root.classList.add(map[cfg.position] || 'ach-pos-top-right');
}

async function notify(item) {
  if (!cfg.enabled || cfg.dnd) {
    return;
  }
  if (isEmbed) {
    const card = buildCard(item);
    if (!root) {
      return;
    }
    if (root.firstChild) root.insertBefore(card, root.firstChild); else root.appendChild(card);
    if (cfg.sound && cfg.sound.enabled) await playSound(cfg.sound.url, cfg.sound.volume);
    try { trimEmbeddedOverflow(); } catch {}
    return;
  }

  queue.push(item);
  if (!showing) flush();
}async function flush() {
  if (!queue.length) { showing = false; return; }
  showing = true;
  const it = queue.shift();
  const card = buildCard(it);
  if (root) root.appendChild(card);
  if (cfg.sound && cfg.sound.enabled) await playSound(cfg.sound.url, cfg.sound.volume);
  const duration = 8000;
  setTimeout(() => {
    try { card.classList.add('ach-hide'); } catch {}
    setTimeout(() => { try { card.remove(); } catch {} flush(); }, 260);
  }, duration);
}

function iconLabelFor(cat) {
  return '🏆';
}

function trophySvg() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M8 21h8"/>
      <path d="M12 17v4"/>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/>
      <path d="M17 9a5 5 0 0 0 5-5h-5"/>
      <path d="M7 9a5 5 0 0 1-5-5h5"/>
    </svg>
  `;
}

function buildCard(it) {
  const card = h('div', 'ach-card' + (cfg.theme === 'dark' ? ' dark' : ''));
  try { if (it && it.id) card.setAttribute('data-id', String(it.id)); } catch {}
  const icon = h('div', 'ach-icon'); icon.innerHTML = trophySvg();
  try { if (it && it.category) icon.setAttribute('data-cat', String(it.category)); } catch {}
  const content = h('div', 'ach-content');
  const app = h('div', 'ach-app'); app.textContent = t('ach.widget.unlocked', 'Achievement unlocked');
  const title = h('div', 'ach-title');
  const desc = h('div', 'ach-desc');
  const titleKey = it.titleKey; const descKey = it.descKey;
  const resolvedTitle = titleKey ? t(titleKey, it.title || 'Achievement') : (it.title || 'Achievement');
  const resolvedDesc = descKey ? t(descKey, it.desc || '') : (it.desc || '');
  title.textContent = resolvedTitle;
  desc.textContent = resolvedDesc;
  const time = h('div', 'ach-time'); time.textContent = nowLabel();
  content.appendChild(app); content.appendChild(title); content.appendChild(desc);
  card.appendChild(icon); card.appendChild(content); card.appendChild(time);
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
  try { last.classList.add('ach-hide'); } catch {}
  setTimeout(() => { try { last.remove(); } catch {} }, 260);
}

async function boot() {
  try {
    const authResponse = await fetch('/api/auth/wander/me', { cache: 'no-store' });
    if (!authResponse.ok || authResponse.status !== 200) {
      console.log('User not authenticated, skipping achievements widget initialization');
      return;
    }
    const authData = await authResponse.json();
    if (!authData || !authData.address) {
      console.log('User not authenticated, skipping achievements widget initialization');
      return;
    }
  } catch (error) {
    console.log('Error checking authentication, skipping achievements widget initialization', error);
    return;
  }

  await loadLang();
  try { 
    const response = await getJson('/api/achievements/config');
    cfg = response.data || {};
  } catch {}
  await loadSharedAudio();
  applyPosition();

  try {
    const st = await getJson('/api/achievements/status');
    if (st && Array.isArray(st.notifications)) {
      const recent = st.notifications.slice(-Math.max(1, Math.min(cfg.historySize || 10, 20)));

      const old = cfg.sound?.enabled; if (old) cfg.sound.enabled = false;
      for (const n of recent) {
        await notify(n);
      }
      cfg.sound.enabled = !!old;
    }
  } catch {}

  connectWebSocket();

  setInterval(async () => {
    const currentNs = await getCurrentNamespace();
    if (currentNs !== currentNamespace) {
      console.log('Namespace changed, reconnecting WebSocket...');
      if (ws) {
        ws.close();
        ws = null;
      }
      connectWebSocket();
    }
  }, 5000);
}

let ws = null;
let currentNamespace = null;

async function getCurrentNamespace() {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/auth/wander/me', true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.onreadystatechange = function() {
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
    xhr.onerror = function() {
      resolve(null);
    };
    xhr.send();
  });
}

async function connectWebSocket() {
  currentNamespace = await getCurrentNamespace();

  let url = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host;
  if (currentNamespace) {
    url += '/?ns=' + encodeURIComponent(currentNamespace);
  } else {
    url += '/';
  }
  
  try {
    ws = new WebSocket(url);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg && msg.type === 'achievement' && msg.data) {
          notify(msg.data);
        } else {
        }
        if (msg && msg.type === 'achievement-clear' && msg.data && msg.data.id) {
          const clearId = String(msg.data.id);

          try { queue = queue.filter(it => String(it?.id) !== clearId); } catch {}

          try {
            const nodes = root ? root.querySelectorAll('.ach-card[data-id]') : [];
            nodes && nodes.forEach && nodes.forEach(node => {
              if (String(node.getAttribute('data-id')) === clearId) {
                try { node.classList.add('ach-hide'); } catch {}
                setTimeout(() => { try { node.remove(); } catch {} }, 260);
              }
            });
          } catch {}
        }
        if (msg && msg.type === 'audioSettingsUpdate' && msg.data) {
          try {
            sharedAudio = {
              audioSource: msg.data.audioSource || sharedAudio.audioSource,
              hasCustomAudio: !!msg.data.hasCustomAudio,
              enabled: typeof msg.data.enabled === 'boolean' ? msg.data.enabled : sharedAudio.enabled,
              volume: typeof msg.data.volume === 'number' && msg.data.volume >= 0 && msg.data.volume <= 1 ? msg.data.volume : sharedAudio.volume,
            };
          } catch {}
        }
      } catch (e) {
      }
    };
    ws.onopen = () => {
    };
    ws.onerror = () => {
    };
    ws.onclose = () => {
      setTimeout(connectWebSocket, 1000);
    };
  } catch {}
}

boot();
