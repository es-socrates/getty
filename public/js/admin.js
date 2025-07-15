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
            
            updateStatus('last-tip-status', data.lastTip.active);
            updateStatus('tip-widget-status', data.tipWidget.active);
            updateStatus('tip-goal-status', data.tipGoal.active);
            updateStatus('chat-status', data.chat.connected);
        })
        .catch(error => {
            console.error('Error loading settings:', error);
            showAlert('Error al cargar la configuración', 'error');
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
                showAlert('Estado actualizado', 'success');
            })
            .catch(error => {
                console.error('Error refreshing status:', error);
                showAlert('Error al actualizar el estado', 'error');
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
        }
        
        if (module === 'lastTip' && !data.walletAddress) {
            showAlert('La dirección de wallet es requerida', 'error');
            return;
        }
        
        if (module === 'chat' && !data.chatUrl) {
            showAlert('La URL del chat es requerida', 'error');
            return;
        }
        
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {
            showAlert('Configuración guardada exitosamente', 'success');
            updateStatus(`${module}-status`, data.active || data.connected);
        })
        .catch(error => {
            console.error('Error saving settings:', error);
            const message = error.error || 'Error al guardar la configuración';
            showAlert(message, 'error');
        });
    }
    
    function updateStatus(elementId, isActive) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`Elemento con id "${elementId}" no encontrado.`);
            return;
        }
        if (isActive) {
            element.textContent = 'Activo';
            element.classList.add('active');
            element.classList.remove('inactive');
        } else {
            element.textContent = 'Inactivo';
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