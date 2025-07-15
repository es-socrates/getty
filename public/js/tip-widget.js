document.addEventListener('DOMContentLoaded', () => {
    const notification = document.getElementById('notification');
    const ws = new WebSocket(`ws://${window.location.host}`);
    let AR_TO_USD = 0;

    const REMOTE_SOUND_URL = 'https://cdn.streamlabs.com/users/80245534/library/cash-register-2.mp3';

    ws.onopen = () => {
        console.log('✅ Connected to the WebSocket server');
        showConnectionStatus(true);
    };

    ws.onmessage = async (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'tip') {
                await showNotification(msg.data);
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

    async function showNotification(data) {
        playRemoteSound();
        notification.style.display = 'none';
        void notification.offsetWidth;

        await updateExchangeRate();

        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">
                    <img src="https://odysee.com/public/favicon_128.png" alt="💰" style="width: 24px; height: 24px;" onerror="this.style.display='none'; this.parentNode.innerHTML='💰'">
                </div>
                <div class="notification-text">
                    <div class="notification-title">🎉 New Tip Received. Woohoo!</div>
                    <div class="amount-container">
                        <span class="ar-amount">${parseFloat(data.amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 6})} AR</span>
                        <span class="usd-value">≈ $${(parseFloat(data.amount) * AR_TO_USD).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} USD</span>
                    </div>
                    <div class="notification-from" style="margin-top: 8px;">
                        📦 From: ${data.from.slice(0, 8)}... <span style="color: #00ff7f;">🟢 Thank you! 🤞</span>
                    </div>
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