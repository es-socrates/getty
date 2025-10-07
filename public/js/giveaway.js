const STORAGE_KEY = 'raffle-winner-data';
const ACTIVE_STATE_KEY = 'raffle-active-state';
const EXPIRATION_DAYS = 7;
let raffleData = {
    winner: null,
    prize: null,
    command: null,
    imageUrl: null,
    timestamp: null,
    participants: []
};
let lastActiveState = null;

function loadSavedData() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            if (parsed.timestamp && (Date.now() - parsed.timestamp) < (EXPIRATION_DAYS * 24 * 60 * 60 * 1000)) {
                raffleData = parsed;
                return true;
            }
        } catch (e) {
            console.error('Error parsing saved raffle data:', e);
        }
    }

    const activeState = localStorage.getItem(ACTIVE_STATE_KEY);
    if (activeState) {
        try {
            const parsed = JSON.parse(activeState);
            if (!raffleData.winner && parsed.timestamp && (Date.now() - parsed.timestamp) < (30 * 60 * 1000)) {
                lastActiveState = parsed;
                updateRaffleState(parsed, true);
                return false;
            }
        } catch (e) {
            console.error('Error parsing saved active raffle state:', e);
        }
    }
    return false;
}

function saveWinnerData(winner, prize, command, imageUrl) {
    raffleData = {
        winner,
        prize,
        command,
        imageUrl,
        timestamp: Date.now(),
        participants: raffleData.participants
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raffleData));
}

