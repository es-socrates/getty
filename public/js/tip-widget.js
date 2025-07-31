document.addEventListener('DOMContentLoaded', async () => {
    const notification = document.getElementById('notification');
    
    const isOBSWidget = window.location.pathname.includes('/widgets/');
    if (isOBSWidget && notification) {
        notification.classList.add('tip-notification-widget');
    }
    
    const ws = new WebSocket(`ws://${window.location.host}`);
    let AR_TO_USD = 0;
    let ttsLanguage = 'en'; // Global TTS Language

    const REMOTE_SOUND_URL = 'https://cdn.streamlabs.com/users/80245534/library/cash-register-2.mp3';
    
    let audioSettings = {
        audioSource: 'remote',
        hasCustomAudio: false
    };

    function playNotificationSound() {
        let audioUrl;
        let logMessage;
        
        if (audioSettings.audioSource === 'custom' && audioSettings.hasCustomAudio) {
            audioUrl = '/api/custom-audio';
            logMessage = '🎵 Custom audio played';
        } else {
            audioUrl = REMOTE_SOUND_URL;
            logMessage = '🎵 Remote sound played';
        }
        
        const audio = new Audio(audioUrl);
        audio.volume = 0.9;
        audio.play()
            .then(() => console.log(logMessage))
            .catch(e => {
                console.error('Error playing audio:', e);
                if (audioSettings.audioSource === 'custom') {
                    console.log('Fallback to remote audio');
                    const fallbackAudio = new Audio(REMOTE_SOUND_URL);
                    fallbackAudio.volume = 0.9;
                    fallbackAudio.play()
                        .then(() => console.log('🎵 Fallback remote sound played'))
                        .catch(fallbackError => console.error('Error playing fallback audio:', fallbackError));
                }
            });
    }

    function formatText(text) {
        if (!text) return '';
        const withoutEmojis = text.replace(/:[a-zA-Z0-9_]+:/g, '');
        return escapeHtml(withoutEmojis).trim();
    }

    function escapeHtml(text) {
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
                updateTTSStatus(msg.data.ttsEnabled);
            }

            if (msg.type === 'ttsLanguageUpdate' && msg.data?.ttsLanguage) {
                ttsLanguage = msg.data.ttsLanguage;
            }
            
            if (msg.type === 'audioSettingsUpdate') {
                audioSettings = { ...audioSettings, ...msg.data };
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
            } else if (msg.type === 'donation') {
                await showDonationNotification({
                    amount: msg.amount,
                    from: msg.from,
                    message: msg.message,
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
            }
        } catch (error) {
            console.error('Error loading initial TTS status:', error);
        }
    }

    loadInitialTTSStatus();

    async function loadInitialAudioSettings() {
        try {
            const response = await fetch('/api/audio-settings');
            if (response.ok) {
                const data = await response.json();
                audioSettings = {
                    audioSource: data.audioSource || 'remote',
                    hasCustomAudio: data.hasCustomAudio || false
                };

            }
        } catch (error) {
            console.error('Error loading initial audio settings:', error);
        }
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

function speakMessage(message) {
    if (!message || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.volume = 0.9;
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

async function showDonationNotification(data) {
    const uniqueId = data.isDirectTip 
        ? `direct-${data.txId}` 
        : `chat-${data.id || (data.from + data.amount + data.message)}`;

    if (shownTips.has(uniqueId)) {
        return;
    }
    shownTips.add(uniqueId);

    playNotificationSound();
    notification.style.display = 'none';
    void notification.offsetWidth;

    await updateExchangeRate();
    
    const formattedMessage = data.message ? formatText(data.message) : '';
    const arAmount = parseFloat(data.amount || data.credits || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2, 
        maximumFractionDigits: 6
    });
    const usdAmount = (parseFloat(data.amount || data.credits || 0) * AR_TO_USD).toLocaleString('en-US', {
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2
    });
    
    const senderInfo = data.from 
        ? `📦 From: ${data.from.slice(0, 8)}...` 
        : `🏷️ From: ${data.channelTitle || 'Anonymous'}`;

    if (ttsEnabled && data.isChatTip && formattedMessage) {
        speakMessage(formattedMessage);
    }

    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                <img src="${data.avatar || '/assets/odysee.png'}" alt="💰" onerror="this.style.display='none'; this.parentNode.innerHTML='💰'">
            </div>
            <div class="notification-text">
                <div class="notification-title">🎉 ${data.credits ? 'Tip Received. Woohoo!' : 'Tip Received. Woohoo!'}</div>
                <div class="amount-container">
                    <span class="ar-amount">${arAmount} AR</span>
                    <span class="usd-value">($${usdAmount} USD)</span>
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

    notification.style.display = 'inline';
    notification.style.opacity = '1';

    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.style.display = 'none', 500);
    }, 15000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
    }

    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);

    function showError(message) {
        notification.innerHTML = `
            <div class="notification-content" style="color: #ff5555;">
                <div class="notification-icon">⚠️</div>
                <div class="notification-text">
                    <div class="notification-title">Error</div>
                    <div class="notification-from">${message}</div>
                </div>
            </div>
        `;
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 3000);
    }

    function showConnectionStatus(connected) {
        let statusElement = document.getElementById('connection-status');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'connection-status';
            document.body.appendChild(statusElement);
        }
        // statusElement.textContent = connected ? '🟢 Connected' : '🔴 Offline';
        statusElement.style.position = 'absolute';
        statusElement.style.bottom = '10px';
        statusElement.style.left = '10px';
        statusElement.style.color = connected ? '#00ff7f' : '#ff5555';
        statusElement.style.fontFamily = "'Inter', sans-serif";
    }
});