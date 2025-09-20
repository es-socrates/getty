let __tg_started = false;

function getCookie(name){
  try { return document.cookie.split('; ').find(r=>r.startsWith(name+'='))?.split('=')[1] || ''; } catch { return ''; }
}

export async function initTipGoal() {
  if (__tg_started) return;
  __tg_started = true;

  const goalWidget = document.getElementById('goal-widget');
  if (!goalWidget) return;

  let ws;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const reconnectDelayBase = 1000;
  let currentData = null;
  let hasReachedGoal = false;
  let hasPlayedGoalSound = false;
  let initialDataLoadedAt = 0;
  let updateTimer = null;
  let pendingUpdate = null;

  const isOBSWidget = window.location.pathname.includes('/widgets/');
  let tipGoalColors = {};
  let audioSettings = { audioSource: 'remote', hasCustomAudio: false };
  const REMOTE_SOUND_URL = 'https://52agquhrbhkx3u72ikhun7oxngtan55uvxqbp4pzmhslirqys6wq.arweave.net/7oBoUPEJ1X3T-kKPRv3XaaYG97St4Bfx-WHktEYYl60';

  function getNonce() {
    try {
      const m = document.querySelector('meta[property="csp-nonce"]');
      return (m && (m.nonce || m.getAttribute('nonce'))) || document.head?.dataset?.cspNonce || '';
    } catch { return ''; }
  }
  function ensureStyleTag(id) {
    let tag = document.getElementById(id);
    if (!tag) {
      tag = document.createElement('style');
      tag.id = id;
      const n = getNonce();
      if (n) tag.setAttribute('nonce', n);
      document.head.appendChild(tag);
    } else {
      try { const n = getNonce(); if (n && !tag.getAttribute('nonce')) tag.setAttribute('nonce', n); } catch {}
    }
    return tag;
  }
  function setTipGoalVars({ modern, base }) {
    try {
      const tag = ensureStyleTag('tip-goal-inline-vars');
      let css = '';
      if (modern) {
        css += `#goal-widget.modern-theme .modern-card{` +
          (modern.bg ? `--modern-bg:${modern.bg};` : '') +
          (modern.text ? `--modern-text:${modern.text};` : '') +
          (modern.accent ? `--modern-accent:${modern.accent};` : '') +
          (modern.progressBg ? `--modern-progress-bg:${modern.progressBg};` : '') +
        `}`;
      }
      if (base) {
        css += `#goal-widget:not(.modern-theme).tip-goal-widget{` +
          (base.bg ? `--tg-bg:${base.bg};` : '') +
          (base.border ? `--tg-border:${base.border};` : '') +
          (base.text ? `--tg-text:${base.text};` : '') +
          (base.progress ? `--tg-progress:${base.progress};` : '') +
        `}`;
      }
      tag.textContent = css;
    } catch {}
  }

  function playGoalSound() {
    const useCustom = audioSettings.audioSource === 'custom' && audioSettings.hasCustomAudio;
    const audioUrl = useCustom ? '/api/goal-audio' : REMOTE_SOUND_URL;
    const audio = new Audio(audioUrl);
    audio.volume = 0.9;
    audio.play().catch(() => {
      if (useCustom) {
        const fallback = new Audio(REMOTE_SOUND_URL);
        fallback.volume = 0.9;
        fallback.play().catch(()=>{});
      }
    });
  }

  async function loadAudioSettings() {
    try {
      const res = await fetch('/api/goal-audio-settings');
      if (res.ok) {
        const data = await res.json();
        audioSettings = {
          audioSource: data.audioSource || 'remote',
          hasCustomAudio: data.hasCustomAudio || false,
        };
      }
    } catch {}
  }

  async function resetCelebrationState() {
    try { localStorage.removeItem('tipGoalCelebration'); hasPlayedGoalSound = false; } catch {}
  }

  function createConfetti(container, count = 50) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.classList.add('confetti');
      const pos = Math.floor(Math.random() * 20);
      const size = Math.floor(Math.random() * 5);
      const color = Math.floor(Math.random() * 6);
      const dur = Math.floor(Math.random() * 7) + 2;
      const delay = Math.floor(Math.random() * 11);
      if (Math.random() > 0.5) el.classList.add('round');
      el.classList.add(`pos-${pos}`, `size-${size}`, `color-${color}`, `dur-${dur-2}`, `delay-${delay}`);
      container.appendChild(el);
      const ttl = (dur + delay) * 1000;
      setTimeout(() => { el.remove(); }, ttl);
    }
  }
  function createPersistentConfetti(container) {
    const confettiInterval = setInterval(() => {
      if (!container.classList.contains('celebrating')) { clearInterval(confettiInterval); return; }
      createConfetti(container, 20);
    }, 3000);
    setTimeout(() => { clearInterval(confettiInterval); }, 30000);
  }
  function createParticles(container, count = 20) {
    const wrap = document.createElement('div');
    wrap.className = 'particles';
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const pos = Math.floor(Math.random() * 20);
      const duration = Math.floor(Math.random() * 3) + 1;
      const delay = Math.floor(Math.random() * 3);
      p.classList.add(`pos-${pos}`, `p-dur-${duration}`, `p-delay-${delay}`);
      wrap.appendChild(p);
    }
    container.appendChild(wrap);
    setTimeout(() => { wrap.remove(); }, 5000);
  }

  async function loadInitialData() {
    await loadAudioSettings();
  fetch('/api/modules')
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(data => {
        if (data.tipGoal) {
          tipGoalColors = {
            bgColor: data.tipGoal.bgColor,
            fontColor: data.tipGoal.fontColor,
            borderColor: data.tipGoal.borderColor,
            progressColor: data.tipGoal.progressColor,
          };
          currentData = processTipData(data.tipGoal);
          hasReachedGoal = currentData.progress >= 100;
          initialDataLoadedAt = Date.now();
          scheduleGoalUpdate(currentData, 'initial-load');
        }
      })
      .catch(() => {
        goalWidget.innerHTML = `
          <div class="goal-container">
            <div class="goal-header">
              <div class="goal-title">Monthly tip goal 🎖️</div>
              <div class="error-message">Failed to load data</div>
            </div>
          </div>`;
      });
  }

  function processTipData(data) {
    const current = data.currentAmount ?? data.currentTips ?? data.current ?? 0;
    const goal = data.monthlyGoal ?? data.goal ?? 10;
    const rate = data.exchangeRate ?? data.rate ?? 0;
    const themeRaw = data.theme || 'classic';
    const theme = themeRaw === 'koku-list' ? 'modern-list' : themeRaw;
    return {
      current,
      goal,
      progress: Math.min((current / goal) * 100, 100),
      rate,
      usdValue: (current * rate).toFixed(2),
      goalUsd: (goal * rate).toFixed(2),
      lastDonation: data.lastDonationTimestamp ?? data.lastDonation,
      title: data.title,
      theme,
      bgColor: data.bgColor,
      fontColor: data.fontColor,
      borderColor: data.borderColor,
      progressColor: data.progressColor,
    };
  }

  function scheduleGoalUpdate(data) {
    try {
      pendingUpdate = data;
      if (updateTimer) return;
      updateTimer = setTimeout(() => {
        const d = pendingUpdate; pendingUpdate = null; updateTimer = null;
        try { updateGoalDisplay(d); } catch (e) { console.error('updateGoalDisplay failed:', e); }
      }, 80);
    } catch (e) { console.error('scheduleGoalUpdate error:', e); }
  }

  function setWidthClass(el, pct) {
    if (!el) return;
    const n = Math.max(0, Math.min(100, Math.round(pct || 0)));
    try { el.classList.forEach(c => { if (c.startsWith('w-pct-')) el.classList.remove(c); }); } catch {}
    el.classList.add(`w-pct-${n}`);
  }

  function renderModernListTheme(data) {
    const prefersDark = (() => { try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; } })();
    const themeClass = prefersDark ? 'theme-dark' : 'theme-light';
    const t = (window.__i18n && window.__i18n.t) ? window.__i18n.t : (k=>k);
    const titleSafe = (data.title || t('tipGoalDefaultTitle')).replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const statusCompleted = (data.progress || 0) >= 100;
    const statusLabel = statusCompleted ? t('tipGoalCardStatusCompleted') : t('tipGoalCardStatusInProgress');
    const targetUsd = data.goalUsd || ((data.goal || 0) * (data.rate || 0)).toFixed(2);
    const currentUsd = data.usdValue || ((data.current || 0) * (data.rate || 0)).toFixed(2);

    goalWidget.innerHTML = `
      <div class="modern-card ${themeClass}">
        <div class="modern-top">
          <div class="modern-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/><path d="M12 3v4M21 12h-4M12 21v-4M3 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </div>
          <span class="modern-pill">${statusLabel}</span>
        </div>
        <div class="modern-header">
          <h3 class="modern-title">${titleSafe}</h3>
        </div>
        <div class="modern-row modern-row-progress">
          <span class="modern-label">${t('tipGoalCardProgress')}</span>
          <span class="modern-value">${(data.progress || 0).toFixed(0)}%</span>
        </div>
  <div class="modern-progress"><div class="modern-bar w-pct-${Math.max(0, Math.min(100, Math.round(data.progress || 0)))}"></div></div>
        <div class="modern-row">
          <span class="modern-amount">$${targetUsd}</span>
          <span class="modern-muted">${t('tipGoalCardTarget')}</span>
        </div>
        <div class="modern-row">
          <span class="modern-amount">$${currentUsd}</span>
          <span class="modern-muted">${t('metricsSession') || 'Session'}</span>
        </div>
        <div class="modern-row modern-row-meta">
          <span class="modern-meta-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm13 9H4v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7ZM5 8h14V6h-1v1a1 1 0 1 1-2 0V6H8v1a1 1 0 1 1-2 0V6H5v2Z" fill="currentColor"/></svg>
          </span>
          <span class="modern-muted">${t('tipGoalCardMonthlyGoal')}</span>
        </div>
      </div>`;

  const card = goalWidget.querySelector('.modern-card');
    const bg = data.bgColor || (prefersDark ? '#0F0F12' : '#ffffff');
    const text = data.fontColor || (prefersDark ? '#ffffff' : '#0a0a0a');
    const accent = data.progressColor || (prefersDark ? '#00ff7f' : '#0a0a0a');
    const progressBg = prefersDark ? 'rgba(35,38,47,0.31)' : '#e5e7eb';
  setTipGoalVars({ modern: { bg, text, accent, progressBg } });
    const bar = goalWidget.querySelector('.modern-bar');
    if (bar) setWidthClass(bar, data.progress || 0);
  }

  function updateGoalDisplay(data) {
    if (!data) return;
    const bgColor = data.bgColor || '#222222';
    const fontColor = data.fontColor || '#ffffff';
    const borderColor = data.borderColor || '#ffcc00';
    const progressColor = data.progressColor || '#00ff00';
    const progressPercentage = data.progress || 0;
    const currentUSD = data.usdValue || '0.00';
    const currentAR = data.current ? data.current.toFixed(2) : '0.00';
    const goalAR = data.goal || 10;
    const wasCelebrating = goalWidget.classList.contains('celebrating');
    const reachedGoal = progressPercentage >= 100;
    hasReachedGoal = reachedGoal;
    const existingClasses = goalWidget.className;
    const t = (window.__i18n && window.__i18n.t) ? window.__i18n.t : (k=>k);
    const customTitle = (data.title && String(data.title).trim()) ? String(data.title).trim() : t('tipGoalDefaultTitle');

    if (data.theme === 'modern-list' && isOBSWidget) {
  goalWidget.classList.add('modern-theme');
      renderModernListTheme({ ...data, current: parseFloat(currentAR), goal: goalAR });
    } else {
      goalWidget.classList.remove('modern-theme');
      goalWidget.innerHTML = `
        <div class="goal-container">
          <div class="goal-header">
            <div class="goal-title">${customTitle.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
            <div class="goal-amounts">
              <span class="current-ar">${currentAR}</span>
              <span class="goal-ar">/ ${goalAR} AR</span>
              <span class="usd-value">$${currentUSD} USD</span>
            </div>
          </div>
          <div class="progress-container ${reachedGoal ? 'reached-goal' : ''}">
            <div class="progress-bar w-pct-${Math.max(0, Math.min(100, Math.round(progressPercentage)))}"></div>
            <div class="progress-text">${progressPercentage.toFixed(1)}%</div>
          </div>
        </div>`;
    }

    goalWidget.className = existingClasses;
    if (isOBSWidget && data.theme === 'modern-list') goalWidget.classList.add('modern-theme');
    else goalWidget.classList.remove('modern-theme');

    if (isOBSWidget && data.theme !== 'modern-list') {
      setTipGoalVars({ base: { bg: bgColor, border: borderColor, text: fontColor, progress: progressColor } });
    }
    const progressBar = goalWidget.querySelector('.progress-bar');
    if (progressBar) setWidthClass(progressBar, progressPercentage);

    if (reachedGoal) {
      if (!wasCelebrating) createConfetti(goalWidget, 100);
      if (!hasPlayedGoalSound) { playGoalSound(); hasPlayedGoalSound = true; }
    }
    if (reachedGoal && !wasCelebrating) {
      goalWidget.classList.add('celebrating');
      createParticles(goalWidget, 30);
      createPersistentConfetti(goalWidget);
    } else if (!reachedGoal && wasCelebrating) {
      goalWidget.classList.remove('celebrating');
      goalWidget.querySelectorAll('.confetti, .particles').forEach(el => el.remove());
    }
  }

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const cookieToken = getCookie('getty_public_token') || getCookie('getty_admin_token') || new URLSearchParams(location.search).get('token') || '';
  const q = '';
  ws = new WebSocket(`${protocol}//${window.location.host}${q}`);
    ws.onopen = () => { setTimeout(async () => { if (!initialDataLoadedAt || (Date.now() - initialDataLoadedAt) > 1000) await loadInitialData(); }, 150); };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'audioSettingsUpdate') {
          audioSettings = { audioSource: msg.data.audioSource || 'remote', hasCustomAudio: msg.data.hasCustomAudio || false };
          return;
        }
        if ((msg.type === 'goalUpdate' || msg.type === 'tipGoalUpdate') && msg.data) {
          msg.data = { ...msg.data, ...tipGoalColors };
          const previousProgress = currentData ? currentData.progress : 0;
          currentData = processTipData(msg.data);
          const newProgress = currentData.progress;
          if (newProgress >= 100 && previousProgress < 100) { hasReachedGoal = true; hasPlayedGoalSound = false; }
          else if (newProgress < 100 && previousProgress >= 100) { hasReachedGoal = false; resetCelebrationState(); }
          else { hasReachedGoal = newProgress >= 100; }
          scheduleGoalUpdate(currentData, 'ws-goal-update');
        } else if (msg.type === 'init' && msg.data?.tipGoal) {
          msg.data.tipGoal = { ...msg.data.tipGoal, ...tipGoalColors };
          currentData = processTipData(msg.data.tipGoal);
          hasReachedGoal = currentData.progress >= 100;
          scheduleGoalUpdate(currentData, 'ws-init');
        }
      } catch (e) { console.error('Error processing tip-goal message:', e); }
    };
    ws.onerror = (error) => { console.error('WebSocket error:', error); };
    ws.onclose = () => {
      if (reconnectAttempts < maxReconnectAttempts) {
        const delay = Math.min(reconnectDelayBase * Math.pow(2, reconnectAttempts), 15000);
        setTimeout(connectWebSocket, delay);
        reconnectAttempts++;
      }
    };
  }

  goalWidget.classList.add('goal-widget');
  if (isOBSWidget) goalWidget.classList.add('tip-goal-widget');
  const existingClasses = goalWidget.className;
  goalWidget.innerHTML = `
    <div class="goal-container">
      <div class="goal-header">
        <div class="goal-title" data-i18n="tipGoalDefaultTitle">Configure tip goal 💸</div>
        <div class="goal-amounts">
          <span class="current-ar">0.00</span>
          <span class="goal-ar">/ 0.00 AR</span>
          <span class="usd-value">$0.00 USD</span>
        </div>
      </div>
      <div class="progress-container">
        <div class="progress-bar w-pct-0"></div>
        <div class="progress-text">0%</div>
      </div>
    </div>`;
  goalWidget.className = existingClasses;
  goalWidget.classList.remove('modern-theme');

  connectWebSocket();
  loadInitialData();

  function forceUpdateCelebrationState() {
    if (currentData) {
      const newReachedGoal = currentData.progress >= 100;
      if (newReachedGoal !== hasReachedGoal) { hasReachedGoal = newReachedGoal; scheduleGoalUpdate(currentData, 'force-update-celebration'); }
    }
  }
  setInterval(forceUpdateCelebrationState, 5000);
}

export default { initTipGoal };