function renderRaffleContent() {
    const container = document.getElementById('raffleContentContainer');
    if (!container) return;

    if (!raffleData.winner && (!lastActiveState || !lastActiveState.enabled || (!lastActiveState.active && !lastActiveState.paused))) {
        container.innerHTML = `<div class="giveaway-inactive"><span data-i18n="raffleInactive"></span></div>`;
        if (window.languageManager) window.languageManager.updatePageLanguage();
        return;
    }
    
    let winnerNames = [];
    if (Array.isArray(raffleData.winner)) {
        winnerNames = raffleData.winner;
    } else if (raffleData.winner) {
        winnerNames = [raffleData.winner];
    }

    if (raffleData.winner) {
        let winnerNameHTML = '';
        if (winnerNames.length > 2) {
            winnerNameHTML = `<span class="winner-name-fade" id="winnerNameFade"></span>`;
        } else {
            winnerNameHTML = winnerNames.map(name =>
                `<span class="winner-name">${name.length > 12 ? name.slice(0, 12) + '…' : name}</span>`
            ).join(', ');
        }

        container.innerHTML = `
        <div class="winner-display">
            <div class="winner-flex-row">
                <div class="winner-image-area">
                    <img id="winnerPrizeImage" src="${raffleData.imageUrl || ''}" alt="Giveaway image" class="winner-prize-image${raffleData.imageUrl ? '' : ' hidden'}">
                    <div id="winnerPrizeImagePlaceholder" class="prize-image-placeholder${raffleData.imageUrl ? ' hidden' : ''}">Giveaway<br>image</div>
                </div>
                <div class="winner-info-area">
                    <div class="winner-icon" aria-label="Trophy" title="Trophy">
                        <!-- SVG omitted for brevity -->
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <ellipse cx="18" cy="32" rx="10" ry="3" fill="#d3a74f"/>
                            <rect x="13" y="25" width="10" height="5" rx="2" fill="#e6c15a"/>
                            <rect x="15" y="20" width="6" height="6" rx="2" fill="#f7e07b"/>
                            <path d="M7 8a11 11 0 0 0 22 0V6a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2Z" fill="#ffe066" stroke="#d3a74f" stroke-width="2"/>
                            <path d="M7 8c-2.5 0-3 2.5-3 4.5C4 16 7 19 12 19" stroke="#d3a74f" stroke-width="2" fill="none"/>
                            <path d="M29 8c2.5 0 3 2.5 3 4.5C32 16 29 19 24 19" stroke="#d3a74f" stroke-width="2" fill="none"/>
                            <circle cx="18" cy="13" r="3.5" fill="#fffbe6" stroke="#d3a74f" stroke-width="1.5"/>
                        </svg>
                    </div>
                    <div class="text-xl winner-title" data-i18n="raffleWinnerTitle">¡Tenemos un ganador!</div>
                    <div class="winner-name winner-strong" id="winnerName">
                        ${winnerNameHTML}
                    </div>
                    <div class="text-lg winner-label" data-i18n="rafflePrizeLabel"></div>
                    <div class="winner-prize winner-strong" id="winnerPrize">${raffleData.prize || '---'}</div>
                    <div class="winner-command winner-strong" id="winnerCommand">
                        <span data-i18n="raffleCommandLabel">Comando:</span>
                        <span class="winner-command-value">${raffleData.command || window.lastRaffleCommand || ''}</span>
                    </div>
                    <div class="winner-timestamp text-gray-400 text-sm" id="winnerTimestamp">${raffleData.timestamp ? (() => { const date = new Date(raffleData.timestamp); return `Winner announced on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`; })() : ''}</div>
                </div>
            </div>
        </div>
        `;
        if (window.languageManager) window.languageManager.updatePageLanguage();
        if (winnerNames.length > 2) {
            const fadeElem = document.getElementById('winnerNameFade');
            let idx = 0;
            function showNextWinner() {
                if (!fadeElem) return;
                fadeElem.classList.add('opacity-0');
                setTimeout(() => {
                    fadeElem.textContent = winnerNames[idx].length > 12 ? winnerNames[idx].slice(0, 12) + '…' : winnerNames[idx];
                    fadeElem.classList.remove('opacity-0');
                    idx = (idx + 1) % winnerNames.length;
                }, 400);
            }
            showNextWinner();
            setInterval(showNextWinner, 5000);
        }
        return;
    }

    const state = lastActiveState;
    let participantsHTML = '';
    let participantCount = 0;
    if (state && state.participants && state.participants.length > 0) {
        state.participants.forEach(p => {
            let username = '';
            if (typeof p === 'object' && p !== null) {
                username = p.username || p.name || '';
            } else if (typeof p === 'string') {
                username = (p.length > 20) ? '' : p;
            }
            if (!username) username = 'Spaceman';
            participantsHTML += `<div class="participant">${username}</div>`;
            participantCount++;
        });
    } else {
        participantsHTML = `<div class="text-center text-gray-400">No participants yet</div>`;
    }
    container.innerHTML = `
        <div class="giveaway-content">
            <div class="giveaway-row">
                <div class="giveaway-prize-image-area">
                    <img id="prizeImage" src="${state && state.imageUrl ? state.imageUrl : ''}" alt="Award image" class="prize-image${state && state.imageUrl ? '' : ' hidden'}">
                    <div id="prizeImagePlaceholder" class="prize-image-placeholder${state && state.imageUrl ? ' hidden' : ''}">Image<br>of<br>the<br>award</div>
                </div>
                <div class="giveaway-main-info">
                    <div class="giveaway-prize-name" id="prizeName">${state && state.prize ? state.prize : '<span data-i18n="raffleLoading">Loading...</span>'}</div>
                    <div class="giveaway-participants-label" data-i18n="raffleParticipants">Participants:</div>
                    <div class="participants-list" id="participantsList">${participantsHTML}</div>
                </div>
            </div>
            <div class="giveaway-bottom-row">
                <div class="giveaway-participant-count-box">
                    <span id="participantCountBox">${participantCount}</span>
                </div>
                <div class="giveaway-command-area" id="commandArea">
                    <span class="command-label" data-i18n="raffleCommandLabel">Command:</span> <span id="raffleCommand" class="giveaway-command">${state && state.command ? state.command : 'Command name'}</span>
                </div>
            </div>
        </div>
    `;
    if (window.languageManager) window.languageManager.updatePageLanguage();

    setTimeout(() => {
        const list = document.getElementById('participantsList');
        if (list && list.scrollHeight > list.clientHeight) {
            list.scrollTop = list.scrollHeight;
        }
    }, 200);
}

