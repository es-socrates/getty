(function(){
    if (window.__events_started) return;
    const start = () => {
        if (window.__events_started) return;
        window.__events_started = true;

    const eventsWidget = document.getElementById('events-widget');
    if (!eventsWidget) {
        console.error('Events widget container not found');
        return;
    }

    let ws;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelayBase = 1000;
    let currentEvents = [];
    let settings = {
        eventCount: 6,
        enabledActivities: ['last-tip', 'chat-tip', 'achievement', 'last-achievement'],
        theme: {
            bgColor: '#080c10',
            textColor: '#ffffff',
        },
        animation: 'fadeIn',
    };

    const isOBSWidget = window.location.pathname.includes('/widgets/');

    function getWidgetTokenParam() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('token') || urlParams.get('widgetToken') || '';
        } catch { return ''; }
    }

    function getActivityIcon(key) {
        const icons = {
            'last-tip': 'pi pi-dollar',
            'chat-tip': 'pi pi-comment',
            'achievement': 'pi pi-trophy',
            'last-achievement': 'pi pi-trophy',
        };
        return icons[key] || 'pi pi-bell';
    }

    function formatTimestamp(timestamp) {
        if (!timestamp) return 'now';
        const now = Date.now() / 1000;
        const diff = now - timestamp;
        if (diff < 60) return 'now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    function getAnimationClass(animationType) {
        const classMap = {
            'fadeIn': 'ep-event-fadeIn',
            'fadeInUp': 'ep-event-fadeInUp',
            'slideInLeft': 'ep-event-slideInLeft',
            'slideInRight': 'ep-event-slideInRight',
            'bounceIn': 'ep-event-bounceIn',
            'zoomIn': 'ep-event-zoomIn',
        };
        return classMap[animationType] || 'ep-event-fadeIn';
    }

    function applyTheme() {
        const eventsWidget = document.getElementById('events-widget');
        if (!eventsWidget) return;

        eventsWidget.style.setProperty('--bg-main', settings.theme.bgColor);
        eventsWidget.style.setProperty('--text', settings.theme.textColor);
    }

    function renderEvents() {
        const content = eventsWidget.querySelector('.ep-content');
        if (!content) return;

        if (currentEvents.length === 0) {
            content.innerHTML = '<div class="events-empty">Waiting for events...</div>';
            return;
        }

        content.innerHTML = currentEvents.map((event, idx) => `
            <div class="ep-event${idx === 0 ? ' ' + getAnimationClass(settings.animation) : ''}">
                <div class="ep-icon"><i class="${getActivityIcon(event.type)}"></i></div>
                <div class="ep-text">${event.text}</div>
                <div class="ep-time">${formatTimestamp(event.timestamp)}</div>
            </div>
        `).join('');
    }

    function addEvent(type, data) {
        let text = '';
        let timestamp = Date.now() / 1000;

        switch (type) {
            case 'last-tip':
                const tipAmount = parseFloat(data.amount).toFixed(4);
                text = `Tip: ${tipAmount} AR from ${data.from?.slice(0, 15) || 'Anonymous'}`;
                if (data.timestamp && !isNaN(data.timestamp)) {
                    timestamp = typeof data.timestamp === 'string' ? new Date(data.timestamp).getTime() / 1000 : data.timestamp;
                }
                break;
            case 'chat-tip':
                const amount = parseFloat(data.amount).toFixed(4);
                text = `Chat tip: ${amount} AR`;
                if (data.timestamp) timestamp = new Date(data.timestamp).getTime() / 1000;
                break;
            case 'achievement':
                text = `Achievement: ${data.title || 'Unlocked!'}`;
                if (data.ts) timestamp = data.ts / 1000;
                break;
            case 'last-achievement':
                text = `Achievement: ${data.title || 'Recent Achievement'}`;
                if (data.ts) timestamp = data.ts / 1000;
                break;
            default:
                text = `Event: ${type}`;
        }

        currentEvents.unshift({
            type,
            text,
            timestamp,
            id: Date.now() + Math.random(),
        });

        currentEvents = currentEvents.slice(0, settings.eventCount);

        renderEvents();
    }

    async function loadSettings() {
        try {
            const token = getWidgetTokenParam();
            const url = token ? `/api/events-settings?token=${encodeURIComponent(token)}` : '/api/events-settings';
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (data) {
                    settings = {
                        eventCount: data.eventCount || 6,
                        enabledActivities: data.enabledActivities || ['last-tip', 'chat-tip', 'achievement', 'last-achievement'],
                        theme: data.theme || settings.theme,
                        animation: data.animation || 'fadeIn',
                    };
                    applyTheme();
                }
            }
        } catch (error) {
            console.error('Error loading events settings:', error);
        }
    }

    function connectWebSocket() {
        if (ws && ws.readyState === WebSocket.OPEN) return;

        const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const token = getWidgetTokenParam();
        const wsUrl = token
            ? `${wsProto}://${window.location.host}?token=${encodeURIComponent(token)}`
            : `${wsProto}://${window.location.host}`;

        ws = new WebSocket(wsUrl);

        ws.onopen = async () => {
            console.log('Events widget WebSocket connected');
            reconnectAttempts = 0;
            await loadSettings();
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);

                if ((msg.type === 'tip' || msg.type === 'lastTip') && settings.enabledActivities.includes('last-tip')) {
                    addEvent('last-tip', msg.data);
                }

                if (msg.type === 'chat-tip' && settings.enabledActivities.includes('chat-tip')) {
                    addEvent('chat-tip', msg.data);
                }

                if (msg.type === 'achievement' && settings.enabledActivities.includes('achievement')) {
                    addEvent('achievement', msg.data);
                }

                if (msg.type === 'last-achievement' && settings.enabledActivities.includes('last-achievement')) {
                    addEvent('last-achievement', msg.data);
                }

            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('Events widget WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('Events widget WebSocket closed');
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                const delay = reconnectDelayBase * Math.pow(2, reconnectAttempts - 1);
                setTimeout(connectWebSocket, delay);
            }
        };
    }

    connectWebSocket();

    window.addEventListener('beforeunload', () => {
        if (ws) {
            ws.close();
        }
    });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();