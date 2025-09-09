let __tn_started = false;
let __tn_demoTimer = null;

function getCookie(name){
  try { return document.cookie.split('; ').find(r=>r.startsWith(name+'='))?.split('=')[1] || ''; } catch { return ''; }
}

export async function initNotifications() {
  if (__tn_started) return;
  __tn_started = true;

  const notification = document.getElementById('notification');
  const tipWrapper = document.getElementById('tip-wrapper');
  const gifSlot = document.getElementById('notification-gif');
  if (!notification) return;

  let gifConfig = { gifPath: '', position: 'right' };
  async function loadGifConfig() {
    try {
      const res = await fetch('/api/tip-notification-gif');
      if (res.ok) { gifConfig = await res.json(); applyGifConfig(); }
    } catch {}
  }
  function applyGifConfig() {
    if (!tipWrapper) return;
    try {
      tipWrapper.classList.remove('position-left','position-right','position-top','position-bottom');
      tipWrapper.classList.add('position-' + (gifConfig.position || 'right'));
  if (gifSlot) { gifSlot.classList.add('hidden'); gifSlot.innerHTML = ''; }
    } catch {}
  }
  await loadGifConfig();

  const isOBSWidget = window.location.pathname.includes('/widgets/');
  if (isOBSWidget) notification.classList.add('tip-notification-widget');

  const token = getCookie('getty_public_token') || getCookie('getty_admin_token') || new URLSearchParams(location.search).get('token') || '';
  const wsUrl = `${location.protocol==='https:'?'wss://':'ws://'}${window.location.host}${token?`/?token=${encodeURIComponent(token)}`:''}`;
  let AR_TO_USD = 0;
  let ttsLanguage = 'en';
  let ttsAllChat = false;
  let ttsEnabled = true;
  const REMOTE_SOUND_URL = 'https://52agquhrbhkx3u72ikhun7oxngtan55uvxqbp4pzmhslirqys6wq.arweave.net/7oBoUPEJ1X3T-kKPRv3XaaYG97St4Bfx-WHktEYYl60';
  let audioSettings = { audioSource: 'remote', hasCustomAudio: false };

  function playNotificationSound() {
    const useCustom = audioSettings.audioSource === 'custom' && audioSettings.hasCustomAudio;
    const audioUrl = useCustom ? '/api/custom-audio' : REMOTE_SOUND_URL;
    try {
      const audio = new Audio(audioUrl); audio.volume = 0.9;
      audio.play().catch(() => { if (useCustom) new Audio(REMOTE_SOUND_URL).play().catch(()=>{}); });
    } catch {}
  }

  function formatText(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/&lt;stkr&gt;/g,'<stkr>').replace(/&lt;\/stkr&gt;/g,'</stkr>');
  }

  async function updateExchangeRate() {
    try {
      const r = await fetch('/api/ar-price');
      if (r.ok) {
        const data = await r.json();
        if (data?.arweave?.usd) { AR_TO_USD = data.arweave.usd; return; }
      }
    } catch {}
    AR_TO_USD = AR_TO_USD || 5;
  }

  function stripEmojis(text) {
    if (!text) return '';
    let cleaned = text.replace(/:[^:\s]+:/g, '');
    cleaned = cleaned.replace(/<stkr>.*?<\/stkr>/g, '');
    cleaned = cleaned.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    return cleaned;
  }
  function selectVoice(utterance, voices) {
    if (ttsLanguage === 'en') {
      const anyEnglish = voices.filter(v=>v.lang && v.lang.startsWith('en'));
      utterance.voice = anyEnglish[0] || null;
    } else {
      const anySpanish = voices.filter(v=>v.lang && v.lang.includes('es'));
      utterance.voice = anySpanish[0] || null;
    }
  }
  function speakMessage(message) {
    try {
      if (!message || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(stripEmojis(message));
      utter.volume = 0.9; utter.rate = 1; utter.pitch = 0.9;
      let voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          voices = window.speechSynthesis.getVoices();
          selectVoice(utter, voices); window.speechSynthesis.speak(utter);
        };
      } else { selectVoice(utter, voices); window.speechSynthesis.speak(utter); }
    } catch {}
  }

  const shownTips = new Set();
  async function showDonationNotification(data) {
    const uniqueId = data.isDirectTip ? `direct-${data.txId}` : `chat-${data.id || (data.from + data.amount + data.message)}`;
    if (uniqueId && shownTips.has(uniqueId)) return;
    if (uniqueId) shownTips.add(uniqueId);

  playNotificationSound();
  notification.classList.add('hidden'); void notification.offsetWidth; // reflow

    if (!(typeof data.usdAmount === 'number' && typeof data.arAmount === 'number')) {
      await updateExchangeRate();
    } else if (!AR_TO_USD && data.arAmount > 0) {
      AR_TO_USD = data.usdAmount / data.arAmount;
    }

    const formattedMessage = data.message ? formatText(data.message) : '';
    const isChatTipHeuristic = !!data.isChatTip && (data.amount === undefined || data.amount === null);
    const creditsIsUsd = !!data.creditsIsUsd;
    let rawAr = 0, rawUsd = 0;
    if (typeof data.usdAmount === 'number' && typeof data.arAmount === 'number') {
      rawUsd = data.usdAmount; rawAr = data.arAmount;
    } else if (isChatTipHeuristic || creditsIsUsd) {
      rawUsd = parseFloat(data.credits || 0) || 0; rawAr = AR_TO_USD > 0 ? (rawUsd / AR_TO_USD) : (rawUsd / 5);
    } else {
      rawAr = parseFloat(data.amount || data.credits || 0) || 0; rawUsd = AR_TO_USD > 0 ? (rawAr * AR_TO_USD) : (rawAr * 5);
    }
    const arAmount = rawAr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    const usdAmount = rawUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const senderInfo = data.from ? `📦 From: ${String(data.from).slice(0,8)}...` : `🏷️ From: ${data.channelTitle || 'Anonymous'}`;

    if (ttsEnabled) {
      const toSpeak = formattedMessage || '';
      if ((data.isChatTip || ttsAllChat) && toSpeak) speakMessage(toSpeak);
    }

    notification.innerHTML = `
      <div class="notification-content">
        <div class="notification-icon"></div>
        <div class="notification-text">
          <div class="notification-title">🎉 ${data.credits ? 'Tip Received. Woohoo!' : 'Tip Received. Woohoo!'}</div>
          <div class="amount-container">
            <span class="ar-amount">${arAmount} AR</span>
            <span class="usd-value">($${usdAmount} USD)</span>
          </div>
          <div class="notification-from">${senderInfo} <span class="thank-you">👏</span></div>
          ${formattedMessage ? `<div class="notification-message">${formattedMessage.length > 80 ? formattedMessage.substring(0,80) + '...' : formattedMessage}</div>` : ''}
        </div>
      </div>
    `;
  try {
      const iconContainer = notification.querySelector('.notification-icon');
      if (iconContainer) {
        const imgEl = document.createElement('img');
        imgEl.src = data.avatar || '/assets/odysee.png';
        imgEl.alt = '💰';
    imgEl.addEventListener('error', () => { imgEl.classList.add('hidden'); iconContainer.textContent = '💰'; });
        iconContainer.appendChild(imgEl);
      }
    } catch {}
  notification.classList.remove('hidden');

    if (gifConfig.gifPath && gifSlot) {
      const cacheBust = `${gifConfig.width||0}x${gifConfig.height||0}-${Date.now()}`;
      gifSlot.innerHTML = `<img class="tip-gif-img" src="${gifConfig.gifPath}?v=${cacheBust}" alt="Tip GIF" />`;
      gifSlot.classList.remove('hidden');
    } else if (gifSlot) {
      gifSlot.classList.add('hidden'); gifSlot.innerHTML = '';
    }

    const DISPLAY_DURATION = 15000; const FADE_TIME = 500; const VISIBLE_TIME = DISPLAY_DURATION - FADE_TIME;
    setTimeout(() => {
      notification.classList.add('fade-out'); if (gifSlot) gifSlot.classList.add('fade-out');
      setTimeout(() => {
        notification.classList.add('hidden'); notification.classList.remove('fade-out');
        if (gifSlot) { gifSlot.classList.add('hidden'); gifSlot.innerHTML = ''; gifSlot.classList.remove('fade-out'); }
      }, FADE_TIME);
    }, VISIBLE_TIME);
  }

  function showError(message) {
    notification.innerHTML = `
      <div class="notification-content error">
        <div class="notification-icon">⚠️</div>
        <div class="notification-text">
          <div class="notification-title">Error</div>
          <div class="notification-from">${message}</div>
        </div>
      </div>`;
    notification.classList.remove('hidden');
    setTimeout(() => notification.classList.add('hidden'), 3000);
  }

  function showConnectionStatus(connected) {
    let statusElement = document.getElementById('connection-status');
    if (!statusElement) {
      statusElement = document.createElement('div');
      statusElement.id = 'connection-status';
      document.body.appendChild(statusElement);
    }
  statusElement.className = connected ? 'conn-status conn-online' : 'conn-status conn-offline';
  }

  let ws;
  try {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => { showConnectionStatus(true); };
    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ttsSettingUpdate') {
          if (Object.prototype.hasOwnProperty.call(msg.data || {}, 'ttsEnabled')) ttsEnabled = !!msg.data.ttsEnabled;
          if (Object.prototype.hasOwnProperty.call(msg.data || {}, 'ttsAllChat')) ttsAllChat = !!msg.data.ttsAllChat;
        }
        if (msg.type === 'ttsLanguageUpdate' && msg.data?.ttsLanguage) ttsLanguage = msg.data.ttsLanguage;
        if (msg.type === 'audioSettingsUpdate') audioSettings = { ...audioSettings, ...msg.data };
        if (msg.type === 'tipNotification') {
          await showDonationNotification({ ...msg.data, isDirectTip: true });
        } else if (msg.type === 'chatMessage' && msg.data?.credits > 0) {
          await showDonationNotification({ ...msg.data, isChatTip: true });
        } else if (msg.type === 'donation') {
          await showDonationNotification({ amount: msg.amount, from: msg.from, message: msg.message, isTestDonation: true });
        }
      } catch (e) { console.error('Error processing message:', e); showError('Error processing notification'); }
    };
    ws.onerror = (e) => { console.error('WebSocket Error:', e); showError('Server connection error'); };
    ws.onclose = () => { showConnectionStatus(false); };
  } catch {}

  // Initial config fetches
  (async () => {
    try { const r = await fetch('/api/tts-language'); if (r.ok) { const j = await r.json(); ttsLanguage = j.ttsLanguage || 'en'; } } catch {}
    try { const r = await fetch('/api/tts-setting'); if (r.ok) { const j = await r.json(); ttsEnabled = !!j.ttsEnabled; ttsAllChat = !!j.ttsAllChat; } } catch {}
    try { const r = await fetch('/api/audio-settings'); if (r.ok) { const j = await r.json(); audioSettings = { audioSource: j.audioSource || 'remote', hasCustomAudio: !!j.hasCustomAudio }; } } catch {}
  })();

  function isDemoOn() { try { return document.documentElement.getAttribute('data-demo-tips') === '1'; } catch { return false; } }
  function stopDemoLoop() { if (__tn_demoTimer) { clearInterval(__tn_demoTimer); __tn_demoTimer = null; } }
  function startDemoLoop() {
    stopDemoLoop();

    showDonationNotification({ amount: (Math.random()*2+0.1).toFixed(3), from: 'demo-wallet-'.concat(Math.random().toString(16).slice(2,8)), message: 'Thanks for the stream! 🎉', avatar: '/assets/odysee.png' });
    __tn_demoTimer = setInterval(() => {
      if (!isDemoOn()) { stopDemoLoop(); return; }
      const msgs = ['Great content!', 'Keep it up!', 'Love this!', 'Saluditos 👋', 'Increíble directo'];
      showDonationNotification({ amount: (Math.random()*3+0.05).toFixed(3), from: 'demo-'.concat(Math.random().toString(36).slice(2,7)), message: msgs[Math.floor(Math.random()*msgs.length)], avatar: '/assets/odysee.png' });
    }, 20000);
  }

  try {
    const obs = new MutationObserver(() => { if (isDemoOn()) startDemoLoop(); else stopDemoLoop(); });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-demo-tips'] });
    if (isDemoOn()) startDemoLoop();
  } catch {}
}

export default { initNotifications };
