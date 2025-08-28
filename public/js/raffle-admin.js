document.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('languageChanged', function () {
        if (typeof updateUI === 'function' && lastState) {
            updateUI(lastState);
        }
    });
    let timerBox = document.getElementById('raffle-timer');
    if (!timerBox) {
        timerBox = document.createElement('div');
        timerBox.id = 'raffle-timer';
        timerBox.style.display = 'none';
        timerBox.style.background = '#333';
        timerBox.style.color = '#fff';
        timerBox.style.fontSize = '1.1em';
        timerBox.style.padding = '6px 10px';
        timerBox.style.margin = '8px 0';
        timerBox.style.textAlign = 'center';
        timerBox.style.borderRadius = '6px';
        document.querySelector('#raffle-tab .form-card')?.prepend(timerBox);
    }
    let timerInterval = null;

    const saveBtn = document.getElementById('raffle-save');
    const startBtn = document.getElementById('raffle-start');
    const stopBtn = document.getElementById('raffle-stop');
    const pauseBtn = document.getElementById('raffle-pause');
    const resumeBtn = document.getElementById('raffle-resume');
    const drawBtn = document.getElementById('raffle-draw');
    const resetBtn = document.getElementById('raffle-reset');
    const imageInput = document.getElementById('raffle-image');
    const imagePreview = document.getElementById('raffle-image-preview');
    const enabledCheckbox = document.getElementById('raffle-enabled');
    const participantsList = document.getElementById('raffle-participants');
    const winnersList = document.getElementById('raffle-winners');

    let errorBox = document.getElementById('raffle-error');
    if (!errorBox) {
        errorBox = document.createElement('div');
        errorBox.id = 'raffle-error';
        errorBox.style.display = 'none';
        errorBox.style.color = 'red';
        document.querySelector('#raffle-tab .form-card')?.prepend(errorBox);
    }

    const btns = [
        ['raffle-save', saveBtn],
        ['raffle-start', startBtn],
        ['raffle-stop', stopBtn],
        ['raffle-pause', pauseBtn],
        ['raffle-resume', resumeBtn],
        ['raffle-draw', drawBtn],
        ['raffle-reset', resetBtn]
    ];
    btns.forEach(([id, el]) => {
        if (!el) console.warn(`[raffle-admin.js] Button not found: #${id}`);
    });

    let ws;
    let lastState = {};
    let winnerBanner = document.getElementById('raffle-winner-banner');
    if (!winnerBanner) {
        winnerBanner = document.createElement('div');
        winnerBanner.id = 'raffle-winner-banner';
        winnerBanner.style.display = 'none';
        winnerBanner.style.background = '#0a0e12';
        winnerBanner.style.color = '#FFD700';
        winnerBanner.style.fontSize = '1.3em';
        winnerBanner.style.padding = '10px';
        winnerBanner.style.margin = '10px 0';
        winnerBanner.style.textAlign = 'center';
        winnerBanner.style.borderRadius = '8px';
        document.querySelector('#raffle-tab .form-card')?.prepend(winnerBanner);
    }

    function showError(msg) {
        if (errorBox) {
            errorBox.textContent = msg;
            errorBox.style.display = 'block';
        }
    }
    function clearError() {
        if (errorBox) errorBox.style.display = 'none';
    }

    function showSaveToast(success = true) {
        const toast = document.getElementById('copy-toast');
        const icon = toast.querySelector('.copy-icon');
        const message = toast.querySelector('.copy-message');
        if (success) {
            icon.innerHTML = '<path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />';
            message.textContent = 'Configuration saved successfully';
            toast.style.borderColor = 'var(--secondary-color)';
        } else {
            icon.innerHTML = '<path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />';
            message.textContent = 'Error saving configuration';
            toast.style.borderColor = 'var(--error-color)';
        }
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    function updateUI(state) {
        if (timerInterval) clearInterval(timerInterval);
        timerBox.style.display = 'none';
        try {
            if (!state || typeof state !== 'object') {
                lastState = {};
                return;
            }
            lastState = state;

            const statusText = document.getElementById('raffle-status');
            if (statusText) {
                let statusKey = 'not_configured';
                if (state.enabled) {
                    if (state.active) {
                        statusKey = state.paused ? 'paused' : 'active';
                    } else {
                        statusKey = 'inactive';
                    }
                }
                statusText.textContent = getStatusTextI18n(statusKey);
            }
            function getStatusTextI18n(key) {
                const keyMap = {
                    active: 'raffleActive',
                    paused: 'rafflePaused',
                    inactive: 'raffleInactive',
                    not_configured: 'raffleNotConfigured'
                };
                const i18nKey = keyMap[key] || 'raffleNotConfigured';
                if (window.languageManager && typeof window.languageManager.getText === 'function') {
                    return window.languageManager.getText(i18nKey);
                }
                return {
                    raffleActive: 'The draw is active',
                    rafflePaused: 'The draw is paused',
                    raffleInactive: 'The draw is inactive',
                    raffleNotConfigured: 'The draw is not configured'
                }[i18nKey];
            }
            if (enabledCheckbox) enabledCheckbox.checked = !!state.enabled;
            const commandInput = document.getElementById('raffle-command');
            const prizeInput = document.getElementById('raffle-prize');
            const maxWinnersInput = document.getElementById('raffle-max-winners');

            if (commandInput && document.activeElement !== commandInput) commandInput.value = state.command || '!giveaway';
            if (prizeInput && document.activeElement !== prizeInput) prizeInput.value = state.prize || '';
            if (maxWinnersInput && document.activeElement !== maxWinnersInput) maxWinnersInput.value = state.maxWinners || 1;
            if (state.imageUrl && imagePreview) {
                imagePreview.src = state.imageUrl;
                imagePreview.style.display = '';
            } else if (imagePreview) {
                imagePreview.style.display = 'none';
            }

            if (participantsList) {
                participantsList.innerHTML = '';
                if (Array.isArray(state.participants)) {

                    let lastWinnerName = '';
                    if (state.previousWinners && state.previousWinners.length > 0) {
                        const lastWinner = state.previousWinners[state.previousWinners.length - 1];
                        if (typeof lastWinner === 'object' && lastWinner !== null) {
                            lastWinnerName = lastWinner.username || lastWinner.name || '';
                        } else if (typeof lastWinner === 'string') {
                            lastWinnerName = lastWinner;
                        }
                    }
                    state.participants.forEach(p => {
                        let username = '';
                        if (Array.isArray(p) && p.length > 1 && typeof p[1] === 'object') {
                            username = p[1].username || p[1].name || '';
                        } else if (typeof p === 'object' && p !== null) {
                            username = p.username || p.name || '';
                        } else if (typeof p === 'string' && p.length <= 20) {
                            username = p;
                        }
                        if (!username) username = 'Spaceman';

                        if (username && username !== lastWinnerName && username.length <= 20) {
                            const li = document.createElement('li');
                            li.textContent = username;
                            participantsList.appendChild(li);
                        }
                    });
                }
            }

            if (winnersList) {
                winnersList.innerHTML = '';
                if (Array.isArray(state.previousWinners)) {
                    state.previousWinners.forEach(w => {
                        let winnerName = '';
                        if (typeof w === 'string') {

                            if (w.length > 20 && lastState && Array.isArray(lastState.participants)) {
                                const found = lastState.participants.find(p => p.claimId === w || p.id === w);
                                winnerName = found ? (found.username || found.name || w) : w;
                            } else {
                                winnerName = w;
                            }
                        } else if (typeof w === 'object' && w !== null) {
                            winnerName = w.username || w.name || JSON.stringify(w);
                        }
                        if (winnerName) {
                            const li = document.createElement('li');
                            li.textContent = winnerName;
                            winnersList.appendChild(li);
                        }
                    });
                }
            }
        } catch (err) {
            console.error('[raffle-admin.js] Error in updateUI:', err, state);
        }
    }

    function fetchSettings() {
        fetch('/api/raffle/settings')
            .then(r => r.json())
            .then(updateUI)
            .catch(e => showError('Error loading giveaway configuration.'));
    }

    function saveSettings(e) {
        e.preventDefault();
        clearError();
        const commandVal = document.getElementById('raffle-command')?.value.trim() || '';
        const prizeVal = document.getElementById('raffle-prize')?.value.trim() || '';
        if (!prizeVal) {
            showError('Please enter a prize name.');
            return;
        }

        let img = imagePreview && imagePreview.src ? imagePreview.src : '';
        try {
            if (img) {
                const u = new URL(img, window.location.origin);
                if (u.pathname.startsWith('/uploads/raffle/')) {
                    img = u.pathname;
                }
            }
        } catch {}
        const data = {
            command: commandVal,
            prize: prizeVal,
            maxWinners: Number(document.getElementById('raffle-max-winners')?.value) || 1,
            enabled: enabledCheckbox?.checked || false,
            imageUrl: img
        };
        fetch('/api/raffle/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
            .then(r => r.json())
            .then(res => {
                if (res.success) {
                    fetchSettings();
                    showSaveToast(true);

                    if (typeof updateUI === 'function') {
                        updateUI({
                            ...data,
                            enabled: data.enabled,
                            active: false,
                            paused: false
                        });
                    }
                }
                else {
                    showSaveToast(false);
                    showError(res.error || 'Error saving settings.');
                }
            })
            .catch(() => {
                showSaveToast(false);
                showError('Error saving settings.');
            });
    }

    function uploadImage(e) {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('image', file);
        fetch('/api/raffle/upload-image', {
            method: 'POST',
            body: formData
        })
            .then(r => r.json())
            .then(res => {
                if (res.imageUrl && imagePreview) {
                    imagePreview.src = res.imageUrl;
                    imagePreview.style.display = '';
                } else {
                    showError(res.error || 'Error uploading image.');
                }
            })
            .catch(() => showError('Error uploading image.'));
    }

    function raffleAction(action) {
        fetch(`/api/raffle/${action}`, { method: 'POST' })
            .then(r => r.json())
            .then(res => {
                if (res.success) {

                    if (action === 'reset' && winnerBanner) {
                        winnerBanner.style.display = 'none';
                        winnerBanner.innerHTML = '';
                        if (winnersList) winnersList.innerHTML = '';
                    }
                    fetchSettings();
                }
                else showError(res.error || 'Error performing giveaway action.');
            })
            .catch(() => showError('Error performing giveaway action.'));
    }

    if (saveBtn) saveBtn.addEventListener('click', saveSettings);
    if (startBtn) startBtn.addEventListener('click', () => raffleAction('start'));
    if (stopBtn) stopBtn.addEventListener('click', () => raffleAction('stop'));
    if (pauseBtn) pauseBtn.addEventListener('click', () => raffleAction('pause'));
    if (resumeBtn) resumeBtn.addEventListener('click', () => raffleAction('resume'));
    if (drawBtn) drawBtn.addEventListener('click', () => raffleAction('draw'));
    if (resetBtn) resetBtn.addEventListener('click', () => raffleAction('reset'));
    if (imageInput) imageInput.addEventListener('change', uploadImage);

    function connectWS() {
        if (ws) ws.close();
        ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
        ws.onopen = function () {

            try { ws.send(JSON.stringify({ type: 'get_raffle_state' })); } catch {}
        };
        ws.onmessage = function (event) {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'init' && msg.raffle) {

                    updateUI(msg.raffle);
                } else if (msg.type === 'raffle_state') {

                    if (msg.reset && winnerBanner) {
                        winnerBanner.style.display = 'none';
                        winnerBanner.innerHTML = '';
                    }
                    updateUI(msg);
                } else if (msg.type === 'raffle_winner') {
                    let winnerName = msg.winner;
                    if (typeof winnerName === 'object' && winnerName !== null) {
                        winnerName = winnerName.username || winnerName.name || '';
                    }
                    if (typeof winnerName === 'string' && winnerName) {
                        winnerBanner.innerHTML = `<span style="font-size:1.5em;color:#FFD700;">🏆</span> <b>Winner!</b> <span style="color:#00ff7f;">${winnerName}</span> <span style="font-size:1.5em;">🎉</span>`;
                        winnerBanner.style.display = '';
                    }

                    fetchSettings();
                }
            } catch (e) {}
        };
        ws.onclose = function () {
            setTimeout(connectWS, 2000);
        };
    }
    connectWS();
    fetchSettings();
});
