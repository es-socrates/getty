document.addEventListener('DOMContentLoaded', async () => {
    const notification = document.getElementById('notification');
    const ws = new WebSocket(`ws://${window.location.host}`);
    let AR_TO_USD = 0;
    let EMOJI_MAPPING = {};

    const REMOTE_SOUND_URL = 'https://cdn.streamlabs.com/users/80245534/library/cash-register-2.mp3';

    try {
        const response = await fetch(`/emojis.json?nocache=${Date.now()}`);
        EMOJI_MAPPING = await response.json();
    } catch (e) {
        console.error('Error loading emojis:', e);
    }

    function playRemoteSound() {
        const audio = new Audio(REMOTE_SOUND_URL);
        audio.volume = 0.4;
        audio.play()
            .then(() => console.log('🎵 Remote sound played'))
            .catch(e => console.error('Error playing sound:', e));
    }

    function formatText(text) {
        if (!text) return '';
        let formatted = escapeHtml(text);

        formatted = formatted.replace(/<stkr>(.*?)<\/stkr>/g, (match, url) => {
            try {
                const decodedUrl = decodeURIComponent(url);
                if (decodedUrl.match(/^https?:\/\//i)) {
                    return `<img src="${decodedUrl}" alt="Sticker" class="notification-sticker" loading="lazy" />`;
                }
                return match;
            } catch (e) {
                return match;
            }
        });

        if (Object.keys(EMOJI_MAPPING).length > 0) {
            for (const [code, url] of Object.entries(EMOJI_MAPPING)) {
                const isSticker = url.includes('/stickers/');
                const className = isSticker ? 'notification-sticker' : 'notification-emoji';
                const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                formatted = formatted.replace(
                    new RegExp(escapedCode, 'g'),
                    `<img src="${url}" alt="${code}" class="${className}" loading="lazy" />`
                );
            }
        }
        return formatted;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML
            .replace(/&lt;stkr&gt;/g, '<stkr>')
            .replace(/&lt;\/stkr&gt;/g, '</stkr>');
    }

    ws.onopen = () => {
        console.log('✅ Connected to the WebSocket server');
        showConnectionStatus(true);
    };

    ws.onmessage = async (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'tip') {
                await showNotification(msg.data);
            } else if (msg.type === 'chatMessage' && msg.data?.credits > 0) {
                await showDonationNotification(msg.data);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            showError('Error processing notification');
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        showError('Server connection error');
    };

    ws.onclose = () => {
        showConnectionStatus(false);
    };

    function playRemoteSound() {
        const audio = new Audio(REMOTE_SOUND_URL);
        audio.volume = 0.4;
        audio.play()
            .then(() => console.log('🎵 Remote sound played'))
            .catch(e => console.error('Error playing:', e));
    }

    async function updateExchangeRate() {
        try {
            const response = await fetch('/api/ar-price');
            const data = await response.json();
            if (data.arweave?.usd) {
                AR_TO_USD = data.arweave.usd;
            }
        } catch (error) {
            console.error('Error updating exchange rate:', error);
            AR_TO_USD = AR_TO_USD || 5;
        }
    }

async function showDonationNotification(data) {
    playRemoteSound();
    notification.style.display = 'none';
    void notification.offsetWidth;

    await updateExchangeRate();
    
    const formattedMessage = data.message ? formatText(data.message) : '';
    const arAmount = parseFloat(data.amount || data.credits || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 6});
    const usdAmount = (parseFloat(data.amount || data.credits || 0) * AR_TO_USD).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    const senderInfo = data.from 
        ? `📦 From: ${data.from.slice(0, 8)}...` 
        : `🏷️ ${data.channelTitle || 'Anonymous'}`;

    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                <img src="${data.avatar || 'https://odysee.com/public/favicon_128.png'}" alt="💰" onerror="this.style.display='none'; this.parentNode.innerHTML='💰'">
            </div>
            <div class="notification-text">
                <div class="notification-title">🎉 ${data.credits ? 'New tip.' : 'Tip'} Woohoo!!</div>
                <div class="amount-container">
                    ${data.amount ? `<span class="ar-amount">${arAmount} AR</span>` : ''}
                    <span class="ar-amount">${arAmount} AR</span>
                    <span class="usd-value">$${usdAmount} USD</span>
                </div>
                <div class="notification-from">
                ${senderInfo} <span class="thank-you" style="margin: 0 4px;"> 👏</span>
                </div>
                ${data.message ? `
                <div class="notification-message" style="margin-top: 8px; font-weight: 600;">
                    ${formattedMessage.substring(0, 80) + (formattedMessage.length > 90 ? '...' : '')}
                </div>
                ` : ''}
            </div>
        </div>
        <div class="progress-bar"></div>
    `;

    notification.style.display = 'block';
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

    @keyframes progress {
        from { width: 100%; }
        to { width: 0%; }
    }
    
    .progress-bar {
        height: 8px;
        background: #ca004b;
        width: 100%;
        border-radius: 4px;
        animation: progress 15s linear forwards;
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