document.addEventListener('DOMContentLoaded', () => {
    let socialmediaConfig = [];

    const socialmediaForm = document.getElementById('socialmedia-form');
    const socialmediaList = document.getElementById('socialmedia-list');
    const saveSocialmediaBtn = document.getElementById('save-socialmedia-config');

    function renderSocialmediaList() {
        if (!socialmediaList) return;
        socialmediaList.innerHTML = '';
        socialmediaConfig.forEach((item, idx) => {
            const li = document.createElement('li');
            li.className = 'socialmedia-item';
            let iconHTML = '';
            if (item.icon === 'custom' && item.customIcon) {
                iconHTML = `<img src="${item.customIcon}" alt="Custom" style="height:24px;max-width:24px;max-height:24px;border-radius:50%;object-fit:cover;">`;
            } else {
                iconHTML = getSocialIconSVG(item.icon);
            }
            li.innerHTML = `
                <span class="icon">${iconHTML}</span>
                <span class="name">${escapeHTML(item.name)}</span>
                <button class="remove-socialmedia" data-idx="${idx}" title="Remove">×</button>
            `;
            socialmediaList.appendChild(li);
        });
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>"']/g, function(match) {
            switch (match) {
                case "&": return "&amp;";
                case "<": return "&lt;";
                case ">": return "&gt;";
                case '"': return "&quot;";
                case "'": return "&#39;";
            }
        });
    }

    function getSocialIconSVG(icon) {
        switch(icon) {
            case 'x':
            return '<svg width="32" height="32" viewBox="0 0 24 24"><rect width="24" height="24" rx="2" fill="#222"/><path fill="#fff" d="M7 7l10 10M17 7L7 17" stroke="#fff" stroke-width="2"/></svg>';
            case 'odysee':
            return `<svg width="32" height="32" viewBox="0 0 192 192"><path fill="none" stroke="#111" stroke-linecap="round" stroke-linejoin="round" stroke-width="12" d="M98.612 39.193c7.085.276 9.76 4.503 12.192 10.124 3.249 7.494.988 10.141-12.192 13.85-13.187 3.74-19.535-1.171-20.404-10.115-.976-10.115 11.684-12.729 11.684-12.729 3.495-.876 6.36-1.226 8.72-1.13zm65.362 107.42c2.54-9.665-6.121-19.201-11.2-27.806-4.998-8.467-11.972-17.925-18.629-22.87a4.832 4.832 0 0 1-.378-7.376c6.57-6.21 18.15-18.329 21.813-24.725 3.413-6.664 7.628-14.488 5.34-21.513-2.058-6.317-8.8-14.298-15.274-12.806-7.342 1.692-6.837 10.98-9.216 20.638-3.222 13.187-10.86 11.697-13.968 11.697-3.108 0-1.24-4.658-8.46-25.377-7.217-20.72-26.002-15.526-40.27-6.985-18.14 10.874-10.046 34.054-5.562 48.992-2.546 2.453-12.118 4.368-20.834 9.06-10.75 5.78-21.645 9.363-24.66 19.372-1.883 6.254.172 15.997 6.162 18.602 6.645 2.889 12.633-1.694 19.751-9.073a36.226 36.226 0 0 1 7.089-5.482 75.994 75.994 0 0 1 18.276-8.59s6.97 10.707 13.432 23.393c6.457 12.686-6.968 16.918-8.459 16.918-1.497 0-22.675-1.973-17.95 15.926 4.726 17.9 30.598 11.437 43.785 2.728 13.187-8.708 9.947-37.06 9.947-37.06 12.94-1.985 16.915 11.684 18.158 18.628 1.243 6.944 4.06 18.052 11.449 19.412 8.248 1.517 17.528-7.593 19.659-15.705z"/></svg>`;
            case 'instagram':
            return `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="28" height="28" rx="6" fill="url(#paint0_radial_87_7153)"/>
        <rect x="2" y="2" width="28" height="28" rx="6" fill="url(#paint1_radial_87_7153)"/>
        <rect x="2" y="2" width="28" height="28" rx="6" fill="url(#paint2_radial_87_7153)"/>
        <path d="M23 10.5C23 11.3284 22.3284 12 21.5 12C20.6716 12 20 11.3284 20 10.5C20 9.67157 20.6716 9 21.5 9C22.3284 9 23 9.67157 23 10.5Z" fill="white"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M16 21C18.7614 21 21 18.7614 21 16C21 13.2386 18.7614 11 16 11C13.2386 11 11 13.2386 11 16C11 18.7614 13.2386 21 16 21ZM16 19C17.6569 19 19 17.6569 19 16C19 14.3431 17.6569 13 16 13C14.3431 13 13 14.3431 13 16C13 17.6569 14.3431 19 16 19Z" fill="white"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M6 15.6C6 12.2397 6 10.5595 6.65396 9.27606C7.2292 8.14708 8.14708 7.2292 9.27606 6.65396C10.5595 6 12.2397 6 15.6 6H16.4C19.7603 6 21.4405 6 22.7239 6.65396C23.8529 7.2292 24.7708 8.14708 25.346 9.27606C26 10.5595 26 12.2397 26 15.6V16.4C26 19.7603 26 21.4405 25.346 22.7239C24.7708 23.8529 23.8529 24.7708 22.7239 25.346C21.4405 26 19.7603 26 16.4 26H15.6C12.2397 26 10.5595 26 9.27606 25.346C8.14708 24.7708 7.2292 23.8529 6.65396 22.7239C6 21.4405 6 19.7603 6 16.4V15.6ZM15.6 8H16.4C18.1132 8 19.2777 8.00156 20.1779 8.0751C21.0548 8.14674 21.5032 8.27659 21.816 8.43597C22.5686 8.81947 23.1805 9.43139 23.564 10.184C23.7234 10.4968 23.8533 10.9452 23.9249 11.8221C23.9984 12.7223 24 13.8868 24 15.6V16.4C24 18.1132 23.9984 19.2777 23.9249 20.1779C23.8533 21.0548 23.7234 21.5032 23.564 21.816C23.1805 22.5686 22.5686 23.1805 21.816 23.564C21.5032 23.7234 21.0548 23.8533 20.1779 23.9249C19.2777 23.9984 18.1132 24 16.4 24H15.6C13.8868 24 12.7223 23.9984 11.8221 23.9249C10.9452 23.8533 10.4968 23.7234 10.184 23.564C9.43139 23.1805 8.81947 22.5686 8.43597 21.816C8.27659 21.5032 8.14674 21.0548 8.0751 20.1779C8.00156 19.2777 8 18.1132 8 16.4V15.6C8 13.8868 8.00156 12.7223 8.0751 11.8221C8.14674 10.9452 8.27659 10.4968 8.43597 10.184C8.81947 9.43139 9.43139 8.81947 10.184 8.43597C10.4968 8.27659 10.9452 8.14674 11.8221 8.0751C12.7223 8.00156 13.8868 8 15.6 8Z" fill="white"/>
        <defs>
        <radialGradient id="paint0_radial_87_7153" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(12 23) rotate(-55.3758) scale(25.5196)">
        <stop stop-color="#B13589"/>
        <stop offset="0.79309" stop-color="#C62F94"/>
        <stop offset="1" stop-color="#8A3AC8"/>
        </radialGradient>
        <radialGradient id="paint1_radial_87_7153" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(11 31) rotate(-65.1363) scale(22.5942)">
        <stop stop-color="#E0E8B7"/>
        <stop offset="0.444662" stop-color="#FB8A2E"/>
        <stop offset="0.71474" stop-color="#E2425C"/>
        <stop offset="1" stop-color="#E2425C" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="paint2_radial_87_7153" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0.500002 3) rotate(-8.1301) scale(38.8909 8.31836)">
        <stop offset="0.156701" stop-color="#406ADC"/>
        <stop offset="0.467799" stop-color="#6A45BE"/>
        <stop offset="1" stop-color="#6A45BE" stop-opacity="0"/>
        </radialGradient>
        </defs>
        </svg>`;
            case 'youtube':
            return `<svg width="32" height="32" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#CE1312"/><polygon points="19,32 19,16 32,24" fill="#fff"/></svg>`;
            case 'rumble':
            return '<svg width="32" height="32" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#53C22B"/><path fill="#fff" d="M12 7l5 10H7z"/></svg>';
            case 'telegram':
            return `<svg width="32" height="32" viewBox="0 0 512 512"><rect width="512" height="512" rx="76" fill="#37aee2"/><path fill="#c8daea" d="M199 404c-11 0-10-4-13-14l-32-105 245-144"/><path fill="#a9c9dd" d="M199 404c7 0 11-4 16-8l45-43-56-34"/><path fill="#f6fbfe" d="M204 319l135 99c14 9 26 4 30-14l55-258c5-22-9-32-24-25L79 245c-21 8-21 21-4 26l83 26 190-121c9-5 17-3 11 4"/></svg>`;
            case 'discord':
            return `<svg width="48" height="48" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="24" height="24" rx="6" fill="#5865F2"/>
        <g transform="translate(7,9) scale(0.07)">
            <path d="M216.86,16.6c-16.57-7.75-34.29-13.39-52.82-16.6c-2.28,4.11-4.93,9.64-6.77,14.05c-19.69-2.96-39.2-2.96-58.53,0c-1.83-4.41-4.62-9.93-6.87-14.05C73.35,3.21,55.61,8.86,39.04,16.64C5.62,67.15-3.44,116.4,1.09,164.96c22.17,16.56,43.66,26.61,64.78,33.19c5.22-7.18,9.87-14.85,13.89-22.89c-7.63-2.9-14.94-6.48-21.85-10.63c1.83-1.36,3.62-2.76,5.39-4.24c42.12,19.7,87.89,19.7,129.51,0c1.75,1.46,3.54,2.86,5.36,4.24c-6.93,4.17-14.22,7.75-21.85,10.65c4.01,8.04,8.63,15.65,13.89,22.89c21.14-6.58,42.62-16.63,64.78-33.19C260.23,108.67,245.83,59.87,216.86,16.6zM85.47,135.09c-12.64,0-23.03-11.8-23.03-26.18c0-14.37,10.15-26.16,23.03-26.16c12.87,0,23.26,11.8,23.04,26.16C108.51,123.29,98.34,135.09,85.47,135.09zM170.53,135.09c-12.64,0-23.02-11.8-23.02-26.18c0-14.37,10.15-26.16,23.02-26.16c12.87,0,23.26,11.8,23.04,26.16C193.54,123.29,183.39,135.09,170.53,135.09z" fill="#fff"/>
        </g>
        </svg>`;
            default:
            return '';
        }
    }

    function loadSocialmediaConfig() {
        fetch('/api/socialmedia-config')
            .then(res => res.json())
            .then(data => {
                if (data.success && Array.isArray(data.config)) {
                    socialmediaConfig = data.config;
                    renderSocialmediaList();
                }
            });
    }
    
    const iconSelect = document.getElementById('socialmedia-icon');
    const customIconUpload = document.getElementById('custom-icon-upload');
    const customIconInput = document.getElementById('socialmedia-custom-icon');
    let customIconBase64 = '';

    if (iconSelect) {
        iconSelect.addEventListener('change', function() {
            if (iconSelect.value === 'custom') {
                customIconUpload.style.display = '';
            } else {
                customIconUpload.style.display = 'none';
                customIconInput.value = '';
                customIconBase64 = '';
            }
        });
    }

    if (customIconInput) {
        customIconInput.addEventListener('change', function(e) {
            if (customIconInput.files.length > 0) {
                const file = customIconInput.files[0];
                if (file.size > 102400) {
                    showAlert('Icon too large (max 100KB)', 'error');
                    customIconInput.value = '';
                    customIconBase64 = '';
                    return;
                }
                const img = new Image();
                const reader = new FileReader();
                reader.onload = function(ev) {
                    img.onload = function() {
                        if (img.width > 512 || img.height > 512) {
                            showAlert('Icon dimensions must be 512x512px or less', 'error');
                            customIconInput.value = '';
                            customIconBase64 = '';
                            return;
                        }
                        customIconBase64 = ev.target.result;
                    };
                    img.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (socialmediaForm) {
        socialmediaForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const name = document.getElementById('socialmedia-name').value.trim();
            const icon = document.getElementById('socialmedia-icon').value;
            const link = document.getElementById('socialmedia-link').value.trim();
            if (!name || !icon || !link) return;
            let customIcon = '';
            if (icon === 'custom' && customIconBase64) {
                customIcon = customIconBase64;
            }
            socialmediaConfig.push({ name, icon, link, customIcon });
            renderSocialmediaList();
            socialmediaForm.reset();
            customIconUpload.style.display = 'none';
            customIconBase64 = '';
        });
    }

    if (socialmediaList) {
        socialmediaList.addEventListener('click', function(e) {
            if (e.target.classList.contains('remove-socialmedia')) {
                const idx = parseInt(e.target.dataset.idx);
                if (!isNaN(idx)) {
                    socialmediaConfig.splice(idx, 1);
                    renderSocialmediaList();
                }
            }
        });
    }

    if (saveSocialmediaBtn) {
        saveSocialmediaBtn.addEventListener('click', function() {
            fetch('/api/socialmedia-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: socialmediaConfig })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showAlert('Social network settings saved', 'success');
                } else {
                    showAlert('Error saving settings', 'error');
                }
            });
        });
    }

    loadSocialmediaConfig();
    fetch('/api/modules')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            document.getElementById('wallet-address').value = data.lastTip.walletAddress || '';
            document.getElementById('tip-goal-wallet-address').value = data.tipGoal.walletAddress || '';
            document.getElementById('goal-amount').value = data.tipGoal.monthlyGoal || 10;
            document.getElementById('starting-amount').value = data.tipGoal.currentAmount || 0;
            
            let claimId = '';
            if (data.chat.chatUrl && data.chat.chatUrl.startsWith('wss://sockety.odysee.tv/ws/commentron?id=')) {
                claimId = data.chat.chatUrl.split('id=')[1] || '';
            } else {
                claimId = data.chat.chatUrl || '';
            }
            document.getElementById('chat-url').value = claimId;
            document.getElementById('tts-enabled').checked = data.tipWidget?.ttsEnabled || false;
            document.getElementById('tip-goal-bg-color').value = data.tipGoal.bgColor || '#080c10';
            document.getElementById('tip-goal-font-color').value = data.tipGoal.fontColor || '#ffffff';
            document.getElementById('tip-goal-border-color').value = data.tipGoal.borderColor || '#00ff7f';
            document.getElementById('tip-goal-progress-color').value = data.tipGoal.progressColor || '#00ff7f';
            
            if (data.externalNotifications && data.externalNotifications.config) {
                document.getElementById('discord-webhook').value = data.externalNotifications.config.discordWebhook || '';
                document.getElementById('telegram-bot-token').value = data.externalNotifications.config.telegramBotToken || '';
                document.getElementById('telegram-chat-id').value = data.externalNotifications.config.telegramChatId || '';
            }
            updateStatus('lastTip-status', data.lastTip.active);
            updateStatus('tipWidget-status', data.tipWidget.active);
            updateStatus('tipGoal-status', data.tipGoal.active);
            updateStatus('chat-status', data.chat.connected);
            return fetch('/api/tts-setting');
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to load TTS settings');
            return response.json();
        })
        .then(ttsSettings => {
            document.getElementById('tts-enabled').checked = ttsSettings.ttsEnabled;
        })
        .catch(error => {
            console.error('Error loading TTS settings:', error);
            document.getElementById('tts-enabled').checked = false;
        });
    
    function isValidArweaveAddress(address) {
        return /^[A-Za-z0-9-_]{43}$/.test(address);
    }

    function validateWalletInputs() {
        const walletInput = document.getElementById('wallet-address');
        const tipGoalWalletInput = document.getElementById('tip-goal-wallet-address');
        let valid = true;
        let message = '';
        if (walletInput && walletInput.value.trim() && !isValidArweaveAddress(walletInput.value.trim())) {
            valid = false;
            message = window.languageManager ? window.languageManager.getText('invalidArweaveWalletLastTip') : 'The wallet address (Last Tip) is not valid for the Arweave network.';
        }
        if (tipGoalWalletInput && tipGoalWalletInput.value.trim() && !isValidArweaveAddress(tipGoalWalletInput.value.trim())) {
            valid = false;
            message = window.languageManager ? window.languageManager.getText('invalidArweaveWalletTipGoal') : 'The wallet address (Tip Goal) is not valid for the Arweave network.';
        }
        if (!valid) {
            showAlert(message, 'error');
        }
        return valid;
    }

    document.querySelectorAll('.save-btn[data-module]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const module = e.currentTarget.dataset.module;
            if (!module) {
                showAlert('Error: Button has no data-module defined.', 'error');
                return;
            }

            if (module === 'lastTip' || module === 'tipGoal') {
                if (!validateWalletInputs()) {
                    return;
                }
            }
            await saveSettings(module);
        });
    });

    document.getElementById('tts-enabled').addEventListener('change', (e) => {
        const ttsEnabled = e.target.checked;
        
        fetch('/api/tts-setting', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ttsEnabled })
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to save TTS settings');
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showAlert('TTS setting saved successfully', 'success');
            }
        })
        .catch(error => {
            console.error('Error saving TTS settings:', error);
            showAlert('Error saving TTS setting', 'error');
            e.target.checked = !ttsEnabled;
        });
    });
    
    document.getElementById('refresh-status').addEventListener('click', () => {
        fetch('/api/modules')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                updateStatus('lastTip-status', data.lastTip.active);
                updateStatus('tipWidget-status', data.tipWidget.active);
                updateStatus('tipGoal-status', data.tipGoal.active);
                updateStatus('chat-status', data.chat.connected);
                showAlert('Updated status', 'success');
            })
            .catch(error => {
                console.error('Error refreshing status:', error);
                showAlert('Error updating status', 'error');
            });
    });
    

    async function saveSettings(module) {
        if (!module) {
            showAlert('Error: No module specified for saving.', 'error');
            return;
        }
        try {
            let endpoint = '';
            let data = {};
            
            switch(module) {
                case 'lastTip':
                    endpoint = '/api/last-tip';
                    data = {
                        walletAddress: document.getElementById('wallet-address').value.trim(),
                        bgColor: document.getElementById('last-tip-bg-color').value,
                        fontColor: document.getElementById('last-tip-font-color').value,
                        borderColor: document.getElementById('last-tip-border-color').value,
                        amountColor: document.getElementById('last-tip-amount-color').value,
                        iconColor: document.getElementById('last-tip-icon-color').value,
                        fromColor: document.getElementById('last-tip-from-color').value
                    };
                    break;
                case 'tipGoal': {
                    endpoint = '/api/tip-goal';
                    const goalAmountInput = document.getElementById('goal-amount');
                    const startingAmountInput = document.getElementById('starting-amount');
                    const goalAudioSource = document.querySelector('input[name="goal-audio-source"]:checked')?.value || 'remote';
                    if (!goalAmountInput) {
                        console.error('[tipGoal] goal-amount input not found');
                        showAlert('Goal amount field (goal-amount) does not exist.', 'error');
                        return;
                    }
                    const monthlyGoal = Number(goalAmountInput.value);
                    const currentAmount = startingAmountInput ? Number(startingAmountInput.value || '0') : 0;
                    if (isNaN(monthlyGoal) || monthlyGoal <= 0) {
                        console.error('[tipGoal] monthlyGoal invalid:', monthlyGoal);
                        showAlert('Monthly goal must be a number greater than 0.', 'error');
                        return;
                    }
                    data = {
                        walletAddress: document.getElementById('tip-goal-wallet-address').value.trim(),
                        monthlyGoal,
                        currentAmount: isNaN(currentAmount) ? 0 : currentAmount,
                        bgColor: document.getElementById('tip-goal-bg-color').value,
                        fontColor: document.getElementById('tip-goal-font-color').value,
                        borderColor: document.getElementById('tip-goal-border-color').value,
                        progressColor: document.getElementById('tip-goal-progress-color').value,
                        audioSource: goalAudioSource
                    };
                    break;
                }
                case 'chat':
                    endpoint = '/api/chat';
                    const claimId = document.getElementById('chat-url').value.trim();
                    data = {
                        chatUrl: `wss://sockety.odysee.tv/ws/commentron?id=${claimId}`,
                        bgColor: document.getElementById('chat-bg-color').value,
                        msgBgColor: document.getElementById('chat-msg-bg-color').value,
                        msgBgAltColor: document.getElementById('chat-msg-bg-alt-color').value,
                        borderColor: document.getElementById('chat-border-color').value,
                        textColor: document.getElementById('chat-text-color').value,
                        usernameColor: document.getElementById('chat-username-color').value,
                        usernameBgColor: document.getElementById('chat-username-bg-color').value,
                        donationColor: document.getElementById('chat-donation-color').value,
                        donationBgColor: document.getElementById('chat-donation-bg-color').value
                    };
                    break;
                    
                case 'externalNotifications':
                    endpoint = '/api/external-notifications';
                    data = {
                        discordWebhook: document.getElementById('discord-webhook').value.trim(),
                        telegramBotToken: document.getElementById('telegram-bot-token').value.trim(),
                        telegramChatId: document.getElementById('telegram-chat-id').value.trim(),
                        template: document.getElementById('notification-template').value.trim()
                    };
                    break;
                    
                case 'notifications':
                    await saveNotificationSettings();
                    return;
                    
                default:
                    throw new Error(`Unknown module: ${module}`);
            }
            
            if ((module === 'lastTip' || module === 'chat') && !data[Object.keys(data)[0]]) {
                throw new Error(`The ${Object.keys(data)[0]} is required`);
            }
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { error: 'Failed to save settings' };
                }
                throw new Error(errorData.error || 'Failed to save settings');
            }
            
            const result = await response.json();
            showAlert('Configuration saved successfully', 'success');
            
            if (module !== 'externalNotifications') {
                updateStatus(`${module}-status`, result.active || result.connected || false);
            }
            
        } catch (error) {
            console.error(`Error saving ${module} settings:`, error);
            showAlert(error.message || 'Error saving configuration', 'error');
        }
    }
    
    function updateStatus(elementId, isActive) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`Element with id "${elementId}" not found.`);
            return;
        }
        if (isActive) {
            element.textContent = 'Active';
            element.classList.add('active');
            element.classList.remove('inactive');
        } else {
            element.textContent = 'Inactive';
            element.classList.add('inactive');
            element.classList.remove('active');
        }
    }
    
    function showAlert(message, type) {
        const toast = document.getElementById('copy-toast');
        const icon = toast.querySelector('.copy-icon');
        const messageElement = toast.querySelector('.copy-message');
        
        messageElement.textContent = message;
        
        if (type === 'success') {
            icon.innerHTML = '<path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />';
            toast.style.borderColor = 'var(--secondary-color)';
        } else {
            icon.innerHTML = '<path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />';
            toast.style.borderColor = 'var(--error-color)';
        }
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    window.showAlert = showAlert;

    fetch('/api/tts-language')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load TTS language');
            return response.json();
        })
        .then(data => {
            document.getElementById('tts-language').value = data.ttsLanguage || 'en';
        })
        .catch(error => {
            console.error('Error loading TTS language:', error);
            document.getElementById('tts-language').value = 'en';
        });

    document.getElementById('tts-language').addEventListener('change', (e) => {
        const ttsLanguage = e.target.value;
        fetch('/api/tts-language', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ttsLanguage })
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to save TTS language');
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showAlert('TTS language saved successfully', 'success');
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        })
        .catch(error => {
            console.error('Error saving TTS language:', error);
            showAlert('Error saving TTS language', 'error');
            e.target.value = e.target.value === 'en' ? 'es' : 'en';
        });
    });

    function updateLastTipColorHex() {
        const bgColorEl = document.getElementById('last-tip-bg-color');
        const fontColorEl = document.getElementById('last-tip-font-color');
        const borderColorEl = document.getElementById('last-tip-border-color');
        const amountColorEl = document.getElementById('last-tip-amount-color');
        const iconColorEl = document.getElementById('last-tip-icon-color');
        const fromColorEl = document.getElementById('last-tip-from-color');
        
        const bgColorHexEl = document.getElementById('last-tip-bg-color-hex');
        const fontColorHexEl = document.getElementById('last-tip-font-color-hex');
        const borderColorHexEl = document.getElementById('last-tip-border-color-hex');
        const amountColorHexEl = document.getElementById('last-tip-amount-color-hex');
        const iconColorHexEl = document.getElementById('last-tip-icon-color-hex');
        const fromColorHexEl = document.getElementById('last-tip-from-color-hex');
        
        if (bgColorEl && bgColorHexEl) bgColorHexEl.textContent = bgColorEl.value;
        if (fontColorEl && fontColorHexEl) fontColorHexEl.textContent = fontColorEl.value;
        if (borderColorEl && borderColorHexEl) borderColorHexEl.textContent = borderColorEl.value;
        if (amountColorEl && amountColorHexEl) amountColorHexEl.textContent = amountColorEl.value;
        if (iconColorEl && iconColorHexEl) iconColorHexEl.textContent = iconColorEl.value;
        if (fromColorEl && fromColorHexEl) fromColorHexEl.textContent = fromColorEl.value;
    }
    
    ['last-tip-bg-color','last-tip-font-color','last-tip-border-color','last-tip-amount-color','last-tip-icon-color','last-tip-from-color'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateLastTipColorHex);
        }
    });

    if (document.getElementById('last-tip-bg-color')) {
        updateLastTipColorHex();
    }

    const resetLastTipBtn = document.getElementById('reset-last-tip-colors');
    if (resetLastTipBtn) {
        resetLastTipBtn.addEventListener('click', function() {
            document.getElementById('last-tip-bg-color').value = '#080c10';
            document.getElementById('last-tip-font-color').value = '#ffffff';
            document.getElementById('last-tip-border-color').value = '#00ff7f';
            document.getElementById('last-tip-amount-color').value = '#00ff7f';
            document.getElementById('last-tip-icon-color').value = '#ca004b';
            document.getElementById('last-tip-from-color').value = '#817ec8';
            updateLastTipColorHex();
        });
    }

    function updateTipGoalColorHex() {
        const bgColorEl = document.getElementById('tip-goal-bg-color');
        const fontColorEl = document.getElementById('tip-goal-font-color');
        const borderColorEl = document.getElementById('tip-goal-border-color');
        const progressColorEl = document.getElementById('tip-goal-progress-color');
        
        const bgColorHexEl = document.getElementById('tip-goal-bg-color-hex');
        const fontColorHexEl = document.getElementById('tip-goal-font-color-hex');
        const borderColorHexEl = document.getElementById('tip-goal-border-color-hex');
        const progressColorHexEl = document.getElementById('tip-goal-progress-color-hex');
        
        if (bgColorEl && bgColorHexEl) bgColorHexEl.textContent = bgColorEl.value;
        if (fontColorEl && fontColorHexEl) fontColorHexEl.textContent = fontColorEl.value;
        if (borderColorEl && borderColorHexEl) borderColorHexEl.textContent = borderColorEl.value;
        if (progressColorEl && progressColorHexEl) progressColorHexEl.textContent = progressColorEl.value;
    }
    
    ['tip-goal-bg-color','tip-goal-font-color','tip-goal-border-color','tip-goal-progress-color'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateTipGoalColorHex);
        }
    });

    if (document.getElementById('tip-goal-bg-color')) {
        updateTipGoalColorHex();
    }

    const resetBtn = document.getElementById('reset-tip-goal-colors');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            document.getElementById('tip-goal-bg-color').value = '#080c10';
            document.getElementById('tip-goal-font-color').value = '#ffffff';
            document.getElementById('tip-goal-border-color').value = '#00ff7f';
            document.getElementById('tip-goal-progress-color').value = '#00ff7f';
            updateTipGoalColorHex();
        });
    }

    function updateChatColorHex() {
        const chatBgColorEl = document.getElementById('chat-bg-color');
        const chatMsgBgColorEl = document.getElementById('chat-msg-bg-color');
        const chatMsgBgAltColorEl = document.getElementById('chat-msg-bg-alt-color');
        const chatBorderColorEl = document.getElementById('chat-border-color');
        const chatTextColorEl = document.getElementById('chat-text-color');
        const chatUsernameColorEl = document.getElementById('chat-username-color');
        const chatUsernameBgColorEl = document.getElementById('chat-username-bg-color');
        const chatDonationColorEl = document.getElementById('chat-donation-color');
        const chatDonationBgColorEl = document.getElementById('chat-donation-bg-color');
        
        const chatBgColorHexEl = document.getElementById('chat-bg-color-hex');
        const chatMsgBgColorHexEl = document.getElementById('chat-msg-bg-color-hex');
        const chatMsgBgAltColorHexEl = document.getElementById('chat-msg-bg-alt-color-hex');
        const chatBorderColorHexEl = document.getElementById('chat-border-color-hex');
        const chatTextColorHexEl = document.getElementById('chat-text-color-hex');
        const chatUsernameColorHexEl = document.getElementById('chat-username-color-hex');
        const chatUsernameBgColorHexEl = document.getElementById('chat-username-bg-color-hex');
        const chatDonationColorHexEl = document.getElementById('chat-donation-color-hex');
        const chatDonationBgColorHexEl = document.getElementById('chat-donation-bg-color-hex');
        
        if (chatBgColorEl && chatBgColorHexEl) chatBgColorHexEl.textContent = chatBgColorEl.value;
        if (chatMsgBgColorEl && chatMsgBgColorHexEl) chatMsgBgColorHexEl.textContent = chatMsgBgColorEl.value;
        if (chatMsgBgAltColorEl && chatMsgBgAltColorHexEl) chatMsgBgAltColorHexEl.textContent = chatMsgBgAltColorEl.value;
        if (chatBorderColorEl && chatBorderColorHexEl) chatBorderColorHexEl.textContent = chatBorderColorEl.value;
        if (chatTextColorEl && chatTextColorHexEl) chatTextColorHexEl.textContent = chatTextColorEl.value;
        if (chatUsernameColorEl && chatUsernameColorHexEl) chatUsernameColorHexEl.textContent = chatUsernameColorEl.value;
        if (chatUsernameBgColorEl && chatUsernameBgColorHexEl) chatUsernameBgColorHexEl.textContent = chatUsernameBgColorEl.value;
        if (chatDonationColorEl && chatDonationColorHexEl) chatDonationColorHexEl.textContent = chatDonationColorEl.value;
        if (chatDonationBgColorEl && chatDonationBgColorHexEl) chatDonationBgColorHexEl.textContent = chatDonationBgColorEl.value;
    }
    
    [
        'chat-bg-color','chat-msg-bg-color','chat-msg-bg-alt-color','chat-border-color','chat-text-color',
        'chat-username-color','chat-username-bg-color','chat-donation-color','chat-donation-bg-color'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateChatColorHex);
        }
    });

    if (document.getElementById('chat-bg-color')) {
        updateChatColorHex();
    }

    const resetChatBtn = document.getElementById('reset-chat-colors');
    if (resetChatBtn) {
        resetChatBtn.addEventListener('click', function() {
            document.getElementById('chat-bg-color').value = '#080c10';
            document.getElementById('chat-msg-bg-color').value = '#0a0e12';
            document.getElementById('chat-msg-bg-alt-color').value = '#0d1114';
            document.getElementById('chat-border-color').value = '#161b22';
            document.getElementById('chat-text-color').value = '#e6edf3';
            document.getElementById('chat-username-color').value = '#fff';
            document.getElementById('chat-username-bg-color').value = '#11ff79';
            document.getElementById('chat-donation-color').value = '#1bdf5f';
            document.getElementById('chat-donation-bg-color').value = '#ececec';
            updateChatColorHex();
        });
    }

    const audioRemoteRadio = document.getElementById('audio-remote');
    const audioCustomRadio = document.getElementById('audio-custom');
    const customAudioSection = document.getElementById('custom-audio-section');
    const customAudioFile = document.getElementById('custom-audio-file');
    const uploadZone = document.getElementById('upload-zone');
    const audioPreview = document.getElementById('audio-preview');
    const audioName = document.getElementById('audio-name');
    const audioSize = document.getElementById('audio-size');
    const playAudioBtn = document.getElementById('play-audio');
    const removeAudioBtn = document.getElementById('remove-audio');
    
    let currentAudioFile = null;
    let currentAudioBlob = null;

    if (audioRemoteRadio && audioCustomRadio) {
        audioRemoteRadio.addEventListener('change', function() {
            if (this.checked) {
                customAudioSection.style.display = 'none';
            }
        });

        audioCustomRadio.addEventListener('change', function() {
            if (this.checked) {
                customAudioSection.style.display = 'block';
            }
        });
    }

    function handleAudioFile(file) {
        clearAudioError();
        
        const validMimeTypes = ['audio/mpeg', 'audio/mp3'];
        const isValidMimeType = validMimeTypes.includes(file.type);
        const isValidExtension = file.name.toLowerCase().endsWith('.mp3');
        
        if (!isValidMimeType && !isValidExtension) {
            showAudioError('Only valid MP3 files are allowed');
            return;
        }
        
        if (file.size > 1048576) {
            showAudioError('The file must be less than 1MB');
            return;
        }
        
        if (file.size === 0) {
            showAudioError('The file is empty');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const arrayBuffer = e.target.result;
            const uint8Array = new Uint8Array(arrayBuffer);
            const hasID3 = uint8Array[0] === 0x49 && uint8Array[1] === 0x44 && uint8Array[2] === 0x33;
            const hasMPEGHeader = (uint8Array[0] === 0xFF && (uint8Array[1] & 0xE0) === 0xE0);
            
            if (!hasID3 && !hasMPEGHeader) {
                showAudioError('The file does not appear to be a valid MP3');
                return;
            }
            
            currentAudioFile = file;
            currentAudioBlob = URL.createObjectURL(file);
            showAudioPreview(file);
        };
        
        reader.onerror = function() {
            showAudioError('Error reading file');
        };
        
        reader.readAsArrayBuffer(file);
    }

    function showAudioPreview(file) {
        if (audioName) {
            audioName.textContent = file.name;
        }
        if (audioSize) {
            audioSize.textContent = formatFileSize(file.size);
        }
        if (uploadZone && uploadZone.parentElement) {
            uploadZone.parentElement.style.display = 'none';
        }
        if (audioPreview) {
            audioPreview.style.display = 'flex';
        }
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    if (playAudioBtn) {
        playAudioBtn.addEventListener('click', function() {
            if (currentAudioBlob) {
                try {
                    const audio = new Audio(currentAudioBlob);
                    audio.volume = 0.7;
                    
                    audio.addEventListener('loadstart', () => {});
                    audio.addEventListener('canplay', () => {});
                    audio.addEventListener('loadeddata', () => {});
                    audio.addEventListener('loadedmetadata', () => {
                    });
                    audio.addEventListener('error', (e) => {
                        console.error('Audio error event:', e);
                        console.error('Audio error details:', {
                            error: audio.error,
                            networkState: audio.networkState,
                            readyState: audio.readyState,
                            src: audio.src
                        });
                        
                        let errorMessage = 'Error loading audio file.';
                        if (audio.error) {
                            switch (audio.error.code) {
                                case MediaError.MEDIA_ERR_ABORTED:
                                    errorMessage += ' Aborted reproduction.';
                                    break;
                                case MediaError.MEDIA_ERR_NETWORK:
                                    errorMessage += ' Network error.';
                                    break;
                                case MediaError.MEDIA_ERR_DECODE:
                                    errorMessage += ' Decoding error. MP3 file may be corrupted.';
                                    break;
                                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                                    errorMessage += ' Format not supported. Use a valid MP3.';
                                    break;
                                default:
                                    errorMessage += ' Unknown error.';
                            }
                        }
                        showAlert(errorMessage, 'error');
                    });
                    
                    audio.play().then(() => {
                        
                    }).catch(e => {
                        console.error('Error playing audio:', e);
                        if (e.name === 'NotSupportedError') {
                            showAlert('Audio format not supported. Use a valid MP3 file.', 'error');
                        } else if (e.name === 'NotAllowedError') {
                            showAlert('Playback blocked by the browser. Click on the page first.', 'error');
                        } else {
                            showAlert('Audio playback error: ' + e.message, 'error');
                        }
                    });
                } catch (error) {
                    console.error('Error creating audio object:', error);
                    showAlert('Error creating audio player', 'error');
                }
            } else {
                showAlert('No audio to play', 'warning');
            }
        });
    }

    if (removeAudioBtn) {
        removeAudioBtn.addEventListener('click', function() {
            currentAudioFile = null;
            if (currentAudioBlob) {
                URL.revokeObjectURL(currentAudioBlob);
                currentAudioBlob = null;
            }
            if (customAudioFile) {
                customAudioFile.value = '';
            }
            if (uploadZone && uploadZone.parentElement) {
                uploadZone.parentElement.style.display = 'block';
            }
            if (audioPreview) {
                audioPreview.style.display = 'none';
            }
            clearAudioError();
        });
    }

    function showAudioError(message) {
        if (uploadZone && uploadZone.parentElement) {
            uploadZone.classList.add('error');
            let errorDiv = uploadZone.parentElement.querySelector('.error-message');
            if (!errorDiv) {
                errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.innerHTML = `
                    <svg viewBox="0 0 24 24">
                        <path fill="currentColor" d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
                    </svg>
                    <span></span>
                `;
                uploadZone.parentElement.appendChild(errorDiv);
            }
            errorDiv.querySelector('span').textContent = message;
        } else {
            console.error('Audio error:', message);
            showAlert(message, 'error');
        }
    }

    function clearAudioError() {
        if (uploadZone) {
            uploadZone.classList.remove('error');
            const errorDiv = uploadZone.parentElement.querySelector('.error-message');
            if (errorDiv) {
                errorDiv.remove();
            }
        }
    }

    const goalAudioRemote = document.getElementById('goal-audio-remote');
    const goalAudioCustom = document.getElementById('goal-audio-custom');
    const goalCustomAudioSection = document.getElementById('goal-custom-audio-section');
    const goalAudioPreview = document.getElementById('goal-audio-preview');
    const goalAudioFileInput = document.getElementById('goal-custom-audio-file');
    const goalPlayBtn = document.getElementById('play-goal-audio');
    const goalRemoveBtn = document.getElementById('remove-goal-audio');
    
    let currentGoalAudioFile = null;
    let currentGoalAudioBlob = null;

    function loadGoalAudioSettings() {
        fetch('/api/goal-audio-settings')
            .then(response => response.json())
            .then(data => {
                if (data.audioSource === 'custom') {
                    goalAudioCustom.checked = true;
                    goalCustomAudioSection.style.display = 'block';
                    if (data.hasCustomAudio) {
                        document.getElementById('goal-audio-name').textContent = data.audioFileName || 'custom_goal_audio.mp3';
                        document.getElementById('goal-audio-size').textContent = formatFileSize(data.audioFileSize);
                        goalAudioPreview.style.display = 'flex';
                    }
                } else {
                    goalAudioRemote.checked = true;
                    goalCustomAudioSection.style.display = 'none';
                }
            })
            .catch(error => console.error('Error loading goal audio settings:', error));
    }

    if (goalAudioRemote && goalAudioCustom) {
        goalAudioRemote.addEventListener('change', function() {
            if (this.checked) {
                goalCustomAudioSection.style.display = 'none';
            }
        });

        goalAudioCustom.addEventListener('change', function() {
            if (this.checked) {
                goalCustomAudioSection.style.display = 'block';
            }
        });
    }

    if (goalAudioFileInput) {
        goalAudioFileInput.addEventListener('change', function(e) {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                currentGoalAudioFile = file;
                currentGoalAudioBlob = URL.createObjectURL(file);
                
                document.getElementById('goal-audio-name').textContent = file.name;
                document.getElementById('goal-audio-size').textContent = formatFileSize(file.size);
                
                getAudioDuration(currentGoalAudioBlob).then(duration => {
                    document.getElementById('goal-audio-duration').textContent = formatDuration(duration);
                });
                
                goalAudioPreview.style.display = 'flex';
            }
        });
    }

    if (goalPlayBtn) {
        goalPlayBtn.addEventListener('click', function() {
            if (currentGoalAudioBlob) {
                const audio = new Audio(currentGoalAudioBlob);
                audio.volume = 0.8;
                audio.play().catch(e => console.error('Error playing audio:', e));
            } else if (goalAudioCustom.checked) {
                const audio = new Audio('/api/goal-custom-audio');
                audio.volume = 0.8;
                audio.play().catch(e => console.error('Error playing audio:', e));
            }
        });
    }

    if (goalRemoveBtn) {
        goalRemoveBtn.addEventListener('click', function() {
            goalAudioFileInput.value = '';
            currentGoalAudioFile = null;
            if (currentGoalAudioBlob) {
                URL.revokeObjectURL(currentGoalAudioBlob);
                currentGoalAudioBlob = null;
            }
            goalAudioPreview.style.display = 'none';
            
            fetch('/api/goal-audio-settings', {
                method: 'DELETE'
            }).catch(e => console.error('Error deleting audio:', e));
        });
    }

    function formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function getAudioDuration(url) {
        return new Promise(resolve => {
            const audio = new Audio();
            audio.src = url;
            audio.onloadedmetadata = () => {
                resolve(audio.duration);
            };
            audio.onerror = () => {
                resolve(0);
            };
        });
    }

    document.addEventListener('DOMContentLoaded', loadGoalAudioSettings);

    async function loadAudioSettings() {
        try {
            const response = await fetch('/api/audio-settings');
            if (response.ok) {
                const data = await response.json();
                if (data.audioSource === 'custom') {
                    if (audioCustomRadio) {
                        audioCustomRadio.checked = true;
                    }
                    if (customAudioSection) {
                        customAudioSection.style.display = 'block';
                    }
                    if (data.hasCustomAudio) {
                        showSavedAudioInfo(data.audioFileName, data.audioFileSize);
                    }
                } else {
                    if (audioRemoteRadio) {
                        audioRemoteRadio.checked = true;
                    }
                    if (customAudioSection) {
                        customAudioSection.style.display = 'none';
                    }
                }
            }
        } catch (error) {
            console.error('Error loading audio settings:', error);
        }
    }

    function showSavedAudioInfo(fileName, fileSize) {
        if (audioName) {
            audioName.textContent = fileName || 'Customized audio';
        }
        if (audioSize) {
            audioSize.textContent = formatFileSize(fileSize || 0);
        }
        if (uploadZone && uploadZone.parentElement) {
            uploadZone.parentElement.style.display = 'none';
        }
        if (audioPreview) {
            audioPreview.style.display = 'flex';
        }
        if (playAudioBtn) {
            playAudioBtn.style.display = 'none';
        }
    }

    function saveNotificationSettings() {
        const audioSource = document.querySelector('input[name="audio-source"]:checked')?.value || 'remote';
        
        const formData = new FormData();
        formData.append('audioSource', audioSource);
        
        if (audioSource === 'custom' && currentAudioFile) {
            formData.append('audioFile', currentAudioFile);
            
        }
        
        const apiUrl = window.location.origin + '/api/audio-settings';
        
        fetch(apiUrl, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    console.error('Server error response:', text);
                    throw new Error(`Server error: ${response.status} - ${text}`);
                });
            }
            return response.text().then(text => {
                try {
                    const parsed = JSON.parse(text);
                    return parsed;
                } catch (e) {
                    console.error('Invalid JSON response:', text);
                    console.error('JSON parse error:', e);
                    throw new Error('Invalid JSON response from server');
                }
            });
        })
        .then(data => {
            if (data.success) {
                showAlert('Audio configuration successfully saved', 'success');
                if (audioSource === 'custom' && currentAudioFile) {
                    showSavedAudioInfo(currentAudioFile.name, currentAudioFile.size);
                    currentAudioFile = null;
                }
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        })
        .catch(error => {
            console.error('Error saving audio settings:', error);
            showAlert('Error saving audio configuration', 'error');
        });
    }

    window.saveNotificationSettings = saveNotificationSettings;

    if (uploadZone) {
        uploadZone.addEventListener('click', function() {
            customAudioFile.click();
        });

        uploadZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleAudioFile(files[0]);
            }
        });
    }

    if (customAudioFile) {
        customAudioFile.addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                handleAudioFile(e.target.files[0]);
            }
        });
    }

    if (audioCustomRadio) {
        audioCustomRadio.addEventListener('change', function() {
            if (this.checked) {
                customAudioSection.style.display = 'block';
            }
        });
    }

    document.addEventListener('DOMContentLoaded', loadAudioSettings);
});

