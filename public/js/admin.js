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
                    walletAddress: document.getElementById('wallet-address').value.trim(),
                    bgColor: document.getElementById('last-tip-bg-color').value,
                    fontColor: document.getElementById('last-tip-font-color').value,
                    borderColor: document.getElementById('last-tip-border-color').value,
                    amountColor: document.getElementById('last-tip-amount-color').value,
                    iconColor: document.getElementById('last-tip-icon-color').value,
                    fromColor: document.getElementById('last-tip-from-color').value
                };
                break;
            case 'tipGoal':
                endpoint = '/api/tip-goal';
                data = {
                    goalAmount: parseFloat(document.getElementById('goal-amount').value),
                    startingAmount: parseFloat(document.getElementById('starting-amount').value) || 0,
                    bgColor: document.getElementById('tip-goal-bg-color').value,
                    fontColor: document.getElementById('tip-goal-font-color').value,
                    borderColor: document.getElementById('tip-goal-border-color').value,
                    progressColor: document.getElementById('tip-goal-progress-color').value
                };
                break;
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
                saveNotificationSettings();
                return;
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
            document.getElementById('last-tip-from-color').value = '#e9e9e9';
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

function handleAudioFile(file) {
    clearAudioError();
    
    const validMimeTypes = ['audio/mpeg', 'audio/mp3'];
    const isValidMimeType = validMimeTypes.includes(file.type);
    const isValidExtension = file.name.toLowerCase().endsWith('.mp3');
    
    console.log('File validation:', {
        name: file.name,
        type: file.type,
        size: file.size,
        isValidMimeType,
        isValidExtension
    });
    
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
        
        console.log('File header validation:', {
            hasID3,
            hasMPEGHeader,
            firstBytes: Array.from(uint8Array.slice(0, 10)).map(b => '0x' + b.toString(16).padStart(2, '0'))
        });
        
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
                    
                    audio.addEventListener('loadstart', () => console.log('Audio loading started'));
                    audio.addEventListener('canplay', () => console.log('Audio can play'));
                    audio.addEventListener('loadeddata', () => console.log('Audio data loaded'));
                    audio.addEventListener('loadedmetadata', () => {
                        console.log('Audio metadata loaded - Duration:', audio.duration, 'seconds');
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
                        console.log('Audio playing successfully');
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

    window.saveNotificationSettings = function() {
        const audioSource = document.querySelector('input[name="audio-source"]:checked')?.value || 'remote';
        console.log('Saving audio settings with source:', audioSource);
        
        const formData = new FormData();
        formData.append('audioSource', audioSource);
        
        if (audioSource === 'custom' && currentAudioFile) {
            formData.append('audioFile', currentAudioFile);
            console.log('Uploading file:', currentAudioFile.name, 'Size:', currentAudioFile.size);
        }
        
        console.log('Sending request to /api/audio-settings');
        console.log('Current URL:', window.location.href);
        console.log('Base URL:', window.location.origin);
        
        const apiUrl = window.location.origin + '/api/audio-settings';
        console.log('API URL:', apiUrl);
        
        fetch(apiUrl, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);
            
            if (!response.ok) {
                return response.text().then(text => {
                    console.error('Server error response:', text);
                    throw new Error(`Server error: ${response.status} - ${text}`);
                });
            }
            return response.text().then(text => {
                console.log('Raw response text:', text);
                try {
                    const parsed = JSON.parse(text);
                    console.log('Parsed JSON:', parsed);
                    return parsed;
                } catch (e) {
                    console.error('Invalid JSON response:', text);
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
    };

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

    loadAudioSettings();

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
        console.log('Saving audio settings with source:', audioSource);
        
        const formData = new FormData();
        formData.append('audioSource', audioSource);
        
        if (audioSource === 'custom' && currentAudioFile) {
            formData.append('audioFile', currentAudioFile);
            console.log('Uploading file:', currentAudioFile.name, 'Size:', currentAudioFile.size);
        }
        
        console.log('Sending request to /api/audio-settings');
        console.log('Current URL:', window.location.href);
        console.log('Base URL:', window.location.origin);
        
        const apiUrl = window.location.origin + '/api/audio-settings';
        console.log('API URL:', apiUrl);
        
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
    };

    window.saveNotificationSettings = saveNotificationSettings;
});

const originalSaveSettings = saveSettings;
function saveSettings(module) {
    if (module === 'notifications') {
        if (window.saveNotificationSettings) {
            window.saveNotificationSettings();
        } else {
            console.error('saveNotificationSettings function not available');
        }
        return;
    }
    originalSaveSettings(module);
}