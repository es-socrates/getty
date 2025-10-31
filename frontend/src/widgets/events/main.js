import './events.css';

if (window.__events_started) {
  // Prevent duplicate bootstrap during HMR refreshes.
} else {
  window.__events_started = true;

  const eventsWidget = document.getElementById('events-widget');
  if (!eventsWidget) {
    console.error('Events widget container not found');
  } else {
    const isDev = import.meta.env.DEV;
    const backendPort = import.meta.env.VITE_BACKEND_PORT || '3000';
    let wsPortOverride = null;
    let attemptedDevFallback = false;

    let ws = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelayBase = 1000;
    let currentEvents = [];
    let settings = {
      eventCount: 6,
      enabledActivities: ['last-tip', 'chat-tip', 'achievement', 'last-achievement'],
      theme: {
        bgColor: '#080c10',
        textColor: '#ffffff'
      },
      animation: 'fadeIn'
    };

    const getWidgetTokenParam = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('token') || urlParams.get('widgetToken') || '';
      } catch {
        return '';
      }
    };

    const tokenParam = getWidgetTokenParam();

    const getActivityIcon = (key) => {
      const icons = {
        'last-tip': 'pi pi-dollar',
        'chat-tip': 'pi pi-comment',
        achievement: 'pi pi-trophy',
        'last-achievement': 'pi pi-trophy'
      };
      return icons[key] || 'pi pi-bell';
    };

    const formatTimestamp = (timestamp) => {
      const ts = typeof timestamp === 'number' ? timestamp : Number(timestamp) || 0;
      if (!ts) return 'now';
      const now = Date.now() / 1000;
      const diff = now - ts;
      if (diff < 60) return 'now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    };

    const getAnimationClass = (animationType) => {
      const classMap = {
        fadeIn: 'ep-event-fadeIn',
        fadeInUp: 'ep-event-fadeInUp',
        slideInLeft: 'ep-event-slideInLeft',
        slideInRight: 'ep-event-slideInRight',
        bounceIn: 'ep-event-bounceIn',
        zoomIn: 'ep-event-zoomIn'
      };
      return classMap[animationType] || 'ep-event-fadeIn';
    };

    const applyTheme = () => {
      eventsWidget.style.setProperty('--bg-main', settings.theme.bgColor || '#080c10');
      eventsWidget.style.setProperty('--text', settings.theme.textColor || '#ffffff');
    };

    const renderEvents = () => {
      const content = eventsWidget.querySelector('.ep-content');
      if (!content) return;

      if (currentEvents.length === 0) {
        content.innerHTML = '<div class="events-empty">Waiting for events...</div>';
        return;
      }

      content.innerHTML = currentEvents
        .map((event, idx) => {
          const animationClass = idx === 0 ? ` ${getAnimationClass(settings.animation)}` : '';
          return `
            <div class="ep-event${animationClass}">
              <div class="ep-icon"><i class="${getActivityIcon(event.type)}"></i></div>
              <div class="ep-text">${event.text}</div>
              <div class="ep-time">${formatTimestamp(event.timestamp)}</div>
            </div>
          `;
        })
        .join('');
    };

    const addEvent = (type, rawData) => {
      const data = rawData || {};
      let text = '';
      let timestamp = Date.now() / 1000;

      switch (type) {
        case 'last-tip': {
          const amount = parseFloat(data.amount);
          const safeAmount = Number.isFinite(amount) ? amount : 0;
          const amountLabel = safeAmount.toFixed(4);
          const from = typeof data.from === 'string' && data.from.length ? data.from.slice(0, 15) : 'Anonymous';
          text = `Tip: ${amountLabel} AR from ${from}`;
          if (data.timestamp) {
            const numericTs = typeof data.timestamp === 'string'
              ? new Date(data.timestamp).getTime() / 1000
              : Number(data.timestamp);
            if (Number.isFinite(numericTs)) timestamp = numericTs;
          }
          break;
        }
        case 'chat-tip': {
          const amount = parseFloat(data.amount);
          const safeAmount = Number.isFinite(amount) ? amount : 0;
          text = `Chat tip: ${safeAmount.toFixed(4)} AR`;
          if (data.timestamp) {
            const numericTs = new Date(data.timestamp).getTime() / 1000;
            if (Number.isFinite(numericTs)) timestamp = numericTs;
          }
          break;
        }
        case 'achievement': {
          text = `Achievement: ${data.title || 'Unlocked!'}`;
          if (data.ts) {
            const numericTs = Number(data.ts) / 1000;
            if (Number.isFinite(numericTs)) timestamp = numericTs;
          }
          break;
        }
        case 'last-achievement': {
          text = `Achievement: ${data.title || 'Recent Achievement'}`;
          if (data.ts) {
            const numericTs = Number(data.ts) / 1000;
            if (Number.isFinite(numericTs)) timestamp = numericTs;
          }
          break;
        }
        default: {
          text = `Event: ${type}`;
          break;
        }
      }

      currentEvents.unshift({
        type,
        text,
        timestamp,
        id: `${Date.now()}-${Math.random()}`
      });

      currentEvents = currentEvents.slice(0, settings.eventCount);
      renderEvents();
    };

    const loadSettings = async () => {
      try {
        const base = '/api/events-settings';
        const url = tokenParam ? `${base}?token=${encodeURIComponent(tokenParam)}` : base;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!data) return;
        settings = {
          eventCount: data.eventCount || settings.eventCount,
          enabledActivities: Array.isArray(data.enabledActivities) && data.enabledActivities.length
            ? data.enabledActivities
            : settings.enabledActivities,
          theme: data.theme || settings.theme,
          animation: data.animation || settings.animation
        };
        applyTheme();
        renderEvents();
      } catch (error) {
        console.error('Error loading events settings:', error);
      }
    };

    const resolveSocketHost = () => {
      if (wsPortOverride) {
        return `${window.location.hostname}:${wsPortOverride}`;
      }
      return window.location.host;
    };

    const buildWsUrl = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
      const host = resolveSocketHost();
      const query = tokenParam ? `?token=${encodeURIComponent(tokenParam)}` : '';
      return `${protocol}${host}${query}`;
    };

    const scheduleReconnect = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        return;
      }
      reconnectAttempts += 1;
      const delay = reconnectDelayBase * Math.pow(2, reconnectAttempts - 1);
      setTimeout(connectWebSocket, delay);
    };

    const connectWebSocket = () => {
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const wsUrl = buildWsUrl();
      try {
        ws = new WebSocket(wsUrl);
      } catch (err) {
        console.error('Events widget WebSocket init error:', err);
        scheduleReconnect();
        return;
      }

      ws.onopen = async () => {
        reconnectAttempts = 0;
        await loadSettings();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (!msg || !msg.type) return;

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
        scheduleReconnect();
      };
    };

    loadSettings().finally(renderEvents);
    connectWebSocket();

    window.addEventListener('beforeunload', () => {
      try {
        if (ws) ws.close();
      } catch {}
    });
  }
}