function loadObsWsConfig() {
    fetch('/api/obs-ws-config')
        .then(res => res.json())
        .then(cfg => {
            if (cfg) {
                document.getElementById('obs-ws-ip').value = cfg.ip || '';
                document.getElementById('obs-ws-port').value = cfg.port || '';
                document.getElementById('obs-ws-password').value = cfg.password || '';
            }
        });
}

const saveObsWsBtn = document.getElementById('save-obs-ws-settings');
if (saveObsWsBtn) {
    saveObsWsBtn.addEventListener('click', function() {
        const config = {
            ip: document.getElementById('obs-ws-ip').value,
            port: document.getElementById('obs-ws-port').value,
            password: document.getElementById('obs-ws-password').value
        };
        fetch('/api/obs-ws-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        }).then(res => {
            if (res.ok) {
                showAlert('OBS WebSocket settings saved', 'success');
            } else {
                showAlert('Error saving OBS WebSocket settings', 'error');
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', loadObsWsConfig);

document.addEventListener('DOMContentLoaded', function() {
    
    fetch('/config/liveviews-config.json')
        .then(res => res.json())
        .then(cfg => {
            if (cfg) {
                if (document.getElementById('liveviews-claimid')) document.getElementById('liveviews-claimid').value = cfg.claimid || '';
                if (document.getElementById('liveviews-bg-color')) document.getElementById('liveviews-bg-color').value = cfg.bg || '#ffffff';
                if (document.getElementById('liveviews-font-color')) document.getElementById('liveviews-font-color').value = cfg.color || '#222222';
                if (document.getElementById('liveviews-font-family')) document.getElementById('liveviews-font-family').value = cfg.font || 'Arial';
                if (document.getElementById('liveviews-size')) document.getElementById('liveviews-size').value = cfg.size || 32;
                
                const iconPreview = document.getElementById('liveviews-icon-preview');
                if (iconPreview) {
                    iconPreview.innerHTML = '';
                    if (cfg.icon && cfg.icon.startsWith('data:image')) {
                        const img = document.createElement('img');
                        img.src = cfg.icon;
                        img.alt = 'Liveviews Icon';
                        img.style.maxHeight = '48px';
                        img.style.maxWidth = '48px';
                        img.style.borderRadius = '8px';
                        iconPreview.appendChild(img);
                    }
                }
            }
        });

    const liveviewsIconInput = document.getElementById('liveviews-icon');
    if (liveviewsIconInput) {
        liveviewsIconInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const iconPreview = document.getElementById('liveviews-icon-preview');
            if (file && iconPreview) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    iconPreview.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = ev.target.result;
                    img.alt = 'Liveviews Icon';
                    img.style.maxHeight = '48px';
                    img.style.maxWidth = '48px';
                    img.style.borderRadius = '8px';
                    iconPreview.appendChild(img);
                };
                reader.readAsDataURL(file);
            } else if (iconPreview) {
                iconPreview.innerHTML = '';
            }
        });
    }
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const tabs = document.querySelectorAll('.admin-tab');
    sidebarLinks.forEach(btn => {
        btn.addEventListener('click', function() {
            sidebarLinks.forEach(l => l.classList.remove('active'));
            tabs.forEach(tab => tab.classList.remove('active'));
            btn.classList.add('active');
            let tabId = btn.getAttribute('data-tab');

            if (!tabId && btn.id === 'liveviews-link') {
                tabId = 'liveviews';
            }
            const tabSection = document.getElementById(tabId + '-tab');
            if (tabSection) tabSection.classList.add('active');
        });
    });

    const raffleWidgetUrl = document.getElementById('raffle-widget-url');
    if (raffleWidgetUrl) {
        raffleWidgetUrl.value = window.location.origin + '/widgets/giveaway.html';
    }

    const lastTipWidgetUrl = document.getElementById('last-tip-url');
    if (lastTipWidgetUrl) {
        lastTipWidgetUrl.value = window.location.origin + '/widgets/last-tip.html';
    }

    const tipGoalWidgetUrl = document.getElementById('tip-goal-url');
    if (tipGoalWidgetUrl) {
        tipGoalWidgetUrl.value = window.location.origin + '/widgets/tip-goal.html';
    }

    const tipNotificationUrl = document.getElementById('tip-notification-url');
    if (tipNotificationUrl) {
        tipNotificationUrl.value = window.location.origin + '/widgets/tip-notification.html';
    }

    const obsChatUrl = document.getElementById('obs-chat-url');
    if (obsChatUrl) {
        obsChatUrl.value = window.location.origin + '/widgets/chat.html';
    }

    const obsChatHorizontalUrl = document.getElementById('obs-chat-horizontal-url');
    if (obsChatHorizontalUrl) {
        obsChatHorizontalUrl.value = window.location.origin + '/widgets/chat.html?horizontal=1';
    }

    const liveviewsWidgetUrl = document.getElementById('liveviews-widget-url');
    if (liveviewsWidgetUrl) {
        liveviewsWidgetUrl.value = window.location.origin + '/widgets/liveviews.html';
    }

    const liveviewsSaveBtn = document.getElementById('liveviews-save');
    if (liveviewsSaveBtn) {
        liveviewsSaveBtn.addEventListener('click', function() {
            const iconImg = document.getElementById('liveviews-icon-preview').querySelector('img');
            const config = {
                claimid: document.getElementById('liveviews-claimid').value,
                bg: document.getElementById('liveviews-bg-color').value,
                color: document.getElementById('liveviews-font-color').value,
                font: document.getElementById('liveviews-font-family').value,
                size: parseInt(document.getElementById('liveviews-size').value) || 32,
                icon: iconImg ? iconImg.src : ''
            };
            fetch('/config/liveviews-config.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            }).then(res => {
                if (res.ok) {
                    showUnifiedSaveToast(true);
                } else {
                    showUnifiedSaveToast(false);
                }
            });
        });
    }

    function showUnifiedSaveToast(success = true) {
        let toast = document.getElementById('copy-toast');
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

    const lastTipStatus = document.getElementById('lastTip-status');
    const tipWidgetStatus = document.getElementById('tipWidget-status');
    const tipGoalStatus = document.getElementById('tipGoal-status');
    const chatStatus = document.getElementById('chat-status');

    function updateStatus() {
        fetch('/api/status')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    lastTipStatus.textContent = data.lastTip;
                    tipWidgetStatus.textContent = data.tipWidget;
                    tipGoalStatus.textContent = data.tipGoal;
                    chatStatus.textContent = data.chat;
                } else {
                    console.error('Error fetching status:', data.message);
                }
            })
            .catch(error => console.error('Error fetching status:', error));
    }

    updateStatus();
    setInterval(updateStatus, 30000);

    window.copyToClipboard = function(elementId) {
        const text = document.getElementById(elementId).value;
        navigator.clipboard.writeText(text).then(() => {
            showCopyToast();
        }).catch(err => {
            console.error('Failed to copy:', err);
            showCopyToast(false);
        });
    }

    window.showCopyToast = function(success = true) {
        const toast = document.getElementById('copy-toast');
        const icon = toast.querySelector('.copy-icon');
        const message = toast.querySelector('.copy-message');
        
        if (success) {
            icon.innerHTML = '<path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />';
            message.textContent = window.languageManager ? window.languageManager.getText('urlCopied') : 'URL copied to clipboard!';
            toast.style.borderColor = 'var(--secondary-color)';
        } else {
            icon.innerHTML = '<path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />';
            message.textContent = window.languageManager ? window.languageManager.getText('failedToCopy') : 'Failed to copy!';
            toast.style.borderColor = 'var(--error-color)';
        }
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    const userMenuButton = document.getElementById('user-menu-button');
    const userMenu = document.getElementById('user-menu');
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.toggle('dark', savedTheme === 'dark');
    
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            const isDark = document.body.classList.contains('dark');
            document.body.classList.toggle('dark', !isDark);
            localStorage.setItem('theme', isDark ? 'light' : 'dark');
        });
    }
    
    if (userMenuButton && userMenu) {
        userMenuButton.addEventListener('click', function(e) {
            e.stopPropagation();
            userMenu.classList.toggle('opacity-0');
            userMenu.classList.toggle('invisible');
        });
        
        document.addEventListener('click', function(e) {
            if (!userMenu.contains(e.target) && !userMenuButton.contains(e.target)) {
                userMenu.classList.add('opacity-0', 'invisible');
            }
        });
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                userMenu.classList.add('opacity-0', 'invisible');
            }
        });
    }
});
