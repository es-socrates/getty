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
            document.getElementById('starting-amount').value = data.tipGoal.currentAmount || 0;
            document.getElementById('chat-url').value = data.chat.chatUrl || '';
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
    
    document.querySelectorAll('.save-btn[data-module]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const module = e.currentTarget.dataset.module;
            if (!module) {
                showAlert('Error: Button has no data-module defined.', 'error');
                return;
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
                    data = {
                        chatUrl: document.getElementById('chat-url').value.trim(),
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