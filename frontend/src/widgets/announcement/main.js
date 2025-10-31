import './announcement.css';

const root = document.getElementById('announcement-root');
let currentTimeout = null;
let currentConfig = null;

function getNonce() {
  try {
    const meta = document.querySelector('meta[property="csp-nonce"]');
    return (
      (meta && (meta.nonce || meta.getAttribute('nonce'))) ||
      document.head?.dataset?.cspNonce ||
      ''
    );
  } catch {
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
    } catch {}
  }
  return tag;
}

function setAnnouncementVars({ bg, text, gradFrom, gradTo, bgType }) {
  try {
    const tag = ensureStyleTag('announcement-inline-vars');
    const useGradient = bgType === 'gradient' && gradFrom && gradTo;
    const gradientVal = useGradient
      ? `linear-gradient(var(--ann-gradient-angle), ${gradFrom}, ${gradTo})`
      : 'none';
    const declarations = [
      bg ? `--ann-bg-dynamic:${bg};` : '',
      text ? `--ann-text-dynamic:${text};` : '',
      gradFrom ? `--ann-grad-from:${gradFrom};` : '',
      gradTo ? `--ann-grad-to:${gradTo};` : '',
      `--ann-bg-gradient:${gradientVal};`
    ]
      .filter(Boolean)
      .join('');
    tag.textContent = declarations ? `#announcement-root{${declarations}}` : '';
  } catch {}
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (char) => (
    {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char] || char
  ));
}

function stripDangerous(html) {
  return html
    .replace(/<\/(?:script|style)[^>]*>/gi, '')
    .replace(/<(?:script|style)[^>]*>[\s\S]*?<\/(?:script|style)>/gi, '')
    .replace(/on[a-z]+="[^"]*"/gi, '');
}

function renderMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, (_, group) => `<strong>${group}</strong>`);
  html = html.replace(/\*(.+?)\*/g, (_, group) => `<em>${group}</em>`);
  html = html.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, (match, label, url) => {
    const safeLabel = escapeHtml(label);
    const safeUrl = url.replace(/["'\\]/g, '');
    return `<a href="${safeUrl}" target="_blank" rel="noopener" class="ann-link">${safeLabel}</a>`;
  });
  return stripDangerous(html);
}

const faviconCache = new Map();
async function ensureFavicon(linkUrl) {
  if (!linkUrl) return null;
  if (faviconCache.has(linkUrl)) return faviconCache.get(linkUrl);
  try {
    const res = await fetch(`/api/announcement/favicon?url=${encodeURIComponent(linkUrl)}`);
    const data = await res.json();
    if (data && 'favicon' in data) {
      faviconCache.set(linkUrl, data.favicon);
      return data.favicon;
    }
  } catch {}
  faviconCache.set(linkUrl, null);
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
    btn.style.fontSize = `${msg.ctaTextSize}px`;
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

function applyTheme(theme) {
  if (!root) return;
  if (theme === 'horizontal') {
    root.classList.add('theme-horizontal');
    root.classList.remove('theme-vertical');
  } else if (theme === 'vertical') {
    root.classList.add('theme-vertical');
    root.classList.remove('theme-horizontal');
  }
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

function pickFirstEnabled(config) {
  try {
    const messages = Array.isArray(config?.messages) ? config.messages : [];
    const enabled = messages.filter((message) => message.enabled !== false);
    return enabled.length ? enabled[0] : null;
  } catch {
    return null;
  }
}

function resolveDuration(message, fallbackSeconds) {
  return Number(message?.durationSeconds) || Number(message?.duration) || fallbackSeconds;
}

function scheduleRemoval(wrapper, duration, isStatic) {
  if (currentTimeout) {
    clearTimeout(currentTimeout);
    currentTimeout = null;
  }
  if (isStatic) return;
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
      if (root) root.innerHTML = '';
    }
  }, Math.max(1, duration) * 1000);
}

