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

    function resetCelebrationState() {
        try {
            localStorage.removeItem('tipGoalCelebration');
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

    function loadInitialData() {
        fetch('/api/modules')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (data.tipGoal) {
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
                            <div class="goal-title">🎯 Monthly tip goal</div>
                            <div class="error-message">Failed to load data</div>
                        </div>
                    </div>
                `;
            });
    }

    function processTipData(data) {
        return {
            current: data.currentTips || data.current || 0,
            goal: data.monthlyGoal || data.goal || 10,
            progress: Math.min(((data.currentTips || data.current || 0) / (data.monthlyGoal || data.goal || 10)) * 100, 100),
            rate: data.exchangeRate || data.rate || 0,
            usdValue: ((data.currentTips || data.current || 0) * (data.exchangeRate || data.rate || 0)).toFixed(2),
            goalUsd: ((data.monthlyGoal || data.goal || 10) * (data.exchangeRate || data.rate || 0)).toFixed(2),
            lastDonation: data.lastDonationTimestamp || data.lastDonation
        };
    }

    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onopen = () => {
            console.log('✅ Connected to the tip goal server');
            reconnectAttempts = 0;
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                console.debug('WebSocket message received:', msg);

                if (msg.type === 'goalUpdate' || msg.type === 'tipGoalUpdate') {
                    const previousProgress = currentData ? currentData.progress : 0;
                    currentData = processTipData(msg.data);
                    const newProgress = currentData.progress;
                    
                    if (newProgress >= 100 && previousProgress < 100) {
                        hasReachedGoal = true;
                    } else if (newProgress < 100 && previousProgress >= 100) {
                        hasReachedGoal = false;
                        resetCelebrationState();
                    } else {
                        hasReachedGoal = newProgress >= 100;
                    }
                    
                    updateGoalDisplay(currentData);
                } else if (msg.type === 'init' && msg.data?.tipGoal) {
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
            console.log('WebSocket connection closed');
            if (reconnectAttempts < maxReconnectAttempts) {
                const delay = Math.min(reconnectDelayBase * Math.pow(2, reconnectAttempts), 15000);
                console.log(`Reconnecting in ${delay/1000} seconds... (attempt ${reconnectAttempts + 1})`);
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

        const progressPercentage = data.progress || 0;
        const currentUSD = data.usdValue || "0.00";
        const goalUSD = data.goalUsd || "0.00";
        const currentAR = data.current ? data.current.toFixed(2) : "0.00";
        const goalAR = data.goal || 10;
        const wasCelebrating = goalWidget.classList.contains('celebrating');
        const reachedGoal = progressPercentage >= 100;
        
        hasReachedGoal = reachedGoal;
        
        const existingClasses = goalWidget.className;
        
        goalWidget.innerHTML = `
            <div class="goal-container">
                <div class="goal-header">
                    <div class="goal-title">🎯 Monthly tip goal</div>
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
        
        if (reachedGoal) {
            const progressBar = goalWidget.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.background = 'linear-gradient(90deg, #1c5928, #34d755)';
            }
        }
        
        if (reachedGoal) {
            if (!wasCelebrating) {
                createConfetti(goalWidget, 100);
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
    
    const isOBSWidget = window.location.pathname.includes('/widgets/');
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
                <div class="goal-title">🎯 Monthly tip goal</div>
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