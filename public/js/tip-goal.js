(function(){
    if (window.__tip_goal_started) return;
    const start = () => {
        if (window.__tip_goal_started) return;
        window.__tip_goal_started = true;
    const goalWidget = document.getElementById('goal-widget');
    
    if (!goalWidget) {
        console.error('Goal widget container not found');
        return;
    }

    let ws;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const reconnectDelayBase = 5000;
    let currentData = null;
    let hasReachedGoal = false;
    let hasPlayedGoalSound = false;
    let initialDataLoadedAt = 0;
    let updateTimer = null;
    let pendingUpdate = null;

    const isOBSWidget = window.location.pathname.includes('/widgets/');
    let tipGoalColors = {};
    let audioSettings = {
        audioSource: 'remote',
        hasCustomAudio: false
    };

    const REMOTE_SOUND_URL = 'https://52agquhrbhkx3u72ikhun7oxngtan55uvxqbp4pzmhslirqys6wq.arweave.net/7oBoUPEJ1X3T-kKPRv3XaaYG97St4Bfx-WHktEYYl60';

    function getWidgetTokenParam() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('widgetToken') || '';
        } catch { return ''; }
    }

    function getNonce() {
        try {
            const m = document.querySelector('meta[property="csp-nonce"]');
            return (m && (m.nonce || m.getAttribute('nonce'))) || (document.head && document.head.dataset && document.head.dataset.cspNonce) || '';
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
            try {
                const n = getNonce();
                if (n && !tag.getAttribute('nonce')) tag.setAttribute('nonce', n);
            } catch {}
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

    async function playGoalSound() {
        let audioUrl;
        let logMessage;
        if (audioSettings.audioSource === 'custom' && audioSettings.hasCustomAudio) {

            if (currentData && currentData.customAudioUrl) {
                audioUrl = currentData.customAudioUrl;
                logMessage = '🎵 Custom goal audio played';
            } else {

                try {
                    const widgetToken = getWidgetTokenParam();
                    const url = widgetToken ? `/api/goal-audio?widgetToken=${encodeURIComponent(widgetToken)}` : '/api/goal-audio';
                    const response = await fetch(url);
                    if (response.ok) {
                        const data = await response.json();
                        audioUrl = data.url;
                        logMessage = '🎵 Custom goal audio played';
                    } else {

                        audioUrl = REMOTE_SOUND_URL;
                        logMessage = '🎵 Remote goal sound played (fallback)';
                    }
                } catch (error) {
                    console.error('Error fetching custom goal audio URL:', error);
                    audioUrl = REMOTE_SOUND_URL;
                    logMessage = '🎵 Remote goal sound played (fallback)';
                }
            }
        } else {
            audioUrl = REMOTE_SOUND_URL;
            logMessage = '🎵 Remote goal sound played';
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

    if (window.location.pathname.includes('admin')) {

        const remoteRadio = document.getElementById('goal-audio-remote');
        const customRadio = document.getElementById('goal-audio-custom');
        const customSection = document.getElementById('goal-custom-audio-section');
        const audioStatus = document.getElementById('goal-audio-status');
        const fileInput = document.getElementById('goal-custom-audio-file');
        const preview = document.getElementById('goal-audio-preview');
        const nameEl = document.getElementById('goal-audio-name');
        const sizeEl = document.getElementById('goal-audio-size');
        const durationEl = document.getElementById('goal-audio-duration');
        const playBtn = document.getElementById('play-goal-audio');
        const removeBtn = document.getElementById('remove-goal-audio');

    function updateAudioUI() {
            if (!remoteRadio || !customRadio || !customSection || !audioStatus) return;
            if (remoteRadio.checked) {
        customSection.classList.add('hidden');
        audioStatus.classList.remove('hidden');
                audioStatus.textContent = '🔊 ' + (audioSettings.hasCustomAudio ? 'Remote Audio (custom one is saved, but not active))' : 'Remote audio');
            } else if (customRadio.checked) {
        customSection.classList.remove('hidden');
                if (audioSettings.hasCustomAudio) {
            audioStatus.classList.remove('hidden');
                    audioStatus.textContent = '🎵 Custom Audio Active';
            if (preview) preview.classList.remove('hidden');
                } else {
            audioStatus.classList.remove('hidden');
                    audioStatus.textContent = '⚠️ No Custom Audio Saved';
            if (preview) preview.classList.add('hidden');
                }
            }
        }

        if (fileInput && preview && nameEl && sizeEl && durationEl) {
            fileInput.addEventListener('change', function () {
                const file = fileInput.files[0];
                if (file) {
                    nameEl.textContent = file.name;
                    sizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';
                    const audio = document.createElement('audio');
                    audio.src = URL.createObjectURL(file);
                    audio.addEventListener('loadedmetadata', function () {
                        durationEl.textContent = (audio.duration ? (audio.duration >= 60 ? Math.floor(audio.duration / 60) + ':' + String(Math.round(audio.duration % 60)).padStart(2, '0') : audio.duration.toFixed(2) + 's') : '');
                    });
                    preview.classList.remove('hidden');
                } else {
                    preview.classList.add('hidden');
                }
            });
        }

        if (playBtn && fileInput) {
            playBtn.addEventListener('click', function () {
                const file = fileInput.files[0];
                if (file) {
                    const audio = new Audio(URL.createObjectURL(file));
                    audio.play();
                }
            });
        }

        if (removeBtn && fileInput) {
            removeBtn.addEventListener('click', function () {
                fileInput.value = '';
                if (preview) preview.classList.add('hidden');
            });
        }

        if (remoteRadio && customRadio) {
            remoteRadio.addEventListener('change', updateAudioUI);
            customRadio.addEventListener('change', updateAudioUI);
        }

        const audioForm = document.getElementById('goal-audio-form');
        if (audioForm) {
            audioForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const formData = new FormData(audioForm);
                const audioSource = formData.get('audioSource');

                try {
                    const response = await fetch('/api/goal-audio-settings', {
                        method: 'POST',
                        body: formData
                    });
                    const result = await response.json();
                    if (result.success) {
                        audioSettings = {
                            audioSource: result.audioSource || 'remote',
                            hasCustomAudio: result.hasCustomAudio || false
                        };
                        updateAudioUI();
                        alert('Audio settings saved successfully!');
                    } else {
                        alert('Error saving audio settings: ' + (result.error || 'Unknown error'));
                    }
                } catch (error) {
                    console.error('Error saving audio settings:', error);
                    alert('Error saving audio settings');
                }
            });
        }

        setTimeout(updateAudioUI, 300);
    }

    async function loadAudioSettings() {
        try {
            const widgetToken = getWidgetTokenParam();
            const url = widgetToken ? `/api/goal-audio-settings?widgetToken=${encodeURIComponent(widgetToken)}` : '/api/goal-audio-settings';
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                audioSettings = {
                    audioSource: data.audioSource || 'remote',
                    hasCustomAudio: data.hasCustomAudio || false
                };
            }
        } catch (error) {
            console.error('Error loading audio settings:', error);
        }
    }

    async function resetCelebrationState() {
        try {
            localStorage.removeItem('tipGoalCelebration');
            hasPlayedGoalSound = false;
        } catch (error) {
            console.warn('Could not reset celebration state:', error);
        }
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
            if (!container.classList.contains('celebrating')) {
                clearInterval(confettiInterval);
                return;
            }
            createConfetti(container, 20);
        }, 3000);
        
        setTimeout(() => {
            clearInterval(confettiInterval);
        }, 30000);
    }

    function createParticles(container, count = 20) {
        const particlesContainer = document.createElement('div');
        particlesContainer.className = 'particles';
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            const pos = Math.floor(Math.random() * 20);
            const duration = Math.floor(Math.random() * 3) + 1; // 1..3
            const delay = Math.floor(Math.random() * 3); // 0..2
            particle.classList.add(`pos-${pos}`, `p-dur-${duration}`, `p-delay-${delay}`);
            particlesContainer.appendChild(particle);
        }
        container.appendChild(particlesContainer);
        setTimeout(() => {
            particlesContainer.remove();
        }, 5000);
    }

    async function loadInitialData() {
        await loadAudioSettings();
        
        const widgetToken = getWidgetTokenParam();
        const url = widgetToken ? `/api/modules?widgetToken=${encodeURIComponent(widgetToken)}` : '/api/modules';
    fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (data.tipGoal) {
                    tipGoalColors = {
                        bgColor: data.tipGoal.bgColor,
                        fontColor: data.tipGoal.fontColor,
                        borderColor: data.tipGoal.borderColor,
                        progressColor: data.tipGoal.progressColor
                    };
                    currentData = processTipData(data.tipGoal);
                    hasReachedGoal = currentData.progress >= 100;
                    initialDataLoadedAt = Date.now();
                    scheduleGoalUpdate(currentData, 'initial-load');
                } else {
                    console.warn('No tipGoal data in initial response');
                }
            })
            .catch(error => {
                console.error('Error loading initial data:', error);
                goalWidget.innerHTML = `
                    <div class="goal-container">
                        <div class="goal-header">
                            <div class="goal-title">Monthly tip goal 🎖️</div>
                            <div class="error-message">Failed to load data</div>
                        </div>
                    </div>
                `;
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
            customAudioUrl: data.customAudioUrl
        };
    }

    function scheduleGoalUpdate(data, reason = '') {
        try {
            pendingUpdate = data;
            if (updateTimer) return;
            updateTimer = setTimeout(() => {
                const d = pendingUpdate;
                pendingUpdate = null;
                updateTimer = null;
                try { updateGoalDisplay(d); } catch (e) { console.error('updateGoalDisplay failed:', e); }
            }, 80);
        } catch (e) {
            console.error('scheduleGoalUpdate error:', e);
        }
    }

    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const widgetToken = getWidgetTokenParam();
        const wsUrl = widgetToken ? `${protocol}//${window.location.host}?widgetToken=${encodeURIComponent(widgetToken)}` : `${protocol}//${window.location.host}`;
    ws = new WebSocket(wsUrl);

        ws.onopen = async () => {
            setTimeout(async () => {
                if (!initialDataLoadedAt || (Date.now() - initialDataLoadedAt) > 1000) {
                    await loadInitialData();
                }
            }, 150);
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                console.debug('WebSocket message received:', msg);

                if (msg.type === 'audioSettingsUpdate') {
                    audioSettings = {
                        audioSource: msg.data.audioSource || 'remote',
                        hasCustomAudio: msg.data.hasCustomAudio || false
                    };
                    return;
                }

                if ((msg.type === 'goalUpdate' || msg.type === 'tipGoalUpdate') && msg.data) {
                    msg.data = { ...msg.data, ...tipGoalColors };
                    const previousProgress = currentData ? currentData.progress : 0;
                    currentData = processTipData(msg.data);
                    const newProgress = currentData.progress;
                    if (newProgress >= 100 && previousProgress < 100) {
                        hasReachedGoal = true;
                        hasPlayedGoalSound = false;
                    } else if (newProgress < 100 && previousProgress >= 100) {
                        hasReachedGoal = false;
                        resetCelebrationState();
                    } else {
                        hasReachedGoal = newProgress >= 100;
                    }
                    scheduleGoalUpdate(currentData, 'ws-goal-update');
                } else if (msg.type === 'init' && msg.data?.tipGoal) {
                    msg.data.tipGoal = { ...msg.data.tipGoal, ...tipGoalColors };
                    currentData = processTipData(msg.data.tipGoal);
                    hasReachedGoal = currentData.progress >= 100;
                    scheduleGoalUpdate(currentData, 'ws-init');
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {

            if (reconnectAttempts < maxReconnectAttempts) {
                const delay = Math.min(reconnectDelayBase * Math.pow(2, reconnectAttempts), 15000);

                setTimeout(connectWebSocket, delay);
                reconnectAttempts++;
            }
        };
    }

    function setWidthClass(el, pct) {
        if (!el) return;
        const n = Math.max(0, Math.min(100, Math.round(pct || 0)));
        try {
            el.classList.forEach(c => { if (c.startsWith('w-pct-')) el.classList.remove(c); });
        } catch {}
        el.classList.add(`w-pct-${n}`);
    }

    function renderModernListTheme(data) {
        const prefersDark = (() => {
            try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; }
        })();
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
                <!-- footer removed -->
            </div>
        `;

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
        if (!data) {
            console.warn('No data provided to updateGoalDisplay');
            return;
        }

        const bgColor = data.bgColor || '#222222';
        const fontColor = data.fontColor || '#ffffff';
        const borderColor = data.borderColor || '#ffcc00';
        const progressColor = data.progressColor || '#00ff00';
        const progressPercentage = data.progress || 0;
        const currentUSD = data.usdValue || "0.00";
        const currentAR = data.current ? data.current.toFixed(2) : "0.00";
        const goalAR = data.goal || 10;
        const wasCelebrating = goalWidget.classList.contains('celebrating');
        const reachedGoal = progressPercentage >= 100;
        
        hasReachedGoal = reachedGoal;
        
        const existingClasses = goalWidget.className;
        
    const t = (window.__i18n && window.__i18n.t) ? window.__i18n.t : (k=>k);
    let customTitle = (data.title && String(data.title).trim()) ? String(data.title).trim() : t('tipGoalDefaultTitle');

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
            </div>
        `;
        }
        
        goalWidget.className = existingClasses;

    if (isOBSWidget && data.theme === 'modern-list') {
        goalWidget.classList.add('modern-theme');
        } else {
        goalWidget.classList.remove('modern-theme');
        }

        if (isOBSWidget && data.theme !== 'modern-list') {
            setTipGoalVars({ base: { bg: bgColor, border: borderColor, text: fontColor, progress: progressColor } });
        }

    const progressBar = goalWidget.querySelector('.progress-bar');
    if (progressBar) setWidthClass(progressBar, progressPercentage);

        if (reachedGoal) {
            if (!wasCelebrating) {
                createConfetti(goalWidget, 100);
            }
            
            if (!hasPlayedGoalSound) {
                playGoalSound();
                hasPlayedGoalSound = true;
            }
        }
        
        if (reachedGoal && !wasCelebrating) {
            goalWidget.classList.add('celebrating');
            createParticles(goalWidget, 30);
            createPersistentConfetti(goalWidget);
        } else if (!reachedGoal && wasCelebrating) {
            goalWidget.classList.remove('celebrating');
            const existingConfetti = goalWidget.querySelectorAll('.confetti');
            const existingParticles = goalWidget.querySelectorAll('.particles');
            existingConfetti.forEach(el => el.remove());
            existingParticles.forEach(el => el.remove());
        }
    }

    goalWidget.classList.add('goal-widget');
    
    if (isOBSWidget) {
        goalWidget.classList.add('tip-goal-widget');
    }
    
    connectWebSocket();
    loadInitialData();

    function forceUpdateCelebrationState() {
        if (currentData) {
            const newReachedGoal = currentData.progress >= 100;
            if (newReachedGoal !== hasReachedGoal) {
                hasReachedGoal = newReachedGoal;
                scheduleGoalUpdate(currentData, 'force-update-celebration');
            }
        }
    }

    setInterval(forceUpdateCelebrationState, 5000);

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
        </div>
    `;
    
    goalWidget.className = existingClasses;
    goalWidget.classList.remove('modern-theme');
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
