document.addEventListener('DOMContentLoaded', () => {
    const goalWidget = document.getElementById('goal-widget');
    const ws = new WebSocket(`ws://${window.location.host}`);
    let currentData = null;

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
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                if (data.tipGoal) {
                    currentData = {
                        current: data.tipGoal.currentTips,
                        goal: data.tipGoal.monthlyGoal,
                        progress: Math.min((data.tipGoal.currentTips / data.tipGoal.monthlyGoal) * 100, 100),
                        rate: data.tipGoal.exchangeRate,
                        usdValue: (data.tipGoal.currentTips * data.tipGoal.exchangeRate).toFixed(2),
                        goalUsd: (data.tipGoal.monthlyGoal * data.tipGoal.exchangeRate).toFixed(2)
                    };
                    updateGoalDisplay(currentData);
                }
            })
            .catch(error => console.error('Error loading initial data:', error));
    }

    ws.onopen = () => {
        console.log('✅ Connected to the tip goal server');
        loadInitialData();
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'goalUpdate' || msg.type === 'tipGoalUpdate') {
                currentData = msg.data;
                updateGoalDisplay(currentData);
            } else if (msg.type === 'init' && msg.data?.tipGoal) {
                currentData = msg.data.tipGoal;
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
    };

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
        
        createConfetti(goalWidget, reachedGoal ? 100 : 15);
        
        if (reachedGoal && !wasCelebrating) {
            goalWidget.classList.add('celebrating');
            createParticles(goalWidget, 30);
            const progressBar = goalWidget.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.background = 'linear-gradient(90deg, #FFD700, #FFEC8B)';
            }
            const pulseAnimation = `
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgb(213, 9, 82); }
                    70% { box-shadow: 0 0 0 5px rgba(255, 215, 0, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); }
                }
            `;
            const style = document.createElement('style');
            style.innerHTML = pulseAnimation;
            document.head.appendChild(style);
            goalWidget.style.animation = 'pulse 2s infinite';
        } else if (!reachedGoal && wasCelebrating) {
            goalWidget.classList.remove('celebrating');
            goalWidget.style.animation = '';
        }
    }

    loadInitialData();
});