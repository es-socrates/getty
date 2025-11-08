/// <reference types="vite/client" />

type TipNotificationRefs = {
  tipWrapper: HTMLElement;
  notification: HTMLElement;
  gifSlot: HTMLElement;
};

type ThemeName = 'classic' | 'deterministic';

declare global {
  interface Window {
    __tip_notification_widget_started?: boolean;
  }
}

const THEME_CLASSES = ['theme-classic', 'theme-deterministic'] as const;

export function mountTipNotification(refs: TipNotificationRefs): void {
  if (window.__tip_notification_widget_started) {
    return;
  }
  window.__tip_notification_widget_started = true;

  const notification = refs.notification;
  const tipWrapper = refs.tipWrapper;
  const gifSlot = refs.gifSlot;

  const start = async () => {
    const params = new URLSearchParams(window.location.search);
    const widgetToken = params.get('widgetToken') || '';
    const legacyToken = params.get('token') || widgetToken;
    const debugAudioEnabled = params.get('debugAudio') === '1';

    const buildUrl = (path: string, extra: Record<string, string | number | undefined> = {}) => {
      try {
        const url = new URL(path, window.location.origin);
        if (widgetToken && !url.searchParams.has('widgetToken')) {
          url.searchParams.set('widgetToken', widgetToken);
        }
        if (legacyToken && !url.searchParams.has('token')) {
          url.searchParams.set('token', legacyToken);
        }
        Object.entries(extra).forEach(([key, value]) => {
          if (value === undefined || value === null || value === '') return;
          url.searchParams.set(key, String(value));
        });
        return url.toString();
      } catch {
        return path;
      }
    };

    const isObsWidget = window.location.pathname.includes('/widgets/');
    if (isObsWidget) {
      notification.classList.add('tip-notification-widget');
    }

    // @ts-ignore Vite injects import.meta.env at build time
    const isDev = import.meta.env.DEV;
    // @ts-ignore Vite injects import.meta.env at build time
    const backendPort = import.meta.env.VITE_BACKEND_PORT || '3000';
    let wsPortOverride: string | null = null;
    let attemptedDevFallback = false;

    const TN_DEFAULTS = {
      bgColor: '#080c10',
      fontColor: '#ffffff',
      borderColor: '#00ff7f',
      amountColor: '#00ff7f',
      fromColor: '#ffffff'
    };

    let currentTheme: ThemeName = 'classic';

    function applyThemeClasses() {
      THEME_CLASSES.forEach((cls) => {
        tipWrapper.classList.remove(cls);
        notification.classList.remove(cls);
      });
      tipWrapper.classList.add(`theme-${currentTheme}`);
      notification.classList.add(`theme-${currentTheme}`);
    }

    function setTheme(next?: string | null) {
      currentTheme = next === 'deterministic' ? 'deterministic' : 'classic';
      applyThemeClasses();
    }

    applyThemeClasses();

    let gifConfig: { gifPath: string; position: 'left' | 'right' | 'top' | 'bottom'; width?: number; height?: number } = {
      gifPath: '',
      position: 'right'
    };
    let ws: WebSocket | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const reconnectDelay = 5000;
    let AR_TO_USD = 0;
    let ttsLanguage = 'en';
    let ttsAllChat = false;
    const REMOTE_SOUND_URL =
      'https://52agquhrbhkx3u72ikhun7oxngtan55uvxqbp4pzmhslirqys6wq.arweave.net/7oBoUPEJ1X3T-kKPRv3XaaYG97St4Bfx-WHktEYYl60';

    let audioSettings: {
      audioSource: 'remote' | 'custom';
      hasCustomAudio: boolean;
      enabled: boolean;
      volume: number;
    } = {
      audioSource: 'remote',
      hasCustomAudio: false,
      enabled: true,
      volume: 0.5
    };

    let lastAudioSettingsFetch = 0;
    const AUDIO_SETTINGS_TTL = 10_000;
    let EMOJI_MAPPING: Record<string, string> = {};

    try {
      const response = await fetch(`/emojis.json?nocache=${Date.now()}`);
      if (response.ok) {
        EMOJI_MAPPING = await response.json();
      }
    } catch (error) {
      console.error('[tip-notification] Failed to load emojis:', error);
    }

    function applyGifConfig() {
      tipWrapper.classList.remove('position-left', 'position-right', 'position-top', 'position-bottom');
      tipWrapper.classList.add(`position-${gifConfig.position || 'right'}`);
      gifSlot.classList.add('hidden');
      gifSlot.innerHTML = '';
    }

    async function loadGifConfig() {
      try {
        const response = await fetch(buildUrl('/api/tip-notification-gif', { v: Date.now() }));
        if (response.ok) {
          const payload = await response.json();
          if (payload && typeof payload === 'object') {
            gifConfig = {
              gifPath: typeof payload.gifPath === 'string' ? payload.gifPath : '',
              position: typeof payload.position === 'string' ? payload.position : 'right',
              width: payload.width,
              height: payload.height
            };
            applyGifConfig();
          }
        }
      } catch (error) {
        console.error('[tip-notification] Error loading GIF config:', error);
      }
    }

    function applyColorVars(cfg: Partial<typeof TN_DEFAULTS> & { theme?: string } = {}) {
      if (!isObsWidget) return;
      const merged = { ...TN_DEFAULTS, ...cfg };
      try {
        notification.style.setProperty('--tn-bg', merged.bgColor || TN_DEFAULTS.bgColor);
        notification.style.setProperty('--tn-text', merged.fontColor || TN_DEFAULTS.fontColor);
        notification.style.setProperty('--tn-border', merged.borderColor || TN_DEFAULTS.borderColor);
        notification.style.setProperty('--tn-amount', merged.amountColor || TN_DEFAULTS.amountColor);
        notification.style.setProperty('--tn-from', merged.fromColor || TN_DEFAULTS.fromColor);
      } catch (error) {
        console.warn('[tip-notification] Failed to apply color vars:', error);
      }
    }

    async function loadColorConfig() {
      if (!isObsWidget) return;
      try {
        const response = await fetch(buildUrl('/api/tip-notification', { ts: Date.now() }));
        if (response.ok) {
          const payload = await response.json();
          if (payload && typeof payload === 'object') {
            setTheme(payload.theme);
            applyColorVars({
              bgColor: payload.bgColor,
              fontColor: payload.fontColor,
              borderColor: payload.borderColor,
              amountColor: payload.amountColor,
              fromColor: payload.fromColor
            });
            return;
          }
        }
        setTheme(undefined);
        applyColorVars();
      } catch {
        setTheme(undefined);
        applyColorVars();
      }
    }

    function escapeHtml(text: string) {
      const div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML
        .replace(/&lt;stkr&gt;/g, '<stkr>')
        .replace(/&lt;\/stkr&gt;/g, '</stkr>');
    }

    function formatText(text: string) {
      if (!text) return '';
      let formatted = escapeHtml(text);
      formatted = formatted.replace(/<stkr>(.*?)<\/stkr>/g, (match, url) => {
        try {
          const decoded = decodeURIComponent(url);
          if (/^https?:\/\//i.test(decoded)) {
            return `<img src="${decoded}" alt="Sticker" class="comment-sticker" loading="lazy" />`;
          }
          return match;
        } catch {
          return match;
        }
      });
      if (EMOJI_MAPPING && typeof EMOJI_MAPPING === 'object') {
        for (const [code, url] of Object.entries(EMOJI_MAPPING)) {
          if (!code || !url) continue;
          const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const isSticker = url.includes('/stickers/');
          const cls = isSticker ? 'comment-sticker' : 'comment-emoji';
          formatted = formatted.replace(new RegExp(escapedCode, 'g'), `<img src="${url}" alt="${code}" class="${cls}" loading="lazy" />`);
        }
      }
      return formatted;
    }

    const shownTips = new Set<string>();

    function getReusableAudioElement(url: string) {
      return new Audio(url);
    }

    function perceptualVolume(linearVol: number) {
      return Math.pow(linearVol, 2);
    }

    let debugDiv: HTMLDivElement | null = null;
    function updateDebugOverlay(appliedVol?: number) {
      if (!debugAudioEnabled) return;
      if (!debugDiv) {
        debugDiv = document.createElement('div');
        debugDiv.style.cssText =
          'position:fixed;bottom:4px;left:4px;background:rgba(0,0,0,.65);color:#fff;font:12px/1.2 monospace;padding:6px 8px;z-index:9999;border:1px solid #444;border-radius:4px;';
        document.body.appendChild(debugDiv);
      }
      const applied = appliedVol !== undefined ? appliedVol : perceptualVolume(audioSettings.volume || 0);
      debugDiv.textContent = `Audio linear=${(audioSettings.volume ?? 0).toFixed(3)} applied=${applied.toFixed(3)} enabled=${audioSettings.enabled}`;
    }

    async function refreshAudioSettingsIfStale() {
      const now = Date.now();
      if (now - lastAudioSettingsFetch < AUDIO_SETTINGS_TTL) return;
      try {
        const response = await fetch(buildUrl('/api/audio-settings', { ts: now }));
        if (response.ok) {
          const payload = await response.json();
          if (payload && typeof payload === 'object') {
            audioSettings = {
              audioSource: (payload.audioSource || audioSettings.audioSource || 'remote') as 'remote' | 'custom',
              hasCustomAudio: !!payload.hasCustomAudio,
              enabled: typeof payload.enabled === 'boolean' ? payload.enabled : audioSettings.enabled,
              volume:
                typeof payload.volume === 'number' && payload.volume >= 0 && payload.volume <= 1
                  ? payload.volume
                  : audioSettings.volume
            };
            updateDebugOverlay();
          }
        }
      } catch (error) {
        console.warn('[tip-notification] Failed to refresh audio settings:', error);
      }
      lastAudioSettingsFetch = Date.now();
    }

    async function playNotificationSound() {
      await refreshAudioSettingsIfStale();
      if (!audioSettings.enabled) return;
      let audioUrl = REMOTE_SOUND_URL;
      if (audioSettings.audioSource === 'custom' && audioSettings.hasCustomAudio) {
        try {
          const response = await fetch(buildUrl('/api/custom-audio'));
          if (response.ok) {
            const payload = await response.json();
            if (payload && typeof payload.url === 'string' && payload.url) {
              audioUrl = payload.url;
            }
          } else {
            console.error('[tip-notification] Failed to fetch custom audio URL:', response.status);
          }
        } catch (error) {
          console.error('[tip-notification] Error fetching custom audio URL:', error);
        }
      }

      return new Promise<void>((resolve) => {
        const attemptPlay = (url: string, label: string) => {
          try {
            const audio = getReusableAudioElement(url);
            audio.currentTime = 0;
            const appliedVolume = perceptualVolume(audioSettings.volume || 0);
            audio.volume = appliedVolume;
            updateDebugOverlay(appliedVolume);
            audio.addEventListener(
              'ended',
              () => {
                console.warn(label, `(linear=${(audioSettings.volume || 0).toFixed(2)}, applied=${appliedVolume})`);
                resolve();
              },
              { once: true }
            );
            audio.play().catch((error) => {
              console.error('[tip-notification] Audio play failed:', error);
              if (url !== REMOTE_SOUND_URL) {
                attemptPlay(REMOTE_SOUND_URL, '🎵 Remote audio played (fallback)');
              } else {
                resolve();
              }
            });
          } catch (error) {
            console.error('[tip-notification] Audio init error:', error);
            resolve();
          }
        };

        attemptPlay(audioUrl, audioUrl === REMOTE_SOUND_URL ? '🎵 Remote audio played' : '🎵 Custom audio played');
        lastAudioSettingsFetch = Date.now() - (AUDIO_SETTINGS_TTL - 2500);
      });
    }

    function showError(message: string) {
      notification.innerHTML = `
        <div class="notification-content error">
          <div class="notification-icon">⚠️</div>
          <div class="notification-text">
            <div class="notification-title">Error</div>
            <div class="notification-from">${message}</div>
          </div>
        </div>
      `;
      notification.classList.remove('hidden');
      setTimeout(() => notification.classList.add('hidden'), 3000);
    }

    function showConnectionStatus(connected: boolean) {
      let statusElement = document.getElementById('connection-status');
      if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'connection-status';
        document.body.appendChild(statusElement);
      }
      statusElement.className = connected ? 'conn-status conn-online' : 'conn-status conn-offline';
    }

    function resolveSocketHost() {
      if (wsPortOverride) {
        return `${window.location.hostname}:${wsPortOverride}`;
      }
      return window.location.host;
    }

    function buildWsUrl() {
      const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
      const host = resolveSocketHost();
      const search = new URLSearchParams();
      if (widgetToken) search.set('widgetToken', widgetToken);
      if (legacyToken) search.set('token', legacyToken);
      const query = search.toString();
      return query ? `${protocol}${host}?${query}` : `${protocol}${host}`;
    }

    async function updateExchangeRate() {
      try {
        const response = await fetch(buildUrl('/api/ar-price'));
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const textData = await response.text();
        console.warn('[tip-notification] Exchange rate response:', textData);
        const payload = JSON.parse(textData);
        if (payload?.arweave?.usd) {
          AR_TO_USD = payload.arweave.usd;
          console.warn(`[tip-notification] Updated exchange rate: 1 AR = $${AR_TO_USD} USD`);
        } else if (!AR_TO_USD) {
          AR_TO_USD = 5;
        }
      } catch (error) {
        console.error('[tip-notification] Error updating exchange rate:', error);
        if (!AR_TO_USD) {
          AR_TO_USD = 5;
        }
        if (String((error as Error).message || '').includes('Failed to fetch')) {
          showError('Failed to connect to exchange rate service');
        }
      }
    }

    let ttsEnabled = true;

    function updateTTSStatus(enabled: unknown) {
      if (typeof enabled !== 'boolean') {
        ttsEnabled = Boolean(enabled);
        return;
      }
      ttsEnabled = enabled;
    }

    async function checkTTSStatus() {
      try {
        const response = await fetch(buildUrl('/api/tts-setting'));
        if (response.ok) {
          const payload = await response.json();
          if (payload && Object.prototype.hasOwnProperty.call(payload, 'ttsEnabled')) {
            ttsEnabled = !!payload.ttsEnabled;
          }
        }
      } catch (error) {
        console.error('[tip-notification] Error checking TTS status:', error);
      }
    }

    function stripEmojis(text: string) {
      if (!text) return '';
      let cleaned = text.replace(/:[^:\s]+:/g, '');
      cleaned = cleaned.replace(/<stkr>.*?<\/stkr>/g, '');
        cleaned = cleaned.replace(/[\u0000-\u001F]/g, '');
      cleaned = cleaned.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
      cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
      return cleaned;
    }

    function selectVoice(utterance: SpeechSynthesisUtterance, voices: SpeechSynthesisVoice[]) {
      if (ttsLanguage === 'en') {
        const usMaleVoices = voices.filter(
          (voice) =>
            voice.lang.startsWith('en') &&
            (voice.name.toLowerCase().includes('male') ||
              voice.name.toLowerCase().includes('hombre') ||
              voice.name.toLowerCase().includes('masc') ||
              !voice.name.toLowerCase().includes('female'))
        );
        const anyEnglish = voices.filter((voice) => voice.lang.startsWith('en'));
        if (usMaleVoices.length > 0) {
          utterance.voice = usMaleVoices[0];
        } else if (anyEnglish.length > 0) {
          utterance.voice = anyEnglish[0];
        }
      } else {
        const mexicanMaleVoices = voices.filter(
          (voice) => (voice.lang.includes('es-MX') || voice.lang.includes('es-mx')) && voice.name.toLowerCase().includes('microsoft')
        );
        const latinMaleVoices = voices.filter(
          (voice) => (voice.lang.includes('es-419') || voice.lang.includes('es-LA')) && voice.name.toLowerCase().includes('microsoft')
        );
        const anySpanishMale = voices.filter(
          (voice) =>
            voice.lang.includes('es') &&
            (voice.name.toLowerCase().includes('male') ||
              voice.name.toLowerCase().includes('hombre') ||
              voice.name.toLowerCase().includes('masc') ||
              !voice.name.toLowerCase().includes('female'))
        );
        const anySpanish = voices.filter((voice) => voice.lang.includes('es'));
        if (mexicanMaleVoices.length > 0) {
          utterance.voice = mexicanMaleVoices[0];
        } else if (latinMaleVoices.length > 0) {
          utterance.voice = latinMaleVoices[0];
        } else if (anySpanishMale.length > 0) {
          utterance.voice = anySpanishMale[0];
        } else if (anySpanish.length > 0) {
          utterance.voice = anySpanish[0];
        }
      }
    }

    function speakMessage(message: string) {
      if (!message || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(stripEmojis(message));
      utterance.volume = perceptualVolume(audioSettings.volume || 0);
      utterance.rate = 1;
      utterance.pitch = 0.9;
      let voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          voices = window.speechSynthesis.getVoices();
          selectVoice(utterance, voices);
          window.speechSynthesis.speak(utterance);
        };
      } else {
        selectVoice(utterance, voices);
        window.speechSynthesis.speak(utterance);
      }
    }

    async function showDonationNotification(data: any) {
      const uniqueId = data.isDirectTip
        ? `direct-${data.txId}`
        : `chat-${data.id || `${data.from || ''}${data.amount || ''}${data.message || ''}`}`;

      if (!data.isTestDonation && shownTips.has(uniqueId)) {
        return;
      }
      shownTips.add(uniqueId);

      notification.classList.add('hidden');
      void notification.offsetWidth;

      if (!(typeof data.usdAmount === 'number' && typeof data.arAmount === 'number')) {
        await updateExchangeRate();
      } else if (!AR_TO_USD && data.arAmount > 0) {
        AR_TO_USD = data.usdAmount / data.arAmount;
      }

      const originalMessage = data.message || '';
      const emojiCodes = originalMessage.match(/:[^:\s]{1,32}:/g) || [];
      let truncated = originalMessage;
      if (originalMessage.length > 80 && !(emojiCodes.length >= 3 && originalMessage.length <= 160)) {
        truncated = `${originalMessage.substring(0, 80)}...`;
      }

      const formattedMessage = /<img[^>]+class="(?:comment-emoji|comment-sticker)"/i.test(truncated)
        ? truncated
        : truncated
        ? formatText(truncated)
        : '';

      const isChatTipHeuristic = !!data.isChatTip && (data.amount === undefined || data.amount === null);
      const creditsIsUsd = !!data.creditsIsUsd;
      let rawAr = 0;
      let rawUsd = 0;

      if (typeof data.usdAmount === 'number' && typeof data.arAmount === 'number') {
        rawUsd = data.usdAmount;
        rawAr = data.arAmount;
      } else if (isChatTipHeuristic || creditsIsUsd) {
        rawUsd = parseFloat(data.credits || 0) || 0;
        rawAr = AR_TO_USD > 0 ? rawUsd / AR_TO_USD : rawUsd / 5;
      } else {
        rawAr = parseFloat(data.amount || data.credits || 0) || 0;
        rawUsd = AR_TO_USD > 0 ? rawAr * AR_TO_USD : rawAr * 5;
      }

      const arAmount = rawAr.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
      });
      const usdAmount = rawUsd.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      const senderInfo = data.from ? `📦 From: ${data.from.slice(0, 8)}...` : `🏷️ From: ${data.channelTitle || 'Anonymous'}`;

      if (currentTheme === 'deterministic') {
        notification.innerHTML = `
          <div class="notification-content deterministic">
            <div class="det-card">
              <div class="det-card__header">
                <div class="det-card__badge">Tip Received</div>
                <div class="det-card__amount">${arAmount} AR</div>
              </div>
              <div class="det-card__usd">($${usdAmount} USD)</div>
              <div class="det-card__from">${senderInfo}</div>
              ${formattedMessage ? `<div class="det-card__msg">${formattedMessage}</div>` : ''}
            </div>
          </div>
        `;
      } else {
        notification.innerHTML = `
          <div class="notification-content classic">
            <div class="notification-icon"></div>
            <div class="notification-text">
              <div class="notification-title">🎉 Tip Received. Woohoo!</div>
              <div class="amount-container">
                <span class="ar-amount">${arAmount} AR</span>
                <span class="usd-value">($${usdAmount} USD)</span>
              </div>
              <div class="notification-from">
                ${senderInfo} <span class="thank-you">👏</span>
              </div>
              ${formattedMessage ? `<div class="notification-message">${formattedMessage}</div>` : ''}
            </div>
          </div>
        `;

        try {
          const iconContainer = notification.querySelector('.notification-icon');
          if (iconContainer) {
            const imgEl = document.createElement('img');
            imgEl.src = data.avatar || '/assets/odysee.png';
            imgEl.alt = '💰';
            imgEl.addEventListener('error', () => {
              imgEl.classList.add('hidden');
              iconContainer.textContent = '💰';
            });
            iconContainer.appendChild(imgEl);
          }
        } catch (error) {
          console.error('[tip-notification] Failed to render avatar:', error);
        }
      }

      if (gifConfig.gifPath) {
        await new Promise<void>((resolve) => {
          const img = document.createElement('img');
          img.className = 'tip-gif-img';
          img.alt = 'Tip GIF';
          img.onload = () => {
            gifSlot.innerHTML = '';
            gifSlot.appendChild(img);
            gifSlot.classList.remove('hidden');
            resolve();
          };
          img.onerror = () => resolve();
          const cacheBust = `${gifConfig.width || 0}x${gifConfig.height || 0}-${Date.now()}`;
          img.src = `${gifConfig.gifPath}?v=${cacheBust}`;
        });
      } else {
        gifSlot.classList.add('hidden');
      }

      notification.classList.remove('hidden');

      await playNotificationSound();

      if (ttsEnabled) {
        const rawForTts = originalMessage || '';
        if ((data.isChatTip || ttsAllChat) && rawForTts) {
          speakMessage(rawForTts);
        }
      }

      const DISPLAY_DURATION = 5000;
      const FADE_TIME = 500;
      const VISIBLE_TIME = DISPLAY_DURATION - FADE_TIME;

      setTimeout(() => {
        notification.classList.add('fade-out');
        gifSlot.classList.add('fade-out');
        setTimeout(() => {
          notification.classList.add('hidden');
          notification.classList.remove('fade-out');
          gifSlot.classList.add('hidden');
          gifSlot.innerHTML = '';
          gifSlot.classList.remove('fade-out');
        }, FADE_TIME);
      }, VISIBLE_TIME);
    }

    function connectWebSocket() {
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
      }

      try {
        const wsUrl = buildWsUrl();
        console.warn('[tip-notification] Connecting to WebSocket:', wsUrl);
        ws = new WebSocket(wsUrl);
      } catch (error) {
        console.error('[tip-notification] WebSocket init failed:', error);
        setTimeout(connectWebSocket, reconnectDelay);
        return;
      }

      ws.onopen = () => {
        console.warn('[tip-notification] WebSocket connected');
        reconnectAttempts = 0;
        showConnectionStatus(true);
      };

      ws.onmessage = async (event: MessageEvent<string>) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ttsSettingUpdate' && msg.data) {
            if (Object.prototype.hasOwnProperty.call(msg.data, 'ttsEnabled')) {
              updateTTSStatus(msg.data.ttsEnabled);
            }
            if (Object.prototype.hasOwnProperty.call(msg.data, 'ttsAllChat')) {
              ttsAllChat = !!msg.data.ttsAllChat;
            }
          }

          if (msg.type === 'ttsLanguageUpdate' && msg.data?.ttsLanguage) {
            ttsLanguage = msg.data.ttsLanguage;
          }

          if (msg.type === 'audioSettingsUpdate' && msg.data) {
            audioSettings = { ...audioSettings, ...msg.data };
            if (typeof msg.data.volume === 'number') {
              audioSettings.volume = Math.min(1, Math.max(0, msg.data.volume));
            }
            if (Object.prototype.hasOwnProperty.call(msg.data, 'enabled')) {
              audioSettings.enabled = msg.data.enabled !== false;
            }
            updateDebugOverlay();
          }

          if (msg.type === 'tipNotificationConfigUpdate' && msg.data) {
            setTheme(msg.data.theme);
            applyColorVars({
              bgColor: msg.data.bgColor,
              fontColor: msg.data.fontColor,
              borderColor: msg.data.borderColor,
              amountColor: msg.data.amountColor,
              fromColor: msg.data.fromColor
            });
          }

          if (msg.type === 'tipNotification') {
            await showDonationNotification({ ...msg.data, isDirectTip: true });
          } else if (msg.type === 'chatMessage' && msg.data?.credits > 0) {
            await showDonationNotification({ ...msg.data, isChatTip: true });
          } else if (msg.type === 'donation' || msg.type === 'tip') {
            await showDonationNotification({
              amount: msg.amount ?? msg.data?.amount,
              from: msg.from ?? msg.data?.from,
              message: msg.message ?? msg.data?.message,
              isTestDonation: true
            });
          }
        } catch (error) {
          console.error('[tip-notification] Error processing message:', error);
          showError('Error processing notification');
        }
      };

      ws.onerror = (error) => {
        console.error('[tip-notification] WebSocket error:', error);
        showError('Server connection error');
      };

      ws.onclose = () => {
        console.warn('[tip-notification] WebSocket closed, attempting to reconnect...');
        showConnectionStatus(false);
        if (
          isDev &&
          !attemptedDevFallback &&
          !wsPortOverride &&
          window.location.port &&
          window.location.port !== backendPort
        ) {
          attemptedDevFallback = true;
          wsPortOverride = backendPort;
          reconnectAttempts = 0;
          setTimeout(connectWebSocket, 200);
          return;
        }
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts += 1;
          setTimeout(connectWebSocket, reconnectDelay);
        } else {
          console.error('[tip-notification] Max reconnect attempts reached');
        }
      };
    }

    applyGifConfig();
    await loadGifConfig();
    await loadColorConfig();
    await checkTTSStatus();
    connectWebSocket();

    (async () => {
      try {
        const response = await fetch(buildUrl('/api/audio-settings'));
        if (response.ok) {
          const payload = await response.json();
          if (payload && typeof payload === 'object') {
            audioSettings = {
              audioSource: (payload.audioSource || 'remote') as 'remote' | 'custom',
              hasCustomAudio: !!payload.hasCustomAudio,
              enabled: typeof payload.enabled === 'boolean' ? payload.enabled : true,
              volume:
                typeof payload.volume === 'number' && payload.volume >= 0 && payload.volume <= 1
                  ? payload.volume
                  : 0.5
            };
            updateDebugOverlay();
          }
        }
      } catch (error) {
        console.warn('[tip-notification] Failed to load initial audio settings:', error);
      }

      try {
        const response = await fetch(buildUrl('/api/tts-language'));
        if (response.ok) {
          const payload = await response.json();
          if (payload && typeof payload.ttsLanguage === 'string') {
            ttsLanguage = payload.ttsLanguage;
          }
        }
      } catch (error) {
        console.warn('[tip-notification] Failed to load TTS language:', error);
      }
    })();

    setInterval(() => {
      loadColorConfig();
      loadGifConfig();
      refreshAudioSettingsIfStale();
    }, 15000);

    window.addEventListener('beforeunload', () => {
      try {
        if (ws) ws.close();
      } catch {}
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        start().catch((error) => console.error('[tip-notification] Failed to initialize:', error));
      },
      { once: true }
    );
  } else {
    start().catch((error) => console.error('[tip-notification] Failed to initialize:', error));
  }
}
