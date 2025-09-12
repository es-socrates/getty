document.addEventListener('DOMContentLoaded', async () => {
    const notification = document.getElementById('notification');
    const tipWrapper = document.getElementById('tip-wrapper');
    const gifSlot = document.getElementById('notification-gif');
    let gifConfig = { gifPath: '', position: 'right' };

    async function loadGifConfig() {
        try {
            const res = await fetch('/api/tip-notification-gif');
            if (res.ok) {
                gifConfig = await res.json();
                applyGifConfig();
            }
        } catch (e) { console.error('Error loading GIF config:', e); }
    }

    function applyGifConfig() {
        if (!tipWrapper) return;
        tipWrapper.classList.remove('position-left','position-right','position-top','position-bottom');
        tipWrapper.classList.add('position-' + (gifConfig.position || 'right'));
        if (gifSlot) {
            gifSlot.classList.add('hidden');
            gifSlot.innerHTML = '';
        }
    }

    loadGifConfig();
    
    const isOBSWidget = window.location.pathname.includes('/widgets/');
    if (isOBSWidget && notification) {
        notification.classList.add('tip-notification-widget');
    }
    
    function getCookie(name){
        try { return document.cookie.split('; ').find(r=>r.startsWith(name+'='))?.split('=')[1] || ''; } catch { return ''; }
    }
    const __token = getCookie('getty_public_token') || getCookie('getty_admin_token') || new URLSearchParams(location.search).get('token') || '';
    const ws = new WebSocket(`${location.protocol==='https:'?'wss://':'ws://'}${window.location.host}${__token?`/?token=${encodeURIComponent(__token)}`:''}`);
    let AR_TO_USD = 0;
    let ttsLanguage = 'en'; // Global TTS Language
    let ttsAllChat = false; // Speak all chat messages optionally

    const REMOTE_SOUND_URL = 'https://52agquhrbhkx3u72ikhun7oxngtan55uvxqbp4pzmhslirqys6wq.arweave.net/7oBoUPEJ1X3T-kKPRv3XaaYG97St4Bfx-WHktEYYl60';
    
    let audioSettings = {
        audioSource: 'remote',
        hasCustomAudio: false,
        enabled: true,
        volume: 0.5
    };

    let lastAudioSettingsFetch = 0;
    const AUDIO_SETTINGS_TTL = 10_000; // ms

    async function refreshAudioSettingsIfStale(force = false) {
        const now = Date.now();
        if (!force && (now - lastAudioSettingsFetch) < AUDIO_SETTINGS_TTL) return;
        try {
            const res = await fetch('/api/audio-settings', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                audioSettings = {
                    audioSource: data.audioSource || 'remote',
                    hasCustomAudio: !!data.hasCustomAudio,
                    enabled: data.enabled !== false,
                    volume: typeof data.volume === 'number' ? Math.min(1, Math.max(0, data.volume)) : 0.5
                };
                lastAudioSettingsFetch = now;
                updateDebugOverlay();
            }
        } catch (e) {
            console.warn('Failed to refresh audio settings', e);
        }
    }

    let reusableAudioEl = null;
    function getReusableAudioElement(url) {
        if (!reusableAudioEl) {
            reusableAudioEl = new Audio(url);
        } else if (reusableAudioEl.src !== new URL(url, location.origin).href) {
            reusableAudioEl.src = url;
        }
        return reusableAudioEl;
    }

    function perceptualVolume(linear) {
        const clamped = Math.min(1, Math.max(0, linear || 0));
        return +(clamped * clamped).toFixed(4);
    }

    async function playNotificationSound() {
        await refreshAudioSettingsIfStale();
        if (!audioSettings.enabled) return;
        let audioUrl;
        let logMessage;
        if (audioSettings.audioSource === 'custom' && audioSettings.hasCustomAudio) {
            audioUrl = '/api/custom-audio';
            logMessage = '🎵 Custom audio played';
        } else {
            audioUrl = REMOTE_SOUND_URL;
            logMessage = '🎵 Remote audio played';
        }
        try {
            const audio = getReusableAudioElement(audioUrl);
            audio.currentTime = 0;
            const appliedVol = perceptualVolume(audioSettings.volume);
            audio.volume = appliedVol;
            updateDebugOverlay(appliedVol);
            audio.play()
                .then(() => console.log(logMessage, `(linear=${audioSettings.volume.toFixed(2)}, applied=${appliedVol})`))
                .catch(err => {
                    console.error('Audio play failed:', err);
                    if (audioUrl !== REMOTE_SOUND_URL) {
                        const fallback = getReusableAudioElement(REMOTE_SOUND_URL);
                        fallback.currentTime = 0;
                        const fbVol = perceptualVolume(audioSettings.volume);
                        fallback.volume = fbVol;
                        updateDebugOverlay(fbVol);
                        fallback.play().catch(e => console.error('Fallback audio failed:', e));
                    }
                });
        } catch (e) {
            console.error('Audio init error:', e);
        } finally {
            lastAudioSettingsFetch = Date.now() - (AUDIO_SETTINGS_TTL - 2500);
        }
    }

    function formatText(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML
            .replace(/&lt;stkr&gt;/g, '<stkr>')
            .replace(/&lt;\/stkr&gt;/g, '</stkr>');
    }

    ws.onopen = () => {
        showConnectionStatus(true);
    };

    ws.onmessage = async (event) => {
        try {
            const msg = JSON.parse(event.data);

            if (msg.type === 'ttsSettingUpdate') {
                if (Object.prototype.hasOwnProperty.call(msg.data || {}, 'ttsEnabled')) {
                    updateTTSStatus(msg.data.ttsEnabled);
                }
                if (Object.prototype.hasOwnProperty.call(msg.data || {}, 'ttsAllChat')) {
                    ttsAllChat = !!msg.data.ttsAllChat;
                }
            }

            if (msg.type === 'ttsLanguageUpdate' && msg.data?.ttsLanguage) {
                ttsLanguage = msg.data.ttsLanguage;
            }
            
            if (msg.type === 'audioSettingsUpdate') {
                audioSettings = { ...audioSettings, ...msg.data };
                if (typeof msg.data.volume === 'number') {
                    audioSettings.volume = Math.min(1, Math.max(0, msg.data.volume));
                }
                if (Object.prototype.hasOwnProperty.call(msg.data,'enabled')) {
                    audioSettings.enabled = msg.data.enabled !== false;
                }
                updateDebugOverlay();
            }
            
            if (msg.type === 'tipNotification') {
                await showDonationNotification({
                    ...msg.data,
                    isDirectTip: true
                });
            } else if (msg.type === 'chatMessage' && msg.data?.credits > 0) {
                await showDonationNotification({
                    ...msg.data,
                    isChatTip: true
                });
        } else if (msg.type === 'donation' || msg.type === 'tip') {
                await showDonationNotification({
            amount: msg.amount ?? msg.data?.amount,
            from: msg.from ?? msg.data?.from,
            message: msg.message ?? msg.data?.message,
                    isTestDonation: true
                });
            }

        } catch (error) {
            console.error('Error processing message:', error);
            showError('Error processing notification');
        }
    };

    async function loadInitialTTSLanguage() {
        try {
            const response = await fetch('/api/tts-language');
            if (response.ok) {
                const data = await response.json();
                ttsLanguage = data.ttsLanguage || 'en';

            }
        } catch (error) {
            console.error('Error loading initial TTS language:', error);
        }
    }
    loadInitialTTSLanguage();

    async function loadInitialTTSStatus() {
        try {
            const response = await fetch('/api/tts-setting');
            if (response.ok) {
                const data = await response.json();
                updateTTSStatus(data.ttsEnabled);
                ttsAllChat = !!data.ttsAllChat;
            }
        } catch (error) {
            console.error('Error loading initial TTS status:', error);
        }
    }

    loadInitialTTSStatus();

    async function loadInitialAudioSettings() {
        await refreshAudioSettingsIfStale(true);
    }

    loadInitialAudioSettings();

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        showError('Server connection error');
    };

    ws.onclose = () => {
        showConnectionStatus(false);
    };

async function updateExchangeRate() {
    try {
        const response = await fetch('/api/ar-price');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Response is not JSON');
        }
        
        const textData = await response.text();
        console.log('[DEBUG] API Response:', textData);
        
        const data = JSON.parse(textData);
        
        if (data?.arweave?.usd) {
            AR_TO_USD = data.arweave.usd;
            console.log(`✅ Updated exchange rate: 1 AR = $${AR_TO_USD} USD`);
        } else {
            console.warn('⚠️ Exchange rate data not in expected format, using fallback');
            AR_TO_USD = AR_TO_USD || 5;
        }
    } catch (error) {
        console.error('Error updating exchange rate:', error);
        AR_TO_USD = AR_TO_USD || 5;
        
        if (error.message.includes('Failed to fetch')) {
            showError('Failed to connect to exchange rate service');
        }
    }
}