function showAnnouncement(msg) {
  if (!root) return;
  root.innerHTML = '';
  const wrapper = document.createElement('div');
  const isHorizontal = msg.theme === 'horizontal';

  const animationMode = msg.animationMode || currentConfig?.animationMode || 'fade';
  const pickVariant = () => {
    const variants = ['fade', 'slide-up', 'slide-left', 'scale'];
    return variants[Math.floor(Math.random() * variants.length)];
  };
  const resolved = animationMode === 'random' ? pickVariant() : animationMode;
  let variantClass = '';
  if (resolved === 'slide-up') variantClass = 'ann-variant-slide-up';
  else if (resolved === 'slide-left') variantClass = 'ann-variant-slide-left';
  else if (resolved === 'scale') variantClass = 'ann-variant-scale';

  wrapper.className = `announcement-message${isHorizontal ? ' horizontal' : ''}${variantClass ? ` ${variantClass}` : ''}`;

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
    const title = document.createElement('div');
    title.className = 'ann-title';
    title.textContent = msg.title;
    if (msg.titleColor) title.style.color = msg.titleColor;
    if (typeof msg.titleSize === 'number') title.style.fontSize = `${msg.titleSize}px`;
    textBlock.appendChild(title);
  }
  if (msg.subtitle1) {
    const subtitle1 = document.createElement('div');
    subtitle1.className = 'ann-subtitle1';
    subtitle1.textContent = msg.subtitle1;
    if (msg.subtitle1Color) subtitle1.style.color = msg.subtitle1Color;
    if (typeof msg.subtitle1Size === 'number') subtitle1.style.fontSize = `${msg.subtitle1Size}px`;
    textBlock.appendChild(subtitle1);
  }
  if (msg.subtitle2) {
    const subtitle2 = document.createElement('div');
    subtitle2.className = 'ann-subtitle2';
    subtitle2.textContent = msg.subtitle2;
    if (msg.subtitle2Color) subtitle2.style.color = msg.subtitle2Color;
    if (typeof msg.subtitle2Size === 'number') subtitle2.style.fontSize = `${msg.subtitle2Size}px`;
    textBlock.appendChild(subtitle2);
  }
  if (msg.subtitle3) {
    const subtitle3 = document.createElement('div');
    subtitle3.className = 'ann-subtitle3';
    subtitle3.textContent = msg.subtitle3;
    if (msg.subtitle3Color) subtitle3.style.color = msg.subtitle3Color;
    if (typeof msg.subtitle3Size === 'number') subtitle3.style.fontSize = `${msg.subtitle3Size}px`;
    textBlock.appendChild(subtitle3);
  }

  let textDiv = null;
  if (typeof msg.text === 'string' && msg.text.trim().length > 0) {
    textDiv = document.createElement('div');
    textDiv.className = 'ann-text';
    textDiv.innerHTML = renderMarkdown(msg.text);
    if (msg.textColorOverride) textDiv.style.color = msg.textColorOverride;
    if (typeof msg.textSize === 'number') textDiv.style.fontSize = `${msg.textSize}px`;
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
    linkWrap.textContent = msg.linkUrl.replace(/^https?:\/\//, '');
    ensureFavicon(msg.linkUrl).then((favicon) => {
      if (favicon) {
        const icon = document.createElement('img');
        icon.src = favicon;
        linkWrap.prepend(icon);
      }
    });
    wrapper.appendChild(linkWrap);
  }

  root.appendChild(wrapper);

  const fallbackDuration = currentConfig?.defaultDurationSeconds || 10;
  const duration = resolveDuration(msg, fallbackDuration);
  scheduleRemoval(wrapper, duration, Boolean(currentConfig?.staticMode));
}

function showStaticPreview() {
  const first = currentConfig ? pickFirstEnabled(currentConfig) : null;
  if (!first) return;
  const payload = {
    ...first,
    theme: 'horizontal',
    duration: resolveDuration(first, currentConfig?.defaultDurationSeconds || 10),
    bgColor: currentConfig?.bgColor,
    textColor: currentConfig?.textColor,
    animationMode: currentConfig?.animationMode
  };
  showAnnouncement(payload);
}

function handleConfigUpdate(config) {
  currentConfig = config;
  applyTheme('horizontal');
  applyColors();

  if (currentConfig?.staticMode) {
    showStaticPreview();
  }
}

function bootstrap() {
  if (!root) return;

  fetch('/api/announcement')
    .then((response) => response.json())
    .then((payload) => {
      if (payload?.success) {
        handleConfigUpdate(payload.config);
      }
    })
    .catch(() => {});

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}`);
  ws.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'announcement_config') {
        handleConfigUpdate(data.data);
      } else if (data.type === 'announcement') {
        applyColors();
        showAnnouncement(data.data);
      }
    } catch {
      /* ignore malformed payloads */
    }
  });
}

if (root) {
  bootstrap();
}
