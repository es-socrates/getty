document.addEventListener('DOMContentLoaded', async () => {
    const chatContainer = document.getElementById('chat-container');
    let messageCount = 0;
    let isAutoScroll = true;

    let EMOJI_MAPPING = {};
    try {
        const response = await fetch(`/emojis.json?nocache=${Date.now()}`);
        EMOJI_MAPPING = await response.json();
    } catch (e) {
        console.error('Error loading emojis:', e);
    }

    const ws = new WebSocket(`ws://${window.location.host}`);
    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'chatMessage' && msg.data) addMessage(msg.data);
            else if (msg.type === 'chat') addMessage(msg);
            else if (msg.type === 'init' && msg.data?.chatHistory) {
                msg.data.chatHistory.forEach(m => addMessage(m));
            } else if (msg.type === 'batch' && Array.isArray(msg.messages)) {
                msg.messages.forEach(m => addMessage(m));
            }
        } catch (e) {
            console.error('Error processing message:', e);
        }
    };

    const CYBERPUNK_PALETTE = [
        { bg: 'rgba(17, 255, 121, 0.8)', text: '#000', border: 'rgba(17, 255, 121, 0.9)' },
        { bg: 'rgba(255, 17, 121, 0.8)', text: '#fff', border: 'rgba(255, 17, 121, 0.9)' },
        { bg: 'rgba(121, 17, 255, 0.8)', text: '#fff', border: 'rgba(121, 17, 255, 0.9)' },
        { bg: 'rgba(17, 121, 255, 0.8)', text: '#fff', border: 'rgba(17, 121, 255, 0.9)' },
        { bg: 'rgba(255, 231, 17, 0.8)', text: '#000', border: 'rgba(255, 231, 17, 0.9)' },
        { bg: 'rgba(21, 25, 40, 0.93)', text: '#fff', border: 'rgba(19, 19, 19, 0.9)' }
    ];

    function getCyberpunkStyle(username) {
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % CYBERPUNK_PALETTE.length;
        return CYBERPUNK_PALETTE[index];
    }

    const isOBSWidget = window.location.pathname.includes('/widgets/');
    let chatColors = {};

    async function loadColors() {
        if (!isOBSWidget) return;
        try {
            const res = await fetch('/api/modules');
            const data = await res.json();
            if (data.chat) {
                chatColors = {
                    bgColor: data.chat.bgColor,
                    msgBgColor: data.chat.msgBgColor,
                    msgBgAltColor: data.chat.msgBgAltColor,
                    borderColor: data.chat.borderColor,
                    textColor: data.chat.textColor,
                    usernameColor: data.chat.usernameColor,
                    usernameBgColor: data.chat.usernameBgColor,
                    donationColor: data.chat.donationColor,
                    donationBgColor: data.chat.donationBgColor
                };
            }
        } catch (e) { /* ignore */ }
    }

    function setIfCustom(element, property, value, defaultValue) {
        if (!element) return;
        if (value && value !== defaultValue) {
            element.style.setProperty(property, value, 'important');
        } else {
            element.style.removeProperty(property);
        }
    }

    const originalAddMessage = addMessage;
    addMessage = function(msg) {
        originalAddMessage(msg);
        if (!isOBSWidget) return;
        const messages = chatContainer.querySelectorAll('.message');
        messages.forEach((messageEl, idx) => {

            if (messageEl.classList.contains('has-donation')) {
                setIfCustom(messageEl, 'background', chatColors.donationBgColor, '#ececec');
            } else if (messageEl.classList.contains('odd')) {
                setIfCustom(messageEl, 'background', chatColors.msgBgAltColor, '#0d1114');
            } else {
                setIfCustom(messageEl, 'background', chatColors.msgBgColor, '#0a0e12');
            }
            setIfCustom(messageEl, 'border-left', `8px solid ${chatColors.borderColor}`, '8px solid #161b22');
            setIfCustom(messageEl, 'color', chatColors.textColor, '#e6edf3');

            const donation = messageEl.querySelector('.message-donation');
            setIfCustom(donation, 'color', chatColors.donationColor, '#1bdf5f');
            setIfCustom(donation, 'background', chatColors.donationBgColor, '#ececec');

            const text = messageEl.querySelector('.message-text-inline');
            setIfCustom(text, 'color', chatColors.textColor, '#e6edf3');
        });
    };

    async function applyChatColors() {
        if (!isOBSWidget) return;
        await loadColors();
        setIfCustom(chatContainer, 'background', chatColors.bgColor, '#080c10');
    }

    applyChatColors();

    function addMessage(msg) {
        const messageEl = document.createElement('div');
        messageEl.classList.add('message');
        if (messageCount++ % 2) messageEl.classList.add('odd');

        const header = document.createElement('div');
        header.className = 'message-header';

        if (msg.avatar) {
            const avatar = document.createElement('div');
            avatar.className = 'message-avatar';
            const img = document.createElement('img');
            img.src = msg.avatar;
            img.alt = msg.channelTitle || 'Anonymous';
            img.onerror = () => avatar.style.display = 'none';
            avatar.appendChild(img);
            header.appendChild(avatar);
        }

        const userContainer = document.createElement('div');
        userContainer.className = 'message-user-container';

        const username = (msg.channelTitle || 'Anonymous');
        const displayUsername = username.length > 12 ? username.slice(0, 12) + '…' : username;
        const style = getCyberpunkStyle(username);

        const usernameElement = document.createElement('span');
        usernameElement.className = 'message-username cyberpunk';
        usernameElement.textContent = displayUsername + '';

        const membershipIcons = [
            'crown', 'star', 'diamond', 'heart', 'rocket',
            'moon', 'fire', 'ghost', 'alien', 'dragon'
        ];
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        const iconIndex = Math.abs(hash) % membershipIcons.length;
        const iconType = membershipIcons[iconIndex];
        const iconElement = document.createElement('span');
        iconElement.className = `membership-icon ${iconType}`;
        usernameElement.insertBefore(iconElement, usernameElement.firstChild);

        usernameElement.style.backgroundColor = style.bg;
        usernameElement.style.color = style.text;
        usernameElement.style.textShadow = `0 0 8px ${style.border}`;
        // usernameElement.style.border = `1px solid ${style.border}`;
        usernameElement.style.padding = '0px 4px';
        usernameElement.style.borderRadius = '4px';
        // usernameElement.style.fontWeight = '800';
        // usernameElement.style.fontSize = '18px';
        usernameElement.style.transition = 'all 0.3s ease';
        usernameElement.style.display = 'inline-block';

        userContainer.appendChild(usernameElement);

        const cleanMessage = (msg.message || '').replace(/&lt;stkr&gt;(.*?)&lt;\/stkr&gt;/g, '<stkr>$1</stkr>');
        const hasSticker = /<stkr>/.test(cleanMessage);
        const normalText = cleanMessage.replace(/<stkr>.*?<\/stkr>/g, '').trim();

        if (msg.credits > 0) {
            const isDonationOnly = !normalText.length && !hasSticker && !/:([^\s:]+):/.test(cleanMessage);
            messageEl.classList.add('has-donation');
            
            if (isDonationOnly) {
                messageEl.classList.add('donation-only');
            }
        }

        if (normalText.length > 0 || (!normalText.length && (hasSticker || /:[^\s:]+:/.test(cleanMessage)))) {
            const textElement = document.createElement('span');
            textElement.className = msg.credits > 0 ? 'message-text-inline has-donation' : 'message-text-inline';
            textElement.innerHTML = formatText(normalText.length > 0 ? normalText : cleanMessage);
            userContainer.appendChild(textElement);
        }

        header.appendChild(userContainer);

        if (msg.credits > 0) {
            const donation = document.createElement('span');
            donation.className = 'message-donation highlight';
            donation.textContent = `$${msg.credits} USD`;
            header.appendChild(donation);

            const confettiContainer = document.createElement('div');
            confettiContainer.className = 'confetti-container';

            for (let i = 0; i < 200; i++) {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = `${Math.random() * 100}%`;
                confetti.style.width = `${6 + Math.random() * 6}px`;
                confetti.style.height = confetti.style.width;
                const colors = ['#ff69b4', '#ffd700', '#ffffff', '#e81161', '#0070ff', '#00ff28'];
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                const duration = 2 + Math.random() * 8;
                const delay = Math.random() * 10;
                confetti.style.animation = `confettiFall ${duration}s linear ${delay}s forwards`;
                if (Math.random() > 0.5) confetti.style.borderRadius = '50%';
                confettiContainer.appendChild(confetti);
            }
            messageEl.appendChild(confettiContainer);
            setTimeout(() => {
                donation.classList.remove('highlight');
                confettiContainer.style.opacity = '0';
                setTimeout(() => confettiContainer.remove(), 1000);
            }, 20000);
        }

        messageEl.appendChild(header);

        if (hasSticker) {
            const stickerContainer = document.createElement('div');
            stickerContainer.className = 'message-sticker-container';
            const stickersOnly = cleanMessage.match(/<stkr>.*?<\/stkr>/g)?.join('') || '';
            stickerContainer.innerHTML = formatText(stickersOnly);
            messageEl.appendChild(stickerContainer);
        }

        const isDashboard = /index\.html$|\/$/.test(window.location.pathname);
        if (isDashboard) {
            chatContainer.insertBefore(messageEl, chatContainer.firstChild);
            if (isAutoScroll) chatContainer.scrollTop = 0;
        } else {
            chatContainer.appendChild(messageEl);
            if (isAutoScroll) chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    function formatText(text) {
        if (!text) return '';
        let formatted = escapeHtml(text);

        formatted = formatted.replace(/<stkr>(.*?)<\/stkr>/g, (match, url) => {
            try {
                const decodedUrl = decodeURIComponent(url);
                if (decodedUrl.match(/^https?:\/\//i)) {
                    return `<img src="${decodedUrl}" alt="Sticker" class="comment-sticker" loading="lazy" />`;
                }
                return match;
            } catch (e) {
                return match;
            }
        });

        if (Object.keys(EMOJI_MAPPING).length > 0) {
            for (const [code, url] of Object.entries(EMOJI_MAPPING)) {
                const isSticker = url.includes('/stickers/');
                const className = isSticker ? 'comment-sticker' : 'comment-emoji';
                const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                formatted = formatted.replace(
                    new RegExp(escapedCode, 'g'),
                    `<img src="${url}" alt="${code}" class="${className}" loading="lazy" />`
                );
            }
        }
        return formatted;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML
            .replace(/&lt;stkr&gt;/g, '<stkr>')
            .replace(/&lt;\/stkr&gt;/g, '</stkr>');
    }

    chatContainer.addEventListener('scroll', () => {
        isAutoScroll = chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight;
    });
});