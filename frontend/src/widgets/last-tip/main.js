import './last-tip.css';

if (!window.__last_tip_started) {
  window.__last_tip_started = true;

  const init = () => {
    const lastDonationElement = document.getElementById('last-donation');
    if (!lastDonationElement) {
      console.error('Last tip widget container not found');
      return;
    }

    const titleElement = lastDonationElement.querySelector('.notification-title');
    const amountElement = lastDonationElement.querySelector('.ar-amount');
    const symbolElement = lastDonationElement.querySelector('.ar-symbol');
    const usdValueElement = lastDonationElement.querySelector('.usd-value');
    const fromElement = lastDonationElement.querySelector('.notification-from-lasttip');

    if (!titleElement || !amountElement || !symbolElement || !usdValueElement || !fromElement) {
      console.error('Last tip widget missing required DOM nodes');
      return;
    }

    const isDev = import.meta.env.DEV;
    const backendPort = import.meta.env.VITE_BACKEND_PORT || '3000';
    let wsPortOverride = null;
    let attemptedDevFallback = false;

    const isObsWidget = window.location.pathname.includes('/widgets/');
    const tokenParam = (() => {
      try {
        const params = new URLSearchParams(window.location.search);
        return params.get('token') || params.get('widgetToken') || '';
      } catch {
        return '';
      }
    })();

    const withWidgetToken = (url) => {
      if (!tokenParam) return url;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
          const u = new URL(url);
          if (!u.searchParams.has('widgetToken')) {
            u.searchParams.set('widgetToken', tokenParam);
          }
          return u.toString();
        } catch {
          return url;
        }
      }
      if (url.includes('widgetToken=')) return url;
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}widgetToken=${encodeURIComponent(tokenParam)}`;
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

    let arToUsd = 0;
    let ws = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 8;
    const reconnectDelayBase = 1000;

    let colorsLoaded = false;
    let lastTipColors = {};
    let customTitle = '';
    let hasRenderedOnce = false;

    const getNonce = () => {
      try {
        const meta = document.querySelector('meta[property="csp-nonce"]');
        if (meta && (meta.nonce || meta.getAttribute('nonce'))) {
          return meta.nonce || meta.getAttribute('nonce');
        }
        if (document.head && document.head.dataset && document.head.dataset.cspNonce) {
          return document.head.dataset.cspNonce;
        }
      } catch {}
      return '';
    };

    const ensureStyleTag = (id) => {
      let tag = document.getElementById(id);
      if (!tag) {
        tag = document.createElement('style');
        tag.id = id;
        const nonce = getNonce();
        if (nonce) tag.setAttribute('nonce', nonce);
        document.head.appendChild(tag);
      } else {
        try {
          const nonce = getNonce();
          if (nonce && !tag.getAttribute('nonce')) {
            tag.setAttribute('nonce', nonce);
          }
        } catch {}
      }
      return tag;
    };

    const setLastTipVars = (colors) => {
      try {
        const tag = ensureStyleTag('last-tip-inline-vars');
        const c = colors || {};
        const declarations = [
          c.bgColor ? `--lt-bg:${c.bgColor};` : '',
          c.borderColor ? `--lt-border:${c.borderColor};` : '',
          c.fontColor ? `--lt-text:${c.fontColor};` : '',
          c.amountColor ? `--lt-amount:${c.amountColor};` : '',
          c.iconBgColor ? `--lt-icon-bg:${c.iconBgColor};` : '',
          c.fromColor ? `--lt-from:${c.fromColor};` : ''
        ]
          .filter(Boolean)
          .join('');
        tag.textContent = declarations ? `#last-donation{${declarations}}` : '';
      } catch {}
    };

    const applyCustomColors = (extra = {}) => {
      if (!isObsWidget) return;
      const merged = { ...lastTipColors };
      if (extra && typeof extra === 'object') {
        const keys = ['bgColor', 'fontColor', 'borderColor', 'amountColor', 'iconBgColor', 'fromColor'];
        for (const key of keys) {
          if (typeof extra[key] === 'string' && extra[key]) {
            merged[key] = extra[key];
          }
        }
      }
      setLastTipVars(merged);
    };

    const updateColorsFromConfig = (config = {}) => {
      if (!config || typeof config !== 'object') return;
      const next = { ...lastTipColors };
      let changed = false;
      const keys = ['bgColor', 'fontColor', 'borderColor', 'amountColor', 'iconBgColor', 'fromColor'];
      for (const key of keys) {
        if (typeof config[key] === 'string' && config[key]) {
          next[key] = config[key];
          changed = true;
        }
      }
      if (changed) {
        lastTipColors = next;
        colorsLoaded = true;
        applyCustomColors();
      }
      if (typeof config.title === 'string' && config.title.trim()) {
        customTitle = config.title.trim();
      }
    };

    const loadModules = async () => {
      if (!isObsWidget) return null;
      const data = await safeFetchJson('/api/modules');
      if (data && data.lastTip) {
        updateColorsFromConfig(data.lastTip);
      }
      return data;
    };

    const ensureColorsLoaded = async () => {
      if (!isObsWidget) return;
      if (!colorsLoaded) {
        await loadModules();
      } else {
        applyCustomColors();
      }
    };

    const formatArAmount = (amount) => {
      const value = Number.parseFloat(amount);
      if (!Number.isFinite(value)) return '0.00';
      return value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
      });
    };

    const calculateUsdValue = (amount) => {
      const value = Number.parseFloat(amount);
      if (!Number.isFinite(value) || !Number.isFinite(arToUsd) || arToUsd <= 0) return '';
      const usd = value * arToUsd;
      return `≈ $${usd.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} USD`;
    };

    const updateExchangeRate = async () => {
      try {
        const response = await fetch(withWidgetToken('/api/ar-price'), { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (data?.arweave?.usd) {
            const parsed = Number(data.arweave.usd);
            if (Number.isFinite(parsed) && parsed > 0) {
              arToUsd = parsed;
              return;
            }
          }
        }
      } catch {}

      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd');
        if (response.ok) {
          const data = await response.json();
          if (data?.arweave?.usd) {
            const parsed = Number(data.arweave.usd);
            if (Number.isFinite(parsed) && parsed > 0) {
              arToUsd = parsed;
              return;
            }
          }
        }
      } catch (error) {
        console.error('Error updating AR/USD rate:', error);
      }

      if (!Number.isFinite(arToUsd) || arToUsd <= 0) {
        arToUsd = 5;
      }
    };

    const ensureExchangeRate = async () => {
      if (!Number.isFinite(arToUsd) || arToUsd <= 0) {
        await updateExchangeRate();
      }
    };

    const updateUI = async (data) => {
      await ensureColorsLoaded();

      if (!data) {
        titleElement.textContent = customTitle || 'Configure last tip 💸';
        amountElement.textContent = '0';
        symbolElement.textContent = 'AR';
        usdValueElement.textContent = '';
        fromElement.textContent = 'The wallet is not configured';
        applyCustomColors();
        return;
      }

      hasRenderedOnce = true;

      await ensureExchangeRate();

      const formattedAmount = formatArAmount(data.amount);
      const usdValue = calculateUsdValue(data.amount);

      titleElement.textContent = customTitle || 'Last tip received 👏';
      amountElement.textContent = formattedAmount;
      symbolElement.textContent = 'AR';
      usdValueElement.textContent = usdValue;

      const fromName = typeof data.from === 'string' && data.from.length ? data.from.slice(0, 22) : 'Anonymous';
      fromElement.textContent = `From: ${fromName}... 📑`;

      lastDonationElement.classList.remove('update-animation');
      void lastDonationElement.offsetWidth;
      lastDonationElement.classList.add('update-animation');

      applyCustomColors(data);
    };

    const safeUpdate = (payload) => {
      Promise.resolve(updateUI(payload)).catch((error) => {
        console.error('Failed to update last tip widget:', error);
      });
    };

    const loadInitialData = async () => {
      const modulesData = await loadModules();
      const payload = modulesData?.lastTip?.lastDonation || null;
      safeUpdate(payload);
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
      const params = new URLSearchParams();
      if (tokenParam) {
        params.set('token', tokenParam);
        params.set('widgetToken', tokenParam);
      }
      const query = params.toString();
      return query ? `${protocol}${host}?${query}` : `${protocol}${host}`;
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
        console.error('Last tip WebSocket init failed:', error);
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        reconnectAttempts = 0;
        loadInitialData();
        ensureExchangeRate();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (!message || typeof message !== 'object') return;

          if (message.type === 'init' && message.data) {
            if (message.data.lastTip) {
              updateColorsFromConfig(message.data.lastTip);
              const payload = message.data.lastTip.lastDonation || message.data.lastTip;
              safeUpdate(payload);
            }
            return;
          }

          if (message.type === 'lastTipConfig' && message.data) {
            updateColorsFromConfig(message.data);
            applyCustomColors();
            return;
          }

          if ((message.type === 'tip' || message.type === 'lastTip') && message.data) {
            safeUpdate({ ...message.data });
          }
        } catch (error) {
          console.error('Error processing last tip message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('Last tip WebSocket error:', error);
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

    loadInitialData();
    connectWebSocket();

    if (window.__last_tip_interval) {
      clearInterval(window.__last_tip_interval);
    }
    window.__last_tip_interval = setInterval(() => {
      lastDonationElement.classList.remove('update-animation');
      void lastDonationElement.offsetWidth;
      lastDonationElement.classList.add('update-animation');
    }, 10000);

    window.addEventListener('beforeunload', () => {
      try {
        if (ws) ws.close();
      } catch {}
    });
  };

  init();
}
