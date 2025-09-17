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
function setAnnouncementVars({ bg, text, gradFrom, gradTo, bgType }) {
  try {
    const tag = ensureStyleTag('announcement-inline-vars');
    const useGradient = bgType === 'gradient' && gradFrom && gradTo;
    const gradientVal = useGradient ? `linear-gradient(var(--ann-gradient-angle), ${gradFrom}, ${gradTo})` : 'none';
    const decls = [
      bg ? `--ann-bg-dynamic:${bg};` : '',
      text ? `--ann-text-dynamic:${text};` : '',
      gradFrom ? `--ann-grad-from:${gradFrom};` : '',
      gradTo ? `--ann-grad-to:${gradTo};` : '',
        `--ann-bg-gradient:${gradientVal};`
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

function createCtaButton(msg) {
  if (!msg || !msg.ctaText) return null;
  const btn = document.createElement('a');
  btn.className = 'ann-cta-btn';
  btn.setAttribute('role', 'button');
  btn.setAttribute('tabindex', '0');
  btn.textContent = msg.ctaText;
  if (typeof msg.ctaTextSize === 'number') {
    btn.style.fontSize = msg.ctaTextSize + 'px';
  }
  if (msg.linkUrl) {
    btn.href = msg.linkUrl;
    btn.target = '_blank';
    btn.rel = 'noopener';
  } else {
    btn.href = 'javascript:void(0)';
  }
  if (msg.ctaIcon) {
    const icon = document.createElement('img');
    icon.className = 'ann-cta-icon';
    icon.src = msg.ctaIcon;
    btn.prepend(icon);
  }
  if (msg.ctaBgColor) {
    btn.style.background = msg.ctaBgColor;
  }
  return btn;
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
  const isHorizontal = msg.theme === 'horizontal';
  wrapper.className = 'announcement-message ' + (isHorizontal ? 'horizontal ' : '') + variantClass;

  const content = document.createElement('div');
  content.className = 'ann-content';

  let media = null;
  if (msg.imageUrl) {
    media = document.createElement('div');
    media.className = 'ann-media';
    const img = document.createElement('img');
    img.className = 'ann-image';
    img.src = msg.imageUrl;
    media.appendChild(img);
  }

  const textBlock = document.createElement('div');
  textBlock.className = 'ann-textblock';
  if (msg.title) {
    const h = document.createElement('div');
    h.className = 'ann-title';
    h.textContent = msg.title;
    if (msg.titleColor) h.style.color = msg.titleColor;
    if (typeof msg.titleSize === 'number') h.style.fontSize = msg.titleSize + 'px';
    textBlock.appendChild(h);
  }
  if (msg.subtitle1) {
    const s1 = document.createElement('div');
    s1.className = 'ann-subtitle1';
    s1.textContent = msg.subtitle1;
    if (msg.subtitle1Color) s1.style.color = msg.subtitle1Color;
    if (typeof msg.subtitle1Size === 'number') s1.style.fontSize = msg.subtitle1Size + 'px';
    textBlock.appendChild(s1);
  }
  if (msg.subtitle2) {
    const s2 = document.createElement('div');
    s2.className = 'ann-subtitle2';
    s2.textContent = msg.subtitle2;
    if (msg.subtitle2Color) s2.style.color = msg.subtitle2Color;
    if (typeof msg.subtitle2Size === 'number') s2.style.fontSize = msg.subtitle2Size + 'px';
    textBlock.appendChild(s2);
  }
  if (msg.subtitle3) {
    const s3 = document.createElement('div');
    s3.className = 'ann-subtitle3';
    s3.textContent = msg.subtitle3;
    if (msg.subtitle3Color) s3.style.color = msg.subtitle3Color;
    if (typeof msg.subtitle3Size === 'number') s3.style.fontSize = msg.subtitle3Size + 'px';
    textBlock.appendChild(s3);
  }

  let textDiv = null;
  if (typeof msg.text === 'string' && msg.text.trim().length > 0) {
    textDiv = document.createElement('div');
    textDiv.className = 'ann-text';
    textDiv.innerHTML = renderMarkdown(msg.text);
    if (msg.textColorOverride) {
      textDiv.style.color = msg.textColorOverride;
    }
    if (typeof msg.textSize === 'number') {
      textDiv.style.fontSize = msg.textSize + 'px';
    }
  }

  const mainCol = document.createElement('div');
  mainCol.className = 'ann-maincol';
  mainCol.appendChild(textBlock);
  if (textDiv) mainCol.appendChild(textDiv);

  if (isHorizontal) {
    if (media) content.appendChild(media);
    content.appendChild(mainCol);
  } else {
    content.appendChild(mainCol);
    if (media) content.appendChild(media);
  }
  wrapper.appendChild(content);

  const cta = createCtaButton(msg);
  if (cta && isHorizontal) {
    const side = document.createElement('div');
    side.className = 'ann-side';
    side.appendChild(cta);
    wrapper.appendChild(side);
  } else if (msg.linkUrl && !cta) {

    const linkWrap = document.createElement('div');
    linkWrap.className = 'announcement-bottom-link';
    linkWrap.textContent = msg.linkUrl.replace(/^https?:\/\//,'');
    ensureFavicon(msg.linkUrl).then(fav => { if (fav) { const img = document.createElement('img'); img.src = fav; linkWrap.prepend(img); } });
    wrapper.appendChild(linkWrap);
  }
  root.appendChild(wrapper);

  if (currentTimeout) clearTimeout(currentTimeout);
  const isStatic = !!(currentConfig && currentConfig.staticMode);
  if (!isStatic) {
    currentTimeout = setTimeout(() => {
      try {
        wrapper.classList.add('ann-exit-backOutDown');
        const handle = () => {
          wrapper.removeEventListener('animationend', handle);
          if (wrapper.parentNode === root) {
            root.removeChild(wrapper);
          }
        };
        wrapper.addEventListener('animationend', handle);
      } catch {
        root.innerHTML = '';
      }
    }, (msg.duration || 10) * 1000);
  } else {
    currentTimeout = null;
  }
}

function applyTheme(theme) {

  root.classList.add('theme-horizontal');
  root.classList.remove('theme-vertical');
}

function pickFirstEnabled(config) {
  try {
    const msgs = (config && Array.isArray(config.messages)) ? config.messages : [];
    const enabled = msgs.filter(m => m.enabled !== false);
    return enabled.length ? enabled[0] : null;
  } catch { return null; }
}

function bootstrap() {
  fetch('/api/announcement').then(r=>r.json()).then(cfg => {
    if (cfg.success) {
      currentConfig = cfg.config;
  applyTheme('horizontal');
      applyColors();

      if (currentConfig && currentConfig.staticMode) {
        const first = pickFirstEnabled(currentConfig);
        if (first) {
          const payloadMsg = {
            ...first,
            theme: 'horizontal',
            duration: Number(first.durationSeconds) || (currentConfig.defaultDurationSeconds || 10),
            bgColor: currentConfig.bgColor,
            textColor: currentConfig.textColor,
            animationMode: currentConfig.animationMode
          };
          showAnnouncement(payloadMsg);
        }
      }
    }
  });
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.addEventListener('message', ev => {
    try {
      const payload = JSON.parse(ev.data);
      if (payload.type === 'announcement_config') {
        currentConfig = payload.data;
  applyTheme('horizontal');
        applyColors();

        if (currentConfig && currentConfig.staticMode) {
          const first = pickFirstEnabled(currentConfig);
          if (first) {
            const payloadMsg = {
              ...first,
              theme: 'horizontal',
              duration: Number(first.durationSeconds) || (currentConfig.defaultDurationSeconds || 10),
              bgColor: currentConfig.bgColor,
              textColor: currentConfig.textColor,
              animationMode: currentConfig.animationMode
            };
            showAnnouncement(payloadMsg);
          }
        }
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
    text: currentConfig.textColor || '',
    gradFrom: currentConfig.gradientFrom || '',
    gradTo: currentConfig.gradientTo || '',
    bgType: currentConfig.bannerBgType || 'solid'
  });
}

function showMessage() {}

bootstrap();
