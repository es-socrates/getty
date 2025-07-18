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
            
            if (data.externalNotifications && data.externalNotifications.config) {
                document.getElementById('discord-webhook').value = data.externalNotifications.config.discordWebhook || '';
                document.getElementById('telegram-bot-token').value = data.externalNotifications.config.telegramBotToken || '';
                document.getElementById('telegram-chat-id').value = data.externalNotifications.config.telegramChatId || '';
            }
            updateStatus('last-tip-status', data.lastTip.active);
            updateStatus('tip-widget-status', data.tipWidget.active);
            updateStatus('tip-goal-status', data.tipGoal.active);
            updateStatus('chat-status', data.chat.connected);
        })
        .catch(error => {
            console.error('Error loading settings:', error);
            showAlert('Error loading configuration', 'error');
        });
    
    document.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const module = e.target.dataset.module;
            saveSettings(module);
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
                updateStatus('last-tip-status', data.lastTip.active);
                updateStatus('tip-widget-status', data.tipWidget.active);
                updateStatus('tip-goal-status', data.tipGoal.active);
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
                
                if (module === 'externalNotifications') {
                    updateStatus('external-notifications-status', json.status?.active || false);
                } else {
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
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 3000);
    }
});