document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/modules')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            document.getElementById('wallet-address').value = data.lastTip.walletAddress || '';
            document.getElementById('goal-amount').value = data.tipGoal.monthlyGoal || 10;
            document.getElementById('starting-amount').value = data.tipGoal.currentTips || 0;
            document.getElementById('chat-url').value = data.chat.chatUrl || '';
            document.getElementById('tts-enabled').checked = data.tipWidget?.ttsEnabled || false;
            
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
    
    document.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const module = e.currentTarget.dataset.module;
            saveSettings(module);
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
    
    function saveSettings(module) {
        let endpoint = '';
        let data = {};
        
        switch(module) {
            case 'lastTip':
                endpoint = '/api/last-tip';
                data = {
                    walletAddress: document.getElementById('wallet-address').value.trim()
                };
                break;
            case 'tipGoal':
                endpoint = '/api/tip-goal';
                data = {
                    goalAmount: parseFloat(document.getElementById('goal-amount').value),
                    startingAmount: parseFloat(document.getElementById('starting-amount').value) || 0
                };
                break;
            case 'chat':
                endpoint = '/api/chat';
                data = {
                    chatUrl: document.getElementById('chat-url').value.trim()
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
        }
        
        if ((module === 'lastTip' || module === 'chat') && !data[Object.keys(data)[0]]) {
            showAlert(`The ${Object.keys(data)[0]} is required`, 'error');
            return;
        }
        
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(async (response) => {
            const text = await response.text();
            try {
                const json = text ? JSON.parse(text) : {};
                
                if (!response.ok) {
                    throw new Error(json.error || 'Unknown error occurred');
                }
                
                showAlert('Configuration saved successfully', 'success');
                
                if (module !== 'externalNotifications') {
                    updateStatus(`${module}-status`, json.active || json.connected || false);
                }
            } catch (error) {
                showAlert(text || error.message, 'error');
                console.error('Error parsing response:', error, 'Response text:', text);
            }
        })
        .catch(error => {
            console.error('Error saving settings:', error);
            showAlert(error.message || 'Error saving configuration', 'error');
        });
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
});