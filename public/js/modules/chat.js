let __chat_started = false;

export async function initChat() {
  if (__chat_started) return; __chat_started = true;

  const start = async () => {
    const chatContainer = document.getElementById('chat-container');
    if (!chatContainer) { __chat_started = false; return; }
    let messageCount = 0;
    let isAutoScroll = true;

  let EMOJI_MAPPING = {};
    try {
      const response = await fetch(`/emojis.json?nocache=${Date.now()}`);
      EMOJI_MAPPING = await response.json();
    } catch (e) { console.error('Error loading emojis:', e); }

    function getCookie(name){
      try { return document.cookie.split('; ').find(r=>r.startsWith(name+'='))?.split('=')[1] || ''; } catch { return ''; }
    }

    const DEFAULT_AVATAR_URL = 'https://thumbnails.odycdn.com/optimize/s:0:0/quality:85/plain/https://player.odycdn.com/speech/spaceman-png:2.png';
    const DEFAULT_AVATAR_BG_COLORS = ['#00bcd4','#ff9800','#8bc34a','#e91e63','#9c27b0','#3f51b5','#ff5722','#4caf50','#2196f3','#ffc107'];
    function colorForUsername(name = 'Anonymous') {
      let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
      const idx = Math.abs(h) % DEFAULT_AVATAR_BG_COLORS.length; return DEFAULT_AVATAR_BG_COLORS[idx];
    }
    let randomAvatarBgPerMessage = false;
    try { const ls = localStorage.getItem('chat_avatar_random_bg'); if (ls === '1' || ls === '0') randomAvatarBgPerMessage = (ls === '1'); } catch {}
    { const urlParams = new URLSearchParams(window.location.search); const randomParam = urlParams.get('avatarRandom') || urlParams.get('randomAvatarBg'); if (randomParam === '1') randomAvatarBgPerMessage = true; if (randomParam === '0') randomAvatarBgPerMessage = false; if (window.location.hash.includes('avatarRandom')) randomAvatarBgPerMessage = true; }
    try {
      if (typeof randomAvatarBgPerMessage !== 'boolean' || randomAvatarBgPerMessage === false) {
        const res = await fetch(`/api/chat-config?nocache=${Date.now()}`);
        const cfg = await res.json();
        if (cfg && typeof cfg.avatarRandomBg === 'boolean' && localStorage.getItem('chat_avatar_random_bg') === null) {
          randomAvatarBgPerMessage = !!cfg.avatarRandomBg;
        }
      }
    } catch {}
    function colorForAvatar(name = 'Anonymous') {
      if (randomAvatarBgPerMessage) { const idx = Math.floor(Math.random() * DEFAULT_AVATAR_BG_COLORS.length); return DEFAULT_AVATAR_BG_COLORS[idx]; }
      return colorForUsername(name);
    }
    const token = getCookie('getty_public_token') || getCookie('getty_admin_token') || new URLSearchParams(location.search).get('token') || '';
    const wsUrl = `${location.protocol === 'https:' ? 'wss://' : 'ws://'}${window.location.host}${token ? `/?token=${encodeURIComponent(token)}` : ''}`;
    const ws = new WebSocket(wsUrl);
    let ttsEnabled = true; let ttsAllChat = false; let ttsLanguage = 'en';
    function stripEmojis(text) {
      if (!text) return ''; let cleaned = text.replace(/:[^:\s]+:/g, ''); cleaned = cleaned.replace(/<stkr>.*?<\/stkr>/g, ''); cleaned = cleaned.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, ''); cleaned = cleaned.replace(/\s{2,}/g, ' ').trim(); return cleaned;
    }
    function selectVoice(utterance, voices) {
      if (ttsLanguage === 'en') { const english = voices.filter(v => v.lang.startsWith('en')); if (english.length) utterance.voice = english[0]; }
      else { const spanish = voices.filter(v => v.lang.includes('es')); if (spanish.length) utterance.voice = spanish[0]; }
    }
    function speakMessage(text) {
      if (!ttsEnabled) return; if (typeof window === 'undefined' || !('speechSynthesis' in window)) return; const cleaned = stripEmojis(text); if (!cleaned) return; window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(cleaned); u.volume = 0.9; u.rate = 1; u.pitch = 0.9; let voices = window.speechSynthesis.getVoices(); if (voices.length === 0) { window.speechSynthesis.onvoiceschanged = () => { voices = window.speechSynthesis.getVoices(); selectVoice(u, voices); window.speechSynthesis.speak(u); }; } else { selectVoice(u, voices); window.speechSynthesis.speak(u); }
    }
    async function loadTtsSettings() {
      try { const s = await fetch('/api/tts-setting'); if (s.ok) { const j = await s.json(); ttsEnabled = !!j.ttsEnabled; ttsAllChat = !!j.ttsAllChat; } const l = await fetch('/api/tts-language'); if (l.ok) { const j2 = await l.json(); ttsLanguage = j2.ttsLanguage || 'en'; } } catch {}
    }
    loadTtsSettings();
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ttsSettingUpdate') { if (Object.prototype.hasOwnProperty.call(msg.data || {}, 'ttsEnabled')) ttsEnabled = !!msg.data.ttsEnabled; if (Object.prototype.hasOwnProperty.call(msg.data || {}, 'ttsAllChat')) ttsAllChat = !!msg.data.ttsAllChat; return; }
        if (msg.type === 'ttsLanguageUpdate' && msg.data?.ttsLanguage) { ttsLanguage = msg.data.ttsLanguage; return; }
        if (msg.type === 'chatConfigUpdate') { fetchAndApplyTheme(); applyChatColors(); return; }
        if (msg.type === 'chatMessage' && msg.data) addMessage(msg.data);
        else if (msg.type === 'chat') addMessage(msg);
        else if (msg.type === 'init' && msg.data?.chatHistory) { msg.data.chatHistory.forEach(m => addMessage(m)); }
        else if (msg.type === 'batch' && Array.isArray(msg.messages)) { msg.messages.forEach(m => addMessage(m)); }
      } catch (e) { console.error('Error processing message:', e); }
    };
    const CYBERPUNK_PALETTE = [
      { bg: 'rgba(17, 255, 121, 0.8)', text: '#000', border: 'rgba(17, 255, 121, 0.9)' },
      { bg: 'rgba(255, 17, 121, 0.8)', text: '#fff', border: 'rgba(255, 17, 121, 0.9)' },
      { bg: 'rgba(121, 17, 255, 0.8)', text: '#fff', border: 'rgba(121, 17, 255, 0.9)' },
      { bg: 'rgba(17, 121, 255, 0.8)', text: '#fff', border: 'rgba(36, 98, 165, 0.9)' },
      { bg: 'rgba(255, 231, 17, 0.8)', text: '#000', border: 'rgba(255, 231, 17, 0.9)' },
      { bg: 'rgba(21, 25, 40, 0.93)', text: '#fff', border: 'rgba(19, 19, 19, 0.9)' }
    ];
    function getCyberpunkStyle(username) { let hash = 0; for (let i = 0; i < username.length; i++) { hash = username.charCodeAt(i) + ((hash << 5) - hash); } const index = Math.abs(hash) % CYBERPUNK_PALETTE.length; return CYBERPUNK_PALETTE[index]; }
    const isOBSWidget = window.location.pathname.includes('/widgets/');
    let chatColors = {};

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
        try {
          const n = getNonce();
          if (n && !tag.getAttribute('nonce')) tag.setAttribute('nonce', n);
        } catch {}
      }
      return tag;
    }
    function setCssVar(name, value) {
      try {
        const tag = ensureStyleTag('chat-theme-inline-vars');
        const current = tag.textContent || '';
        const re = new RegExp(`${name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\s*:\s*[^;]+;?`, 'i');
        const decl = value ? `${name}: ${value};` : '';
        const base = /:root\s*\{[\s\S]*?\}/.test(current) ? current : ':root{}';
        const updated = base.replace(/:root\s*\{([\s\S]*?)\}/, (m, body) => {
          const body2 = re.test(body) ? body.replace(re, decl) : (decl ? (body + (body.trim()? ' ' : '') + decl) : body);
          return `:root{${body2}}`;
        });
        tag.textContent = updated;
      } catch {}
    }
    function updateDonationVars() {
      try {
        const themeStyleTag = document.getElementById('chat-theme-style');
        const anyThemeActive = (typeof serverHasTheme !== 'undefined' && serverHasTheme) || !!(themeStyleTag && typeof themeStyleTag.textContent === 'string' && themeStyleTag.textContent.trim().length > 0);
        if (anyThemeActive) return;
      } catch {}
      const DEFAULT_BG = '#131313'; const DEFAULT_TEXT = '#ddb826';
      const customBg = (chatColors.donationBgColor || '').toLowerCase(); const customText = (chatColors.donationColor || '').toLowerCase();
      setCssVar('--donation-bg', customBg && customBg !== DEFAULT_BG ? customBg : '');
      setCssVar('--donation-text', customText && customText !== DEFAULT_TEXT ? customText : '');
    }
    async function loadColors() {
      if (!isOBSWidget) return;
      try {
        const res = await fetch(`/api/modules?nocache=${Date.now()}${token ? `&token=${encodeURIComponent(token)}` : ''}`);
        const data = await res.json();
        if (data.chat) {
          chatColors = {
            bgColor: data.chat.bgColor,
            msgBgColor: data.chat.msgBgColor,
            msgBgAltColor: data.chat.msgBgAltColor,
            borderColor: data.chat.borderColor,
            textColor: data.chat.textColor,
            usernameColor: data.chat.usernameColor,
            usernameBgColor: data.chat.usernameBgColor,
            donationColor: data.chat.donationColor,
            donationBgColor: data.chat.donationBgColor
          };
        }
      } catch {}
    }
  function setIfCustomVar(varName, value, defaultValue) { if (!varName) return; try { if (value && value !== defaultValue) setCssVar(varName, value); else setCssVar(varName, ''); } catch {} }
    let originalAddMessage;
    function addMessage(msg) { /* placeholder, gets replaced below */ }
    originalAddMessage = addMessage;
    addMessage = function(msg) {
      originalAddMessage(msg);
      if (!isOBSWidget) return;
  const messages = chatContainer.querySelectorAll('.message');
      const isLightThemeActive = !!(chatContainer && chatContainer.classList.contains('theme-light'));
      const hasExplicitUserColors = !!(chatColors.usernameColor || chatColors.usernameBgColor);
  messages.forEach((messageEl) => {
        const themeStyleTag = document.getElementById('chat-theme-style');
        const anyThemeActive = (typeof serverHasTheme !== 'undefined' && serverHasTheme) || !!(themeStyleTag && typeof themeStyleTag.textContent === 'string' && themeStyleTag.textContent.trim().length > 0);
        if (anyThemeActive) {
          messageEl.style.removeProperty('background'); messageEl.style.removeProperty('border-left'); messageEl.style.removeProperty('color');
          const donation = messageEl.querySelector('.message-donation'); if (donation) { donation.style.removeProperty('background'); donation.style.removeProperty('color'); }
          const text = messageEl.querySelector('.message-text-inline'); if (text) text.style.removeProperty('color'); return;
        }
        if (!isLightThemeActive) {
          setIfCustomVar('--bg-message', chatColors.msgBgColor, '#0a0e12');
          setIfCustomVar('--bg-message-alt', chatColors.msgBgAltColor, '#0d1114');
        }
        setIfCustomVar('--border', chatColors.borderColor, '#161b22');
        setIfCustomVar('--text', chatColors.textColor, '#e6edf3');
        const donation = messageEl.querySelector('.message-donation'); if (donation) { donation.style.removeProperty('background'); donation.style.removeProperty('color'); }

        const uname = messageEl.querySelector('.message-username.cyberpunk'); if (uname && (serverHasTheme || hasExplicitUserColors)) { uname.style.removeProperty('background-color'); uname.style.removeProperty('color'); uname.style.removeProperty('text-shadow'); }
      });
      if (isHorizontal) { chatContainer.scrollLeft = chatContainer.scrollWidth; }
    };
    async function applyChatColors() {
      if (!isOBSWidget) return; await loadColors();
      const themeStyle = document.getElementById('chat-theme-style');
      const themeActive = !!(themeStyle && typeof themeStyle.textContent === 'string' && themeStyle.textContent.trim().length > 0);
      updateDonationVars();
  if (themeActive) { setCssVar('--chat-bg', ''); return; }
  if (chatColors.bgColor === 'transparent') { setCssVar('--chat-bg', ''); }
  else { setCssVar('--chat-bg', (chatColors.bgColor || '#0f1419')); }
    }
    await applyChatColors();
    function addMessageImpl(msg) {
      const messageEl = document.createElement('div');
      messageEl.classList.add('message'); if (messageCount++ % 2) messageEl.classList.add('odd');
      const header = document.createElement('div'); header.className = 'message-header';
      const username = (msg.channelTitle || 'Anonymous');
  {
  const avatar = document.createElement('div'); avatar.className = 'message-avatar';
    const img = document.createElement('img'); const hasCustom = typeof msg.avatar === 'string' && msg.avatar.trim().length > 0; const initialSrc = hasCustom ? msg.avatar : DEFAULT_AVATAR_URL; img.src = initialSrc; img.alt = username;
  if (!hasCustom) { try { const bgIdx = Math.abs(username.split('').reduce((a,c)=>c.charCodeAt(0)+((a<<5)-a),0)) % 10; avatar.classList.add(`avatar-bg-${bgIdx}`); } catch {} }
  img.onerror = () => { if (img.src !== DEFAULT_AVATAR_URL) { img.onerror = null; img.src = DEFAULT_AVATAR_URL; try { const bgIdx = Math.abs(username.split('').reduce((a,c)=>c.charCodeAt(0)+((a<<5)-a),0)) % 10; avatar.classList.add(`avatar-bg-${bgIdx}`); } catch {} } else { img.classList.add('avatar-img-hidden'); try { const bgIdx = Math.abs(username.split('').reduce((a,c)=>c.charCodeAt(0)+((a<<5)-a),0)) % 10; avatar.classList.add(`avatar-bg-${bgIdx}`); } catch {} } };
        avatar.appendChild(img); header.appendChild(avatar);
      }
      const userContainer = document.createElement('div'); userContainer.className = 'message-user-container';
      const displayUsername = username.length > 17 ? username.slice(0, 17) + '' : username;
  const style = getCyberpunkStyle(username);
      const usernameElement = document.createElement('span'); usernameElement.className = 'message-username cyberpunk'; usernameElement.textContent = displayUsername + '';
      const membershipIcons = ['crown','star','hamburger','heart','tongue','astro','laugh','lemon','serious','cool','fire','rocket','creamy','unicorn','pizza','whale'];
      let hash = 0; for (let i = 0; i < username.length; i++) { hash = username.charCodeAt(i) + ((hash << 5) - hash); }
      const iconIndex = Math.abs(hash) % membershipIcons.length; const iconType = membershipIcons[iconIndex];
      const iconElement = document.createElement('span'); iconElement.className = `membership-icon ${iconType}`; usernameElement.insertBefore(iconElement, usernameElement.firstChild);
      const cpIndex = Math.abs(hash) % CYBERPUNK_PALETTE.length; usernameElement.classList.add(`cp-${cpIndex + 1}`);
      const hasExplicitUserColors = !!(chatColors.usernameColor || chatColors.usernameBgColor);
      if (!serverHasTheme && !hasExplicitUserColors) {
      }
      userContainer.appendChild(usernameElement);
      const cleanMessage = (msg.message || '').replace(/&lt;stkr&gt;(.*?)&lt;\/stkr&gt;/g, '<stkr>$1</stkr>');
      const hasSticker = /<stkr>/.test(cleanMessage);
      const normalText = cleanMessage.replace(/<stkr>.*?<\/stkr>/g, '').trim();
      if (msg.credits > 0) { const isDonationOnly = !normalText.length && !hasSticker && !/:([^\s:]+):/.test(cleanMessage); messageEl.classList.add('has-donation'); if (isDonationOnly) { messageEl.classList.add('donation-only'); } }
      if (normalText.length > 0 || (!normalText.length && (hasSticker || /:[^\s:]+:/.test(cleanMessage)))) {
        const textElement = document.createElement('span'); textElement.className = msg.credits > 0 ? 'message-text-inline has-donation' : 'message-text-inline'; textElement.innerHTML = formatText(normalText.length > 0 ? normalText : cleanMessage); userContainer.appendChild(textElement);
        if (ttsAllChat && (normalText || cleanMessage)) { speakMessage(normalText || cleanMessage); }
      }
      header.appendChild(userContainer);
      if (msg.credits > 0) {
        const donation = document.createElement('span'); donation.className = 'message-donation highlight'; donation.textContent = `$${msg.credits} USD`; header.appendChild(donation);
        const confettiContainer = document.createElement('div'); confettiContainer.className = 'confetti-container';
        for (let i = 0; i < 200; i++) {
          const confetti = document.createElement('div'); confetti.className = 'confetti';
          const posClass = `pos-${Math.floor(Math.random()*20)}`; confetti.classList.add(posClass);
          const sizeBucket = Math.floor(Math.random()*5); confetti.classList.add(`size-${sizeBucket}`);
          const colorIdx = Math.floor(Math.random()*6); confetti.classList.add(`color-${colorIdx}`);
          const durBucket = Math.floor(Math.random()*9); confetti.classList.add(`dur-${durBucket}`);
          const delayBucket = Math.floor(Math.random()*11); confetti.classList.add(`delay-${delayBucket}`);
          if (Math.random() > 0.5) confetti.classList.add('round');
          confettiContainer.appendChild(confetti);
        }
        messageEl.appendChild(confettiContainer);
        setTimeout(() => { donation.classList.remove('highlight'); confettiContainer.classList.add('fade-out'); setTimeout(() => confettiContainer.remove(), 1000); }, 20000);
      }
      messageEl.appendChild(header);
      if (hasSticker) { const stickerContainer = document.createElement('div'); stickerContainer.className = 'message-sticker-container'; const stickersOnly = cleanMessage.match(/<stkr>.*?<\/stkr>/g)?.join('') || ''; stickerContainer.innerHTML = formatText(stickersOnly); messageEl.appendChild(stickerContainer); }
      const isDashboard = /index\.html$|\/$/.test(window.location.pathname);
      if (isDashboard) { chatContainer.insertBefore(messageEl, chatContainer.firstChild); if (isAutoScroll) chatContainer.scrollTop = 0; }
      else { chatContainer.appendChild(messageEl); if (isAutoScroll) chatContainer.scrollTop = chatContainer.scrollHeight; }
      const themeStyle = document.getElementById('chat-theme-style');
      const isMinimalista = themeStyle && typeof themeStyle.textContent === 'string' && themeStyle.textContent.includes('THEME_ID:MINIMALISTA_AUTO10S');
      if (isMinimalista) {
        messageEl.addEventListener('animationend', (e) => { if (e && e.animationName === 'fadeOut') { if (messageEl.parentNode) messageEl.parentNode.removeChild(messageEl); } });
        if (isHorizontal) { setTimeout(() => { if (messageEl.parentNode) messageEl.parentNode.removeChild(messageEl); }, 10200); }
        setTimeout(() => { if (!messageEl.isConnected) return; const animName = getComputedStyle(messageEl).animationName || ''; if (isHorizontal || (typeof animName === 'string' && animName.toLowerCase().includes('fadeout'))) { if (messageEl.parentNode) messageEl.parentNode.removeChild(messageEl); } }, 11000);
      }
    }
    function formatText(text) {
      if (!text) return ''; let formatted = escapeHtml(text);
      formatted = formatted.replace(/<stkr>(.*?)<\/stkr>/g, (match, url) => { try { const decodedUrl = decodeURIComponent(url); if (decodedUrl.match(/^https?:\/\//i)) { return `<img src="${decodedUrl}" alt="Sticker" class="comment-sticker" loading="lazy" />`; } return match; } catch { return match; } });
      if (Object.keys(EMOJI_MAPPING).length > 0) { for (const [code, url] of Object.entries(EMOJI_MAPPING)) { const isSticker = url.includes('/stickers/'); const className = isSticker ? 'comment-sticker' : 'comment-emoji'; const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); formatted = formatted.replace(new RegExp(escapedCode, 'g'), `<img src="${url}" alt="${code}" class="${className}" loading="lazy" />`); } }
      return formatted;
    }
    function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML.replace(/&lt;stkr&gt;/g, '<stkr>').replace(/&lt;\/stkr&gt;/g, '</stkr>'); }
    chatContainer.addEventListener('scroll', () => { isAutoScroll = chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight; });
    const isHorizontal = window.location.search.includes('horizontal=1') || window.location.hash.includes('horizontal'); if (isHorizontal) { chatContainer.classList.add('horizontal-chat'); }
  function applyChatTheme(themeCSS, isLightTheme) { let styleTag = ensureStyleTag('chat-theme-style'); styleTag.textContent = themeCSS; if (chatContainer) { chatContainer.classList.add('theme-active'); chatContainer.classList.remove('chat-default'); if (isLightTheme) { chatContainer.classList.add('theme-light'); } else { chatContainer.classList.remove('theme-light'); } } }
    let lastThemeCSS = ''; let serverHasTheme = false;
    async function fetchAndApplyTheme() {
      try {
        const res = await fetch(`/api/chat-config?nocache=${Date.now()}${token ? `&token=${encodeURIComponent(token)}` : ''}`);
        const config = await res.json();
        const serverCSS = (config.themeCSS || '').trim();
        let isLightTheme = !!serverCSS && (serverCSS.includes('--text: #1f2328') || serverCSS.includes('--text: #111'));
        serverHasTheme = !!serverCSS;
        if (serverHasTheme) {
          await loadColors();
          const hasExplicitUserColors = !!(chatColors.usernameColor || chatColors.usernameBgColor);
          const donationOverrideCss = '';
          const extraCss = hasExplicitUserColors
            ? `\n.message-username.cyberpunk { color: ${chatColors.usernameColor || '#ffffff'} !important; background: ${chatColors.usernameBgColor || '#11ff79'} !important; }`
            : CYBERPUNK_PALETTE.map((p, i) => `\n.message-username.cyberpunk.cp-${i + 1} { color: ${p.text} !important; background: ${p.bg} !important; text-shadow: 0 0 8px ${p.border} !important; }`).join('');
          const finalCss = serverCSS + extraCss + (donationOverrideCss ? `\n${donationOverrideCss}` : '');
          if (finalCss !== lastThemeCSS) { lastThemeCSS = finalCss; applyChatTheme(finalCss, isLightTheme); }
          try {
            const localAuto = (localStorage.getItem('chatLiveThemeCSS') || '').match(/\/\* AUTO_FONT_SIZES_START \*\/[\u0000-\uFFFF]*?\/\* AUTO_FONT_SIZES_END \*\//);
            if (localAuto && !/AUTO_FONT_SIZES_START/.test(finalCss)) {
              const merged = finalCss + '\n' + localAuto[0]; if (merged !== lastThemeCSS) { lastThemeCSS = merged; applyChatTheme(merged, isLightTheme); }
            }
          } catch {}

          updateDonationVars();
        } else {
          const styleTag = document.getElementById('chat-theme-style'); if (styleTag) styleTag.textContent = ''; if (chatContainer) chatContainer.classList.remove('theme-light');
          const local = (localStorage.getItem('chatLiveThemeCSS') || '').trim();
          if (local && local !== lastThemeCSS) {
            const sizeBlock = local.match(/\/\* AUTO_FONT_SIZES_START \*\/[\u0000-\uFFFF]*?\/\* AUTO_FONT_SIZES_END \*\//);
            let combined = local; if (sizeBlock && !/AUTO_FONT_SIZES_START/.test(local)) { combined = local + '\n' + sizeBlock[0]; }
            lastThemeCSS = combined; isLightTheme = combined.includes('--text: #1f2328'); applyChatTheme(combined, isLightTheme);
          } else {
            await loadColors();
            const DEFAULT_BG = '#131313'; const DEFAULT_TEXT = '#ddb826';
            const bgVar = (chatColors.donationBgColor || '').toLowerCase(); const textVar = (chatColors.donationColor || '').toLowerCase();
            let css = `
                        :root { ${bgVar && bgVar !== DEFAULT_BG ? `--donation-bg: ${bgVar};` : ''} ${textVar && textVar !== DEFAULT_TEXT ? `--donation-text: ${textVar};` : ''} }
                        /* X-style fallback when no theme is active */
                        .message { background: ${chatColors.msgBgColor || '#f7f7f7'} !important; color: ${chatColors.textColor || '#111'} !important; border-left: 8px solid ${chatColors.borderColor || '#3b5aff'} !important; }
                        .message.odd:not(.has-donation) { background: ${chatColors.msgBgAltColor || '#f7f7f7'} !important; }
                        /* Donation message background comes from base CSS/theme; no override here */
                        /* Keep donation chip base styles unless Admin defines --donation-text */
                        .message-donation { ${textVar && textVar !== DEFAULT_TEXT ? 'color: var(--donation-text) !important;' : ''} }
                        #chat-container { background: ${chatColors.bgColor === 'transparent' ? 'transparent' : (chatColors.bgColor || '#080c10')} !important; }
                    `;
            const hasExplicitUserColors = !!(chatColors.usernameColor || chatColors.usernameBgColor);
            if (!hasExplicitUserColors) { css += CYBERPUNK_PALETTE.map((p, i) => `\n                            .message-username.cyberpunk.cp-${i + 1} { color: ${p.text} !important; background: ${p.bg} !important; text-shadow: 0 0 8px ${p.border} !important; }`).join(''); }
            else { css += `\n                            .message-username.cyberpunk { color: ${chatColors.usernameColor || '#ffffff'} !important; background: ${chatColors.usernameBgColor || '#11ff79'} !important; }\n                        `; }
            const txt = (chatColors.textColor || '').toLowerCase(); isLightTheme = (txt === '#1f2328' || txt === '#111'); applyChatTheme(css, isLightTheme);
          }
        }
      } catch {}
    }
    fetchAndApplyTheme(); setInterval(fetchAndApplyTheme, 15000);
  try { const initialVars = (localStorage.getItem('chatLiveThemeVars') || '').trim(); if (initialVars) { let tag = ensureStyleTag('chat-theme-size-vars'); tag.textContent = /}\s*$/.test(initialVars) ? initialVars : (initialVars + '}'); } } catch {}
    window.addEventListener('storage', function(e) {
      if (e.key !== 'chatLiveThemeCSS') return; if (serverHasTheme) return; const local = (e.newValue || '').trim(); if (!local) return; const sizeBlockMatch = local.match(/\/\* AUTO_FONT_SIZES_START \*\/[\u0000-\uFFFF]*?\/\* AUTO_FONT_SIZES_END \*\//);
      let finalCss = local; if (!sizeBlockMatch) { const existing = (lastThemeCSS || '').match(/\/\* AUTO_FONT_SIZES_START \*\/[\u0000-\uFFFF]*?\/\* AUTO_FONT_SIZES_END \*\//); if (existing) finalCss += '\n' + existing[0]; }
      if (finalCss !== lastThemeCSS) { lastThemeCSS = finalCss; const isLight = finalCss.includes('--text: #1f2328') || finalCss.includes('--text: #111'); applyChatTheme(finalCss, isLight); }
    });
  window.addEventListener('storage', function(e) {
      if (e.key !== 'chatLiveThemeVars') return;
      if (serverHasTheme) return;
      const vars = (e.newValue || '').trim();
      if (!vars) return;
      let tag = ensureStyleTag('chat-theme-size-vars');
      tag.textContent = /}\s*$/.test(vars) ? vars : (vars + '}');
  });

    originalAddMessage = addMessageImpl;
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

export default { initChat };
