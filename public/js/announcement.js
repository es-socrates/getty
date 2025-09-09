const root = document.getElementById('announcement-root');
let currentTimeout = null;
let currentConfig = null;

function getNonce() {
  try {
    const m = document.querySelector('meta[property="csp-nonce"]');
    return (m && (m.nonce || m.getAttribute('nonce'))) || document.head?.dataset?.cspNonce || '';
  } catch { return ''; }
}
function ensureStyleTag(id) {
  let tag = document.getElementById(id);
  if (!tag) {
    tag = document.createElement('style');
    tag.id = id;
    const n = getNonce();
    if (n) tag.setAttribute('nonce', n);
    document.head.appendChild(tag);
  } else {
    try { const n = getNonce(); if (n && !tag.getAttribute('nonce')) tag.setAttribute('nonce', n); } catch {}
  }
  return tag;
}
function setAnnouncementVars({ bg, text }) {
  try {
    const tag = ensureStyleTag('announcement-inline-vars');
    const decls = [
      bg ? `--ann-bg-dynamic:${bg};` : '',
      text ? `--ann-text-dynamic:${text};` : ''
    ].filter(Boolean).join('');
    tag.textContent = decls ? `#announcement-root{${decls}}` : '';
  } catch {}
}

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c] || c));
}

function stripDangerous(html) {
  return html.replace(/<\/(?:script|style)[^>]*>/gi,'')
             .replace(/<(?:script|style)[^>]*>[\s\S]*?<\/(?:script|style)>/gi,'')
             .replace(/on[a-z]+="[^"]*"/gi,'');
}

function renderMarkdown(text) {
  let html = escapeHTML(text);
  html = html.replace(/\*\*(.+?)\*\*/g, (_,g1)=>'<strong>'+g1+'</strong>');
  html = html.replace(/\*(.+?)\*/g, (_,g1)=>'<em>'+g1+'</em>');
  html = html.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => {
    const safeLabel = escapeHTML(label);
    const safeUrl = url.replace(/"|'|\\/g,'');
  return '<a href="'+safeUrl+'" target="_blank" rel="noopener" class="ann-link">'+safeLabel+'</a>';
  });
  return stripDangerous(html);
}

const __clientFavCache = new Map();
async function ensureFavicon(linkUrl) {
  if (!linkUrl) return null;
  if (__clientFavCache.has(linkUrl)) return __clientFavCache.get(linkUrl);
  try {
    const res = await fetch('/api/announcement/favicon?url=' + encodeURIComponent(linkUrl));
    const data = await res.json();
    if (data && 'favicon' in data) {
      __clientFavCache.set(linkUrl, data.favicon);
      return data.favicon;
    }
  } catch {}
  __clientFavCache.set(linkUrl, null);
  return null;
}

async function showAnnouncement(msg) {
  if (!root) return;
  root.innerHTML = '';
  const wrapper = document.createElement('div');
  let variantClass = '';
  const mode = (msg.animationMode || (currentConfig && currentConfig.animationMode) || 'fade');
  const pick = () => {
    const variants = ['fade','slide-up','slide-left','scale'];
    return variants[Math.floor(Math.random()*variants.length)];
  };
  let resolved = mode === 'random' ? pick() : mode;
  if (resolved === 'slide-up') variantClass = 'ann-variant-slide-up';
  else if (resolved === 'slide-left') variantClass = 'ann-variant-slide-left';
  else if (resolved === 'scale') variantClass = 'ann-variant-scale';
  else variantClass = '';
  wrapper.className = 'announcement-message ' + (msg.theme === 'horizontal' ? 'horizontal ' : '') + variantClass;
  const textDiv = document.createElement('div');
  textDiv.className = 'ann-text';
  textDiv.innerHTML = renderMarkdown(msg.text);
  wrapper.appendChild(textDiv);
  if (msg.imageUrl) {
    const media = document.createElement('div');
    media.className = 'ann-media';
    const img = document.createElement('img');
    img.className = 'ann-image';
    img.src = msg.imageUrl;
    media.appendChild(img);
    if (msg.theme === 'horizontal') wrapper.appendChild(media); else wrapper.insertBefore(media, textDiv.nextSibling);
  }
  if (msg.linkUrl) {
  const linkWrap = document.createElement('div');
  linkWrap.className = 'announcement-bottom-link';
  linkWrap.textContent = msg.linkUrl.replace(/^https?:\/\//,'');
  ensureFavicon(msg.linkUrl).then(fav => { if (fav) { const img = document.createElement('img'); img.src = fav; linkWrap.prepend(img); } });
  wrapper.appendChild(linkWrap);
  }
  root.appendChild(wrapper);
  if (currentTimeout) clearTimeout(currentTimeout);
  currentTimeout = setTimeout(() => { root.innerHTML=''; }, (msg.duration || 10) * 1000);
}

function applyTheme(theme) {
  root.classList.toggle('theme-horizontal', theme === 'horizontal');
  root.classList.toggle('theme-vertical', theme !== 'horizontal');
}

function bootstrap() {
  fetch('/api/announcement').then(r=>r.json()).then(cfg => { if (cfg.success) { currentConfig = cfg.config; applyTheme(cfg.config.theme); applyColors(); } });
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.addEventListener('message', ev => {
    try {
      const payload = JSON.parse(ev.data);
      if (payload.type === 'announcement_config') {
        currentConfig = payload.data;
        applyTheme(currentConfig.theme);
        applyColors();
      } else if (payload.type === 'announcement') {
        const msg = payload.data;
        applyColors();
        showAnnouncement(msg);
      }
    } catch (e) { /* ignore */ }
  });
}

function applyColors() {
  if (!root || !currentConfig) return;
  setAnnouncementVars({
    bg: currentConfig.bgColor || '',
    text: currentConfig.textColor || ''
  });
}

function showMessage() {}

bootstrap();