document.addEventListener('DOMContentLoaded', () => {
    const hasWinner = loadSavedData();
    renderRaffleContent();
    connectWebSocket();
});

let ws;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000;

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    ws = new WebSocket(protocol + window.location.host);

    ws.onopen = () => {
        reconnectAttempts = 0;
        try { ws.send(JSON.stringify({ type: 'get_raffle_state' })); } catch (e) { /* ignore */ }
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'raffle_state') {
                if (data.reset === true) {
                    raffleData = {
                        winner: null,
                        prize: null,
                        command: data.command || '!giveaway',
                        imageUrl: null,
                        timestamp: null,
                        participants: []
                    };
                    localStorage.removeItem(STORAGE_KEY);
                    localStorage.removeItem(ACTIVE_STATE_KEY);
                    lastActiveState = null;
                }
                updateRaffleState(data);
            } else if (data.type === 'init' && data.data && data.data.raffle) {
                updateRaffleState(data.data.raffle, true);
            } else if (data.type === 'raffle_winner') {
                handleWinner(data);
            }
        } catch (e) {
            console.error('Error parsing WebSocket message:', e);
        }
    };

    ws.onclose = () => {
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            setTimeout(connectWebSocket, reconnectDelay);
        }
    };

    ws.onerror = (error) => {
        ws.close();
    };
}

function handleWinner(winnerData) {
    let winnerNames = [];
    let prize = '';
    let command = '';
    let imageUrl = '';
    if (winnerData) {
        if (Array.isArray(winnerData.winner)) {
            winnerNames = winnerData.winner;
            prize = winnerData.prize || '';
            command = winnerData.command || '';
            imageUrl = winnerData.imageUrl || '';
        } else if (typeof winnerData.winner === 'string') {
            winnerNames = [winnerData.winner];
            prize = winnerData.prize || '';
            command = winnerData.command || '';
            imageUrl = winnerData.imageUrl || '';
        } else if (typeof winnerData.winner === 'object' && winnerData.winner !== null) {

            winnerNames = [
                winnerData.winner.winner ||
                winnerData.winner.username ||
                winnerData.winner.name ||
                ''
            ];
            prize = winnerData.winner.prize || winnerData.prize || '';
            command = winnerData.winner.command || winnerData.command || '';
            imageUrl = winnerData.winner.imageUrl || winnerData.imageUrl || '';
        }
        if (winnerNames.length > 0 && winnerNames.some(name => !!name)) {

            saveWinnerData(
                winnerNames.length === 1 ? winnerNames[0] : winnerNames,
                prize,
                command,
                imageUrl
            );
            renderRaffleContent();
        }
    }
}

function updateRaffleState(state, isRestore) {
    window.lastRaffleCommand = state.command;
    if (state.command && raffleData.command && state.command !== raffleData.command) {
        raffleData = {
            winner: null,
            prize: null,
            command: state.command,
            imageUrl: null,
            timestamp: null,
            participants: []
        };
        localStorage.removeItem(STORAGE_KEY);
    }

    if (!isRestore && !raffleData.winner && state.enabled && (state.active || state.paused)) {
        localStorage.setItem(ACTIVE_STATE_KEY, JSON.stringify({
            ...state,
            timestamp: Date.now()
        }));
        lastActiveState = state;
    }

    if (!state.enabled || (!state.active && !state.paused)) {
        localStorage.removeItem(ACTIVE_STATE_KEY);
        lastActiveState = null;
    } else {
        lastActiveState = state;
    }

    renderRaffleContent();
}
