document.addEventListener('DOMContentLoaded', () => {
    const goalWidget = document.getElementById('goal-widget');
    
    if (!goalWidget) {
        console.error('Goal widget container not found');
        return;
    }

    let ws;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelayBase = 1000;
    let currentData = null;
    let hasReachedGoal = false;
    let hasPlayedGoalSound = false;

    const isOBSWidget = window.location.pathname.includes('/widgets/');
    let tipGoalColors = {};
    let audioSettings = {
        audioSource: 'remote',
        hasCustomAudio: false
    };

    const REMOTE_SOUND_URL = 'https://cdn.streamlabs.com/users/80245534/library/cash-register-2.mp3';

    function playGoalSound() {
        let audioUrl;
        let logMessage;
        if (audioSettings.audioSource === 'custom' && audioSettings.hasCustomAudio) {
            audioUrl = '/api/goal-audio';
            logMessage = '🎵 Custom goal audio played';
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
                customSection.style.display = 'none';
                audioStatus.style.display = 'block';
                audioStatus.textContent = '🔊 ' + (audioSettings.hasCustomAudio ? 'Remote Audio (custom one is saved, but not active))' : 'Remote audio');
            } else if (customRadio.checked) {
                customSection.style.display = 'block';
                if (audioSettings.hasCustomAudio) {
                    audioStatus.style.display = 'block';
                    audioStatus.textContent = '🎵 Custom Audio Active';
                    if (preview) preview.style.display = 'block';
                } else {
                    audioStatus.style.display = 'block';
                    audioStatus.textContent = '⚠️ No Custom Audio Saved';
                    if (preview) preview.style.display = 'none';
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
                    preview.style.display = 'block';
                } else {
                    preview.style.display = 'none';
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
                if (preview) preview.style.display = 'none';
            });
        }

        if (remoteRadio && customRadio) {
            remoteRadio.addEventListener('change', updateAudioUI);
            customRadio.addEventListener('change', updateAudioUI);
        }

        setTimeout(updateAudioUI, 300);
    }

    async function loadAudioSettings() {
        try {
            const response = await fetch('/api/goal-audio-settings');
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
        const colors = ['#ff69b4', '#ffd700', '#ffffff', '#e81161', '#0070ff', '#00ff28'];
        for (let i = 0; i < count; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = `${Math.random() * 100}%`;
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.width = `${5 + Math.random() * 10}px`;
            confetti.style.height = `${5 + Math.random() * 10}px`;
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            const animationDuration = 2 + Math.random() * 3;
            const animationDelay = Math.random() * 2;
            confetti.style.animation = `confetti-fall ${animationDuration}s ${animationDelay}s linear forwards`;
            container.appendChild(confetti);
            setTimeout(() => {
                confetti.remove();
            }, (animationDuration + animationDelay) * 1000);
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
            particle.style.left = `${Math.random() * 100}%`;
            const duration = 1 + Math.random() * 2;
            const delay = Math.random() * 2;
            particle.style.animation = `particle-fall ${duration}s ${delay}s forwards`;
            particlesContainer.appendChild(particle);
        }
        container.appendChild(particlesContainer);
        setTimeout(() => {
            particlesContainer.remove();
        }, 5000);
    }

    async function loadInitialData() {
        await loadAudioSettings();
        
        fetch('/api/modules')
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
                    updateGoalDisplay(currentData);
                } else {
                    console.warn('No tipGoal data in initial response');
                }
            })
            .catch(error => {
                console.error('Error loading initial data:', error);
                goalWidget.innerHTML = `
                    <div class="goal-container">
                        <div class="goal-header">
                            <div class="goal-title">🎖️ Monthly tip goal</div>
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
        return {
            current,
            goal,
            progress: Math.min((current / goal) * 100, 100),
            rate,
            usdValue: (current * rate).toFixed(2),
            goalUsd: (goal * rate).toFixed(2),
            lastDonation: data.lastDonationTimestamp ?? data.lastDonation,
            bgColor: data.bgColor,
            fontColor: data.fontColor,
            borderColor: data.borderColor,
            progressColor: data.progressColor
        };
    }

    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onopen = async () => {

            await loadInitialData();
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
                    updateGoalDisplay(currentData);
                } else if (msg.type === 'init' && msg.data?.tipGoal) {
                    msg.data.tipGoal = { ...msg.data.tipGoal, ...tipGoalColors };
                    currentData = processTipData(msg.data.tipGoal);
                    hasReachedGoal = currentData.progress >= 100;
                    updateGoalDisplay(currentData);
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
        
        let customTitle = '🎖️ Monthly tip goal';
        fetch('/api/modules')
            .then(r => r.ok ? r.json() : null)
            .then(modulesData => {
                if (modulesData?.tipGoal?.title && modulesData.tipGoal.title.trim()) {
                    const titleNode = goalWidget.querySelector('.goal-title');
                    if (titleNode) titleNode.textContent = modulesData.tipGoal.title.trim();
                }
            })
            .catch(()=>{});

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
                    <div class="progress-bar" style="width: ${progressPercentage}%"></div>
                    <div class="progress-text">${progressPercentage.toFixed(1)}%</div>
                </div>
            </div>
        `;
        
        goalWidget.className = existingClasses;

        if (isOBSWidget) {
            goalWidget.style.setProperty('background', bgColor, 'important');
            goalWidget.style.setProperty('border-left', `8px solid ${borderColor}`, 'important');
            goalWidget.style.setProperty('color', fontColor, 'important');
        }

        const container = goalWidget.querySelector('.goal-container');
        if (container && isOBSWidget) {
            container.style.setProperty('background', bgColor, 'important');
            container.style.setProperty('color', fontColor, 'important');
        }
        const title = goalWidget.querySelector('.goal-title');
        if (title && isOBSWidget) {
            title.style.setProperty('color', fontColor, 'important');
        }
        const currentAr = goalWidget.querySelector('.current-ar');
        if (currentAr && isOBSWidget) {
            currentAr.style.setProperty('color', progressColor, 'important');
        }
        const goalAr = goalWidget.querySelector('.goal-ar');
        if (goalAr && isOBSWidget) {
            goalAr.style.setProperty('color', fontColor, 'important');
        }
        const usdValue = goalWidget.querySelector('.usd-value');
        if (usdValue && isOBSWidget) {
            usdValue.style.setProperty('color', fontColor, 'important');
        }
        const progressContainer = goalWidget.querySelector('.progress-container');
        if (progressContainer && isOBSWidget) {
            progressContainer.style.setProperty('background', 'rgba(35,38,47,0.31)', 'important');
        }
        const progressBar = goalWidget.querySelector('.progress-bar');
        if (progressBar && isOBSWidget) {
            if (reachedGoal) {
                progressBar.style.setProperty('background', 'linear-gradient(90deg, #1c5928, #34d755)', 'important');
            } else {
                progressBar.style.setProperty('background', progressColor, 'important');
            }
        }
        const progressText = goalWidget.querySelector('.progress-text');
        if (progressText && isOBSWidget) {
            progressText.style.setProperty('color', fontColor, 'important');
        }

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
                updateGoalDisplay(currentData);
            }
        }
    }

    setInterval(forceUpdateCelebrationState, 5000);

    const existingClasses = goalWidget.className;
    
    goalWidget.innerHTML = `
        <div class="goal-container">
            <div class="goal-header">
                <div class="goal-title">🎖️ Monthly tip goal</div>
                <div class="goal-amounts">
                    <span class="current-ar">0.00</span>
                    <span class="goal-ar">/ 0.00 AR</span>
                    <span class="usd-value">$0.00 USD</span>
                </div>
            </div>
            <div class="progress-container">
                <div class="progress-bar" style="width: 0%"></div>
                <div class="progress-text">0%</div>
            </div>
        </div>
    `;
    
    goalWidget.className = existingClasses;
});
