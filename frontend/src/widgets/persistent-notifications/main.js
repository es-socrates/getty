import './persistent-notifications.css';

if (!window.__persistent_notifications_started) {
  window.__persistent_notifications_started = true;

  const start = () => {
    const container = document.getElementById('persistent-notifications-container');
    const listElement = document.getElementById('notifications-list');

    if (!container || !listElement) {
      console.error('Persistent notifications widget container not found');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('edit') === 'true') {
      container.classList.add('pn-edit');
    }

    const isDev = import.meta.env.DEV;
    const backendPort = import.meta.env.VITE_BACKEND_PORT || '3000';
    let wsPortOverride = null;
    let attemptedDevFallback = false;

    const tokenParam = (() => {
      try {
        return params.get('token') || params.get('widgetToken') || '';
      } catch {
        return '';
      }
    })();

    const withWidgetToken = (url) => {
      if (!tokenParam) return url;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
          const parsed = new URL(url);
          if (!parsed.searchParams.has('widgetToken')) {
            parsed.searchParams.set('widgetToken', tokenParam);
          }
          return parsed.toString();
        } catch {
          return url;
        }
      }
      if (url.includes('widgetToken=')) return url;
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}widgetToken=${encodeURIComponent(tokenParam)}`;
    };

    const safeFetchJson = async (url, options = {}) => {
      try {
        const response = await fetch(withWidgetToken(url), { cache: 'no-store', ...options });
        if (!response.ok) return null;
        return await response.json();
      } catch {
        return null;
      }
    };

    let currentTips = [];
    let ws = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 8;
    const reconnectDelayBase = 1000;

    const parseTimestamp = (input) => {
      if (!input) return null;
      if (typeof input === 'number') {
        const ms = input > 1e12 ? input : input * 1000;
        return new Date(ms);
      }
      try {
        const date = new Date(input);
        return Number.isNaN(date.getTime()) ? null : date;
      } catch {
        return null;
      }
    };

    const formatTime = (input) => {
      const ts = parseTimestamp(input);
      if (!ts) return 'Just now';
      try {
        return ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch {
        return ts.toLocaleTimeString();
      }
    };

    const formatArAmount = (value) => {
      const amount = Number.parseFloat(value);
      if (!Number.isFinite(amount)) return '0.00';
      return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    };

    const formatUsdAmount = (value) => {
      const amount = Number.parseFloat(value);
      if (!Number.isFinite(amount)) return '';
      return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const clearList = () => {
      while (listElement.firstChild) {
        listElement.removeChild(listElement.firstChild);
      }
    };

    const renderEmptyState = () => {
      clearList();
      const empty = document.createElement('div');
      empty.className = 'empty-message';
      empty.textContent = 'No tips received yet';
      listElement.appendChild(empty);
    };

    const renderTips = () => {
      if (!Array.isArray(currentTips) || currentTips.length === 0) {
        renderEmptyState();
        return;
      }

      clearList();
      const fragment = document.createDocumentFragment();

      currentTips.forEach((tip) => {
        const item = document.createElement('div');
        item.className = 'notification-item';

        const amountEl = document.createElement('div');
        amountEl.className = 'amount';
        const arLabel = formatArAmount(tip.amount);
        const usdLabel = formatUsdAmount(tip.usd);
        amountEl.textContent = usdLabel ? `${arLabel} AR (${usdLabel})` : `${arLabel} AR`;
        item.appendChild(amountEl);

        const fromEl = document.createElement('div');
        fromEl.className = 'from';
        const fromName = typeof tip.from === 'string' && tip.from.trim() ? tip.from.trim() : 'Anonymous';
        fromEl.textContent = `From: ${fromName}`;
        item.appendChild(fromEl);

        if (tip.message) {
          const messageEl = document.createElement('div');
          messageEl.className = 'message';
          messageEl.textContent = `"${tip.message}"`;
          item.appendChild(messageEl);
        }

        const timeEl = document.createElement('div');
        timeEl.className = 'time';
        timeEl.textContent = formatTime(tip.timestamp);
        item.appendChild(timeEl);

        fragment.appendChild(item);
      });

      listElement.appendChild(fragment);
    };

    const setTips = (tips) => {
      if (Array.isArray(tips)) {
        currentTips = tips.slice(0, 10);
      } else {
        currentTips = [];
      }
      renderTips();
    };

    const fetchInitialTips = async () => {
      const data = await safeFetchJson('/api/external-notifications');
      if (data && Array.isArray(data.lastTips)) {
        setTips(data.lastTips);
      } else if (!currentTips.length) {
        renderEmptyState();
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
      const query = new URLSearchParams();
      if (tokenParam) {
        query.set('token', tokenParam);
        query.set('widgetToken', tokenParam);
      }
      const qs = query.toString();
      return qs ? `${protocol}${host}?${qs}` : `${protocol}${host}`;
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
      } catch (error) {
        console.error('Persistent notifications WebSocket init failed:', error);
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        reconnectAttempts = 0;
        fetchInitialTips();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (!message) return;

          if (message.type === 'init' && message.data && Array.isArray(message.data.persistentTips)) {
            setTips(message.data.persistentTips);
            return;
          }

          if (message.type === 'persistentTipsUpdate' && Array.isArray(message.data)) {
            setTips(message.data);
            return;
          }
        } catch (error) {
          console.error('Error processing persistent notification message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('Persistent notifications WebSocket error:', error);
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

    window.addEventListener('beforeunload', () => {
      try {
        if (ws) ws.close();
      } catch {}
    });

    fetchInitialTips();
    connectWebSocket();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
