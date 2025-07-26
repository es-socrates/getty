document.addEventListener('DOMContentLoaded', function () {
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
    // console.log('raffle-admin.js loaded');
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
    const statusText = document.getElementById('raffle-status');
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

    function updateUI(state) {
        if (timerInterval) clearInterval(timerInterval);
        timerBox.style.display = 'none';
        try {
            // console.log('[raffle-admin.js] updateUI state:', state);
            if (!state || typeof state !== 'object') return;
            lastState = state;
            if (statusText) {
                statusText.textContent = state.active
                    ? (state.paused ? 'Pausado' : 'Activo')
                    : 'Inactivo';
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
                        } else if (typeof p === 'string') {

                            username = (p.length > 20) ? '' : p;
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
        const data = {
            command: document.getElementById('raffle-command')?.value.trim() || '',
            prize: document.getElementById('raffle-prize')?.value.trim() || '',
            maxWinners: Number(document.getElementById('raffle-max-winners')?.value) || 1,
            enabled: enabledCheckbox?.checked || false,
            imageUrl: imagePreview && imagePreview.src ? imagePreview.src : ''
        };
        fetch('/api/raffle/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
            .then(r => r.json())
            .then(res => {
                if (res.success) fetchSettings();
                else showError(res.error || 'Error saving settings.');
            })
            .catch(() => showError('Error saving settings.'));
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
                if (res.success) fetchSettings();
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
        ws.onmessage = function (event) {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'raffle_state') {
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