const shownTips = new Set();

let ttsEnabled = true;

function updateTTSStatus(enabled) {
    ttsEnabled = enabled;
    
    if (typeof enabled !== 'boolean') {
        console.warn('Invalid TTS status received, forcing to boolean');
        ttsEnabled = Boolean(enabled);
    }
}

async function checkTTSStatus() {
    try {
        const response = await fetch('/api/tts-setting');
        if (response.ok) {
            const data = await response.json();
            ttsEnabled = data.ttsEnabled;
        }
    } catch (error) {
        console.error('Error checking TTS status:', error);
    }
}

checkTTSStatus();

function stripEmojis(text) {
    if (!text) return '';
    let cleaned = text.replace(/:[^:\s]+:/g, '');
    cleaned = cleaned.replace(/<stkr>.*?<\/stkr>/g, '');
    cleaned = cleaned.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    return cleaned;
}

function speakMessage(message) {
    if (!message || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(stripEmojis(message));
    utterance.volume = perceptualVolume(audioSettings.volume);
    utterance.rate = 1; // Normal speed
    utterance.pitch = 0.9; // A little deeper to sound more masculine
    
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

function selectVoice(utterance, voices) {

    if (ttsLanguage === 'en') {
        const usMaleVoices = voices.filter(voice =>
            voice.lang.startsWith('en') &&
            (voice.name.toLowerCase().includes('male') ||
             voice.name.toLowerCase().includes('hombre') ||
             voice.name.toLowerCase().includes('masc') ||
             !voice.name.toLowerCase().includes('female'))
        );
        const anyEnglish = voices.filter(voice => voice.lang.startsWith('en'));
        if (usMaleVoices.length > 0) {
            utterance.voice = usMaleVoices[0];
            console.log('Using male voice in English:', usMaleVoices[0].name);
        } else if (anyEnglish.length > 0) {
            utterance.voice = anyEnglish[0];
            console.log('Using English voice:', anyEnglish[0].name);
        } else {
            console.log('Using the browsers default voice');
        }
    } else {
        const mexicanMaleVoices = voices.filter(voice => 
            (voice.lang.includes('es-MX') || voice.lang.includes('es-MX')) &&
            voice.name.toLowerCase().includes('microsoft')
        );
        const latinMaleVoices = voices.filter(voice => 
            (voice.lang.includes('es-419') || voice.lang.includes('es-LA')) &&
            voice.name.toLowerCase().includes('microsoft')
        );
        const anySpanishMale = voices.filter(voice => 
            voice.lang.includes('es') && 
            (voice.name.toLowerCase().includes('male') || 
             voice.name.toLowerCase().includes('hombre') ||
             voice.name.toLowerCase().includes('masc') ||
             !voice.name.toLowerCase().includes('female'))
        );
        const anySpanish = voices.filter(voice => voice.lang.includes('es'));
        if (mexicanMaleVoices.length > 0) {
            utterance.voice = mexicanMaleVoices[0];
            console.log('Usando voz mexicana masculina:', mexicanMaleVoices[0].name);
        } else if (latinMaleVoices.length > 0) {
            utterance.voice = latinMaleVoices[0];
            console.log('Usando voz latinoamericana masculina:', latinMaleVoices[0].name);
        } else if (anySpanishMale.length > 0) {
            utterance.voice = anySpanishMale[0];
            console.log('Usando voz masculina en español:', anySpanishMale[0].name);
        } else if (anySpanish.length > 0) {
            utterance.voice = anySpanish[0];
            console.log('Usando voz en español:', anySpanish[0].name);
        } else {
            console.log('Usando voz predeterminada del navegador');
        }
    }
}

    const debugAudioEnabled = new URLSearchParams(location.search).get('debugAudio') === '1';
    let debugDiv = null;
    function updateDebugOverlay(appliedVol) {
        if (!debugAudioEnabled) return;
        if (!debugDiv) {
            debugDiv = document.createElement('div');
            debugDiv.style.cssText = 'position:fixed;bottom:4px;left:4px;background:rgba(0,0,0,.65);color:#fff;font:12px/1.2 monospace;padding:6px 8px;z-index:9999;border:1px solid #444;border-radius:4px;';
            document.body.appendChild(debugDiv);
        }
        debugDiv.textContent = `Audio linear=${(audioSettings.volume??0).toFixed(3)} applied=${(appliedVol!==undefined?appliedVol:perceptualVolume(audioSettings.volume)).toFixed(3)} enabled=${audioSettings.enabled}`;
    }

async function showDonationNotification(data) {
    const uniqueId = data.isDirectTip 
        ? `direct-${data.txId}` 
        : `chat-${data.id || (data.from + data.amount + data.message)}`;

    if (shownTips.has(uniqueId)) {
        return;
    }
    shownTips.add(uniqueId);

    playNotificationSound();
    notification.classList.add('hidden');
    void notification.offsetWidth;

    if (!(typeof data.usdAmount === 'number' && typeof data.arAmount === 'number')) {
        await updateExchangeRate();
    } else {
        if (!AR_TO_USD && data.arAmount > 0) {
            AR_TO_USD = data.usdAmount / data.arAmount;
        }
    }
    
    const formattedMessage = data.message ? formatText(data.message) : '';
    const isChatTipHeuristic = !!data.isChatTip && (data.amount === undefined || data.amount === null);
    const creditsIsUsd = !!data.creditsIsUsd;
    let rawAr = 0, rawUsd = 0;
    if (typeof data.usdAmount === 'number' && typeof data.arAmount === 'number') {
        rawUsd = data.usdAmount;
        rawAr = data.arAmount;
    } else if (isChatTipHeuristic || creditsIsUsd) {
        rawUsd = parseFloat(data.credits || 0) || 0;
        rawAr = AR_TO_USD > 0 ? (rawUsd / AR_TO_USD) : (rawUsd / 5);
    } else {
        rawAr = parseFloat(data.amount || data.credits || 0) || 0;
        rawUsd = AR_TO_USD > 0 ? (rawAr * AR_TO_USD) : (rawAr * 5);
    }

    const arAmount = rawAr.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
    });
    const usdAmount = rawUsd.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    const senderInfo = data.from 
        ? `📦 From: ${data.from.slice(0, 8)}...` 
        : `🏷️ From: ${data.channelTitle || 'Anonymous'}`;

    if (ttsEnabled) {
        const toSpeak = formattedMessage || '';
        if ((data.isChatTip || ttsAllChat) && toSpeak) {
            speakMessage(toSpeak);
        }
    }

    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon"></div>
            <div class="notification-text">
                <div class="notification-title">🎉 ${data.credits ? 'Tip Received. Woohoo!' : 'Tip Received. Woohoo!'}</div>
                <div class="amount-container">
                    <span class="ar-amount">${arAmount} AR</span>
                    <span class="usd-value">($${usdAmount} USD${isChatTipHeuristic ? '' : ''})</span>
                </div>
                <div class="notification-from">
                    ${senderInfo} <span class="thank-you">👏</span>
                </div>
                ${formattedMessage ? `
                <div class="notification-message">
                    ${formattedMessage.length > 80 
                        ? formattedMessage.substring(0, 80) + '...' 
                        : formattedMessage}
                </div>
                ` : ''}
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
    } catch {}
    notification.classList.remove('hidden');

    if (gifConfig.gifPath && gifSlot) {
        const cacheBust = `${gifConfig.width||0}x${gifConfig.height||0}-${Date.now()}`;
    gifSlot.innerHTML = `<img class="tip-gif-img" src="${gifConfig.gifPath}?v=${cacheBust}" alt="Tip GIF" />`;
    gifSlot.classList.remove('hidden');
    } else if (gifSlot) {
    gifSlot.classList.add('hidden');
        gifSlot.innerHTML = '';
    }

    const DISPLAY_DURATION = 15000;
    const FADE_TIME = 500;
    const VISIBLE_TIME = DISPLAY_DURATION - FADE_TIME;

    setTimeout(() => {
        notification.classList.add('fade-out');
        if (gifSlot) gifSlot.classList.add('fade-out');
        setTimeout(() => {
            notification.classList.add('hidden');
            notification.classList.remove('fade-out');
            if (gifSlot) {
                gifSlot.classList.add('hidden');
                gifSlot.innerHTML = '';
                gifSlot.classList.remove('fade-out');
            }
        }, FADE_TIME);
    }, VISIBLE_TIME);
}

// Keyframes are defined in tip-notification.css (no inline <style> injection needed).

    function showError(message) {
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

    function showConnectionStatus(connected) {
        let statusElement = document.getElementById('connection-status');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'connection-status';
            document.body.appendChild(statusElement);
        }
        // statusElement.textContent = connected ? '🟢 Connected' : '🔴 Offline';
    statusElement.className = connected ? 'conn-status conn-online' : 'conn-status conn-offline';
    }
});
