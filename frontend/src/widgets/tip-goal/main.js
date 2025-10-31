import './tip-goal.css';

if (!window.__tip_goal_widget_started) {
  window.__tip_goal_widget_started = true;

  const goalWidget = document.getElementById('goal-widget');
  if (!goalWidget) {
    console.error('Tip goal widget container not found');
  } else {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = (() => {
      try {
        return params.get('token') || params.get('widgetToken') || '';
      } catch {
        return '';
      }
    })();

    const isObsWidget = window.location.pathname.includes('/widgets/');
    const isDev = import.meta.env.DEV;
    const backendPort = import.meta.env.VITE_BACKEND_PORT || '3000';
    let wsPortOverride = null;
    let attemptedDevFallback = false;

    goalWidget.classList.add('goal-widget');
    if (isObsWidget) {
      goalWidget.classList.add('tip-goal-widget');
    }

    const REMOTE_SOUND_URL =
      'https://52agquhrbhkx3u72ikhun7oxngtan55uvxqbp4pzmhslirqys6wq.arweave.net/7oBoUPEJ1X3T-kKPRv3XaaYG97St4Bfx-WHktEYYl60';

    const storage = (() => {
      try {
        return window.localStorage;
      } catch {
        return null;
      }
    })();

    const clearCelebrationState = () => {
      try {
        if (storage) storage.removeItem('tipGoalCelebration');
      } catch {}
      hasPlayedGoalSound = false;
    };

    const withWidgetToken = (url) => {
      if (!tokenParam) return url;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
          const parsed = new URL(url);
          if (!parsed.searchParams.has('widgetToken')) {
            parsed.searchParams.set('widgetToken', tokenParam);
          }
          if (!parsed.searchParams.has('token')) {
            parsed.searchParams.set('token', tokenParam);
          }
          return parsed.toString();
        } catch {
          return url;
        }
      }
      if (url.includes('widgetToken=')) return url;
      const separator = url.includes('?') ? '&' : '?';
      const parts = [`widgetToken=${encodeURIComponent(tokenParam)}`];
      if (!url.includes('token=')) {
        parts.push(`token=${encodeURIComponent(tokenParam)}`);
      }
      return `${url}${separator}${parts.join('&')}`;
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

    const setTipGoalVars = ({ modern, base }) => {
      try {
        const tag = ensureStyleTag('tip-goal-inline-vars');
        const parts = [];
        if (modern && Object.keys(modern).length) {
          const decl = [
            modern.bg ? `--modern-bg:${modern.bg};` : '',
            modern.text ? `--modern-text:${modern.text};` : '',
            modern.accent ? `--modern-accent:${modern.accent};` : '',
            modern.progressBg ? `--modern-progress-bg:${modern.progressBg};` : ''
          ]
            .filter(Boolean)
            .join('');
          if (decl) parts.push(`#goal-widget.modern-theme .modern-card{${decl}}`);
        }
        if (base && Object.keys(base).length) {
          const decl = [
            base.bg ? `--tg-bg:${base.bg};` : '',
            base.border ? `--tg-border:${base.border};` : '',
            base.text ? `--tg-text:${base.text};` : '',
            base.progress ? `--tg-progress:${base.progress};` : ''
          ]
            .filter(Boolean)
            .join('');
          if (decl) parts.push(`#goal-widget:not(.modern-theme).tip-goal-widget{${decl}}`);
        }
        tag.textContent = parts.join('');
      } catch {}
    };

    const getI18nText = (key, fallback) => {
      const defaultText = typeof fallback === 'string' && fallback.trim() ? fallback : key;
      try {
        if (window.languageManager && typeof window.languageManager.getText === 'function') {
          const value = window.languageManager.getText(key);
          if (typeof value === 'string' && value.trim()) {
            return value.trim();
          }
        }
      } catch {}
      return defaultText;
    };

    const escapeHtml = (value) => {
      if (typeof value !== 'string') return '';
      return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

    let ws = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const reconnectDelayBase = 1000;

    let currentData = null;
    let hasReachedGoal = false;
    let hasPlayedGoalSound = false;
    let initialDataLoadedAt = 0;
    let pendingUpdate = null;
    let updateTimer = null;

    let tipGoalColors = {};
    let audioSettings = {
      audioSource: 'remote',
      hasCustomAudio: false
    };

    const mergeStoredColors = (source) => {
      if (!source || typeof source !== 'object') return;
      const keys = ['bgColor', 'fontColor', 'borderColor', 'progressColor'];
      let changed = false;
      const next = { ...tipGoalColors };
      keys.forEach((key) => {
        if (typeof source[key] === 'string' && source[key]) {
          if (next[key] !== source[key]) {
            next[key] = source[key];
            changed = true;
          }
        }
      });
      if (changed) {
        tipGoalColors = next;
      }
    };

    const applyObsColors = (data = {}) => {
      if (!isObsWidget) return;
      const base = {};
      const modern = {};
      if (typeof data.bgColor === 'string' && data.bgColor) {
        base.bg = data.bgColor;
        modern.bg = data.bgColor;
      }
      if (typeof data.fontColor === 'string' && data.fontColor) {
        base.text = data.fontColor;
        modern.text = data.fontColor;
      }
      if (typeof data.borderColor === 'string' && data.borderColor) {
        base.border = data.borderColor;
      }
      if (typeof data.progressColor === 'string' && data.progressColor) {
        base.progress = data.progressColor;
        modern.accent = data.progressColor;
      }
      if (Object.keys(base).length || Object.keys(modern).length) {
        setTipGoalVars({ base, modern });
      }
    };

    const loadAudioSettings = async () => {
      const response = await safeFetchJson('/api/goal-audio-settings');
      if (response && typeof response === 'object') {
        if (typeof response.audioSource === 'string') {
          audioSettings.audioSource = response.audioSource;
        }
        if (typeof response.hasCustomAudio === 'boolean') {
          audioSettings.hasCustomAudio = response.hasCustomAudio;
        }
      }
    };

    const fetchCustomAudioUrl = async () => {
      try {
        const url = withWidgetToken('/api/goal-audio');
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
          const payload = await response.json();
          if (payload && typeof payload.url === 'string' && payload.url) {
            return payload.url;
          }
        }
      } catch (error) {
        console.error('Error fetching custom goal audio URL:', error);
      }
      return REMOTE_SOUND_URL;
    };

    const playGoalSound = async () => {
      let audioUrl = REMOTE_SOUND_URL;
      if (audioSettings.audioSource === 'custom' && audioSettings.hasCustomAudio) {
        if (currentData && typeof currentData.customAudioUrl === 'string' && currentData.customAudioUrl) {
          audioUrl = currentData.customAudioUrl;
        } else {
          audioUrl = await fetchCustomAudioUrl();
        }
      }
      try {
        const audio = new Audio(audioUrl);
        audio.volume = 0.9;
        await audio.play();
  console.warn('Tip goal celebration sound played');
      } catch (error) {
        console.error('Error playing goal audio, falling back to remote sound:', error);
        if (audioUrl !== REMOTE_SOUND_URL) {
          try {
            const fallback = new Audio(REMOTE_SOUND_URL);
            fallback.volume = 0.9;
            await fallback.play();
            console.warn('Tip goal fallback sound played');
          } catch (fallbackError) {
            console.error('Error playing fallback goal audio:', fallbackError);
          }
        }
      }
    };

    const createConfetti = (target, count = 50) => {
      const host = isObsWidget ? target : document.body;
      for (let i = 0; i < count; i += 1) {
        const el = document.createElement('div');
        el.className = 'confetti';
        const pos = Math.floor(Math.random() * 20);
        const size = Math.floor(Math.random() * 5);
        const color = Math.floor(Math.random() * 6);
        const dur = Math.floor(Math.random() * 7);
        const delay = Math.floor(Math.random() * 11);
        if (Math.random() > 0.5) el.classList.add('round');
        el.classList.add(`pos-${pos}`, `size-${size}`, `color-${color}`, `dur-${dur}`, `delay-${delay}`);
        host.appendChild(el);
        const ttl = (dur + delay + 2) * 1000;
        setTimeout(() => {
          if (el && el.parentNode) el.parentNode.removeChild(el);
        }, ttl);
      }
    };

    const createParticles = (target, count = 20) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'particles';
      for (let i = 0; i < count; i += 1) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const pos = Math.floor(Math.random() * 20);
        const duration = Math.floor(Math.random() * 3) + 1;
        const delay = Math.floor(Math.random() * 3);
        particle.classList.add(`pos-${pos}`, `p-dur-${duration}`, `p-delay-${delay}`);
        wrapper.appendChild(particle);
      }
      target.appendChild(wrapper);
      setTimeout(() => {
        wrapper.remove();
      }, 5000);
    };

    const toNumber = (value, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const processTipData = (data) => {
      if (!data || typeof data !== 'object') return null;
      const current = toNumber(data.currentAmount ?? data.currentTips ?? data.current ?? data.currentAR, 0);
      const goal = Math.max(toNumber(data.monthlyGoal ?? data.goal ?? 0, 0), 0.0001);
      const rate = Math.max(toNumber(data.exchangeRate ?? data.rate ?? data.AR_TO_USD, 0), 0);
      const progress = Math.min(goal > 0 ? (current / goal) * 100 : 0, 100);
      const usdValue = rate > 0 ? current * rate : 0;
      const goalUsd = rate > 0 ? goal * rate : 0;
      let theme = typeof data.theme === 'string' ? data.theme.trim() : 'classic';
      if (theme === 'koku-list') theme = 'modern-list';
      const title = typeof data.title === 'string' ? data.title : '';
      const lastDonation = data.lastDonationTimestamp ?? data.lastDonation ?? null;
      const customAudioUrl = typeof data.customAudioUrl === 'string' ? data.customAudioUrl : '';
      const merged = {
        current,
        goal,
        progress,
        rate,
        usdValue,
        goalUsd,
        title,
        theme,
        lastDonation,
        customAudioUrl,
        bgColor: data.bgColor,
        fontColor: data.fontColor,
        borderColor: data.borderColor,
        progressColor: data.progressColor
      };
      return merged;
    };

    const setWidthClass = (element, pct) => {
      if (!element) return;
      const targetPct = Math.max(0, Math.min(100, Math.round(pct || 0)));
      element.classList.forEach((className) => {
        if (className.startsWith('w-pct-')) {
          element.classList.remove(className);
        }
      });
      element.classList.add(`w-pct-${targetPct}`);
    };

    const formatArAmount = (value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return '0.00';
      return numeric.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
      });
    };

    const formatUsdAmount = (value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return '0.00';
      return numeric.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };

    const renderModernListTheme = (data, reason) => {
      goalWidget.classList.add('modern-theme');
      const prefersDark = (() => {
        try {
          return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        } catch {
          return false;
        }
      })();
      const themeClass = prefersDark ? 'theme-dark' : 'theme-light';
      const card = goalWidget.querySelector('.modern-card');
      const title = data.title && data.title.trim() ? data.title.trim() : getI18nText('tipGoalDefaultTitle', 'Monthly tip goal 🎖️');
      const statusCompleted = (data.progress || 0) >= 100;
      const statusLabel = statusCompleted
        ? getI18nText('tipGoalCardStatusCompleted', 'Goal completed')
        : getI18nText('tipGoalCardStatusInProgress', 'In progress');
      const progressValue = `${Math.round(data.progress || 0)}%`;
      const targetUsd = `$${formatUsdAmount(data.goalUsd)}`;
      const currentUsd = `$${formatUsdAmount(data.usdValue)}`;
      const modernVars = {
        bg: data.bgColor || (prefersDark ? '#0f0f12' : '#ffffff'),
        text: data.fontColor || (prefersDark ? '#ffffff' : '#0a0a0a'),
        accent: data.progressColor || (prefersDark ? '#00ff7f' : '#111827'),
        progressBg: prefersDark ? 'rgba(35,38,47,0.31)' : '#e5e7eb'
      };
      applyObsColors(data);

      if (!card) {
        goalWidget.innerHTML = `
          <div class="modern-card ${themeClass}">
            <div class="modern-top">
              <div class="modern-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/><path d="M12 3v4M21 12h-4M12 21v-4M3 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </div>
              <span class="modern-pill">${escapeHtml(statusLabel)}</span>
            </div>
            <div class="modern-header">
              <h3 class="modern-title">${escapeHtml(title)}</h3>
            </div>
            <div class="modern-row modern-row-progress">
              <span class="modern-label">${escapeHtml(getI18nText('tipGoalCardProgress', 'Progress'))}</span>
              <span class="modern-value">${escapeHtml(progressValue)}</span>
            </div>
            <div class="modern-progress"><div class="modern-bar w-pct-${Math.max(0, Math.min(100, Math.round(data.progress || 0)))}"></div></div>
            <div class="modern-row">
              <span class="modern-amount">${escapeHtml(targetUsd)}</span>
              <span class="modern-muted">${escapeHtml(getI18nText('tipGoalCardTarget', 'Goal'))}</span>
            </div>
            <div class="modern-row">
              <span class="modern-amount">${escapeHtml(currentUsd)}</span>
              <span class="modern-muted">${escapeHtml(getI18nText('metricsSession', 'Session'))}</span>
            </div>
            <div class="modern-row modern-row-meta">
              <span class="modern-meta-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm13 9H4v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7ZM5 8h14V6h-1v1a1 1 0 1 1-2 0V6H8v1a1 1 0 1 1-2 0V6H5v2Z" fill="currentColor"/></svg>
              </span>
              <span class="modern-muted">${escapeHtml(getI18nText('tipGoalCardMonthlyGoal', 'Monthly goal'))}</span>
            </div>
          </div>
        `;
        const cardEl = goalWidget.querySelector('.modern-card');
        if (cardEl) {
          if (reason === 'initial-load') {
            cardEl.style.opacity = '0';
            requestAnimationFrame(() => {
              cardEl.style.opacity = '1';
            });
          } else {
            cardEl.style.opacity = '1';
          }
        }
      } else {
        card.classList.toggle('theme-dark', themeClass === 'theme-dark');
        card.classList.toggle('theme-light', themeClass === 'theme-light');
        const pill = card.querySelector('.modern-pill');
        if (pill) pill.textContent = statusLabel;
        const titleEl = card.querySelector('.modern-title');
        if (titleEl) titleEl.textContent = title;
        const progressValueEl = card.querySelector('.modern-row-progress .modern-value');
        if (progressValueEl) progressValueEl.textContent = progressValue;
        const bar = card.querySelector('.modern-bar');
        if (bar) setWidthClass(bar, data.progress || 0);
        const amountEls = card.querySelectorAll('.modern-amount');
        if (amountEls[0]) amountEls[0].textContent = targetUsd;
        if (amountEls[1]) amountEls[1].textContent = currentUsd;
      }

  if (isObsWidget) setTipGoalVars({ modern: modernVars, base: {} });
    };

    const renderClassicTheme = (data, reason) => {
      goalWidget.classList.remove('modern-theme');
      applyObsColors(data);

      let container = goalWidget.querySelector('.goal-container');
      const progressPercentage = data.progress || 0;
      const currentAR = formatArAmount(data.current);
      const goalAR = formatArAmount(data.goal);
      const usdValue = formatUsdAmount(data.usdValue);
      const title = data.title && data.title.trim() ? data.title.trim() : getI18nText('tipGoalDefaultTitle', 'Monthly tip goal 🎖️');

      if (!container) {
        goalWidget.innerHTML = '';
        container = document.createElement('div');
        container.className = 'goal-container goal-container-initial';

        const header = document.createElement('div');
        header.className = 'goal-header';

        const titleEl = document.createElement('div');
        titleEl.className = 'goal-title';
        titleEl.textContent = title;
        header.appendChild(titleEl);

        const amounts = document.createElement('div');
        amounts.className = 'goal-amounts';

        const currentEl = document.createElement('span');
        currentEl.className = 'current-ar';
        currentEl.textContent = currentAR;
        amounts.appendChild(currentEl);

        const goalEl = document.createElement('span');
        goalEl.className = 'goal-ar';
        goalEl.textContent = `/ ${goalAR} AR`;
        amounts.appendChild(goalEl);

        const usdEl = document.createElement('span');
        usdEl.className = 'usd-value';
        usdEl.textContent = `$${usdValue} USD`;
        amounts.appendChild(usdEl);

        header.appendChild(amounts);
        container.appendChild(header);

        const progressWrapper = document.createElement('div');
        progressWrapper.className = `progress-container ${progressPercentage >= 100 ? 'reached-goal' : ''}`;

        const bar = document.createElement('div');
        bar.className = `progress-bar w-pct-${Math.max(0, Math.min(100, Math.round(progressPercentage)))}`;
        progressWrapper.appendChild(bar);

        const progressText = document.createElement('div');
        progressText.className = 'progress-text';
        progressText.textContent = `${progressPercentage.toFixed(1)}%`;
        progressWrapper.appendChild(progressText);

        container.appendChild(progressWrapper);
        goalWidget.appendChild(container);

        if (reason === 'initial-load') {
          requestAnimationFrame(() => {
            container.classList.remove('goal-container-initial');
          });
        } else {
          container.classList.remove('goal-container-initial');
        }
      } else {
        const titleEl = container.querySelector('.goal-title');
        if (titleEl) titleEl.textContent = title;
        const currentEl = container.querySelector('.current-ar');
        if (currentEl) currentEl.textContent = currentAR;
        const goalEl = container.querySelector('.goal-ar');
        if (goalEl) goalEl.textContent = `/ ${goalAR} AR`;
        const usdEl = container.querySelector('.usd-value');
        if (usdEl) usdEl.textContent = `$${usdValue} USD`;
        const progressText = container.querySelector('.progress-text');
        if (progressText) progressText.textContent = `${progressPercentage.toFixed(1)}%`;
        const bar = container.querySelector('.progress-bar');
        if (bar) setWidthClass(bar, progressPercentage);
        const wrapper = container.querySelector('.progress-container');
        if (wrapper) {
          wrapper.classList.toggle('reached-goal', progressPercentage >= 100);
          wrapper.classList.toggle('high-progress', progressPercentage >= 80);
        }
      }
    };

    const updateGoalDisplay = (data, reason) => {
      if (!data) {
        goalWidget.classList.remove('celebrating');
        clearCelebrationState();
        goalWidget.innerHTML = `<div class="goal-container"><div class="goal-title">${escapeHtml(
          getI18nText('tipGoalNotConfigured', 'Configure your tip goal 🎯')
        )}</div></div>`;
        return;
      }

      const previousReached = hasReachedGoal;
      const reachedGoal = (data.progress || 0) >= 100;
      hasReachedGoal = reachedGoal;

      mergeStoredColors(data);
      applyObsColors({ ...tipGoalColors, ...data });

      if (data.theme === 'modern-list') {
        renderModernListTheme(data, reason);
      } else {
        renderClassicTheme(data, reason);
      }

      goalWidget.classList.toggle('celebrating', reachedGoal);

      if (reachedGoal && !previousReached) {
        createConfetti(goalWidget, 80);
        createParticles(goalWidget, 24);
        if (!hasPlayedGoalSound) {
          hasPlayedGoalSound = true;
          playGoalSound().catch((error) => {
            console.error('Failed to play goal celebration sound:', error);
          });
        }
      }

      if (!reachedGoal && previousReached) {
        clearCelebrationState();
        goalWidget.querySelectorAll('.confetti, .particles').forEach((node) => node.remove());
      }
    };

    const scheduleGoalUpdate = (data, reason) => {
      pendingUpdate = { data, reason };
      if (updateTimer) return;
      updateTimer = setTimeout(() => {
        updateTimer = null;
        const payload = pendingUpdate;
        pendingUpdate = null;
        try {
          updateGoalDisplay(payload.data, payload.reason);
        } catch (error) {
          console.error('Failed to update tip goal display:', error);
        }
      }, 80);
    };

    const loadInitialData = async () => {
      await loadAudioSettings();
      const modules = await safeFetchJson('/api/modules');
      if (modules && modules.tipGoal) {
        mergeStoredColors(modules.tipGoal);
  const processed = processTipData({ ...modules.tipGoal, ...tipGoalColors });
        if (processed) {
          currentData = processed;
          hasReachedGoal = (processed.progress || 0) >= 100;
          initialDataLoadedAt = Date.now();
          scheduleGoalUpdate(processed, 'initial-load');
          return;
        }
      }
      goalWidget.innerHTML = `<div class="goal-container"><div class="goal-title">${escapeHtml(
        getI18nText('tipGoalLoadFailed', 'Failed to load tip goal data')
      )}</div></div>`;
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
      const search = new URLSearchParams();
      if (tokenParam) {
        search.set('token', tokenParam);
        search.set('widgetToken', tokenParam);
      }
      const query = search.toString();
      return query ? `${protocol}${host}?${query}` : `${protocol}${host}`;
    };

    const scheduleReconnect = () => {
      if (reconnectAttempts >= maxReconnectAttempts) return;
      reconnectAttempts += 1;
      const delay = Math.min(reconnectDelayBase * Math.pow(2, reconnectAttempts - 1), 15000);
      setTimeout(connectWebSocket, delay);
    };

    const connectWebSocket = () => {
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
      }
      try {
        ws = new WebSocket(buildWsUrl());
      } catch (error) {
        console.error('Tip goal WebSocket init failed:', error);
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        reconnectAttempts = 0;
        const now = Date.now();
        if (!initialDataLoadedAt || now - initialDataLoadedAt > 750) {
          loadInitialData();
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (!message || typeof message !== 'object') return;

          if (message.type === 'audioSettingsUpdate' && message.data) {
            if (typeof message.data.audioSource === 'string') {
              audioSettings.audioSource = message.data.audioSource;
            }
            if (typeof message.data.hasCustomAudio === 'boolean') {
              audioSettings.hasCustomAudio = message.data.hasCustomAudio;
            }
            return;
          }

          if ((message.type === 'goalUpdate' || message.type === 'tipGoalUpdate') && message.data) {
            const payload = { ...message.data, ...tipGoalColors };
            mergeStoredColors(payload);
            currentData = processTipData({ ...payload, ...tipGoalColors }) || currentData;
            if (currentData) {
              const newProgress = currentData.progress || 0;
              if (newProgress >= 100 && !hasReachedGoal) {
                hasPlayedGoalSound = false;
              } else if (newProgress < 100 && hasReachedGoal) {
                clearCelebrationState();
              }
              scheduleGoalUpdate(currentData, 'ws-goal-update');
            }
            return;
          }

          if (message.type === 'init' && message.data && message.data.tipGoal) {
            const payload = { ...message.data.tipGoal, ...tipGoalColors };
            mergeStoredColors(payload);
            currentData = processTipData({ ...payload, ...tipGoalColors }) || currentData;
            if (currentData) {
              hasReachedGoal = (currentData.progress || 0) >= 100;
              scheduleGoalUpdate(currentData, 'ws-init');
            }
          }
        } catch (error) {
          console.error('Error processing tip goal message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('Tip goal WebSocket error:', error);
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

    const forceCelebrationCheck = () => {
      if (!currentData) return;
      const progress = currentData.progress || 0;
      const reached = progress >= 100;
      if (reached !== hasReachedGoal) {
        hasReachedGoal = reached;
        scheduleGoalUpdate(currentData, 'celebration-sync');
      }
    };

    loadInitialData();
    connectWebSocket();
    const celebrationInterval = setInterval(forceCelebrationCheck, 5000);

    window.addEventListener('beforeunload', () => {
      try {
        if (ws) ws.close();
      } catch {}
      clearInterval(celebrationInterval);
    });
  }
}
