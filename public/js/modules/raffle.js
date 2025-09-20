let __raffle_started = false;

export function initRaffle() {
  if (__raffle_started) return; __raffle_started = true;

  const STORAGE_KEY = 'raffle-winner-data';
  const ACTIVE_STATE_KEY = 'raffle-active-state';
  const EXPIRATION_DAYS = 7;
  let raffleData = { winner: null, prize: null, command: null, imageUrl: null, timestamp: null, participants: [] };
  let lastActiveState = null;
  let ws; let reconnectAttempts = 0; const maxReconnectAttempts = 5; const reconnectDelay = 3000;

  function getI18nText(key) {
    try {
      if (window.languageManager && typeof window.languageManager.getText === 'function') {
        const t = window.languageManager.getText(key);
        if (typeof t === 'string' && t.trim().length > 0) return t;
      }
    } catch {}
    const k = String(key || '')
      .replace(/^raffle/i, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
    return k || String(key || '');
  }

  function renderRaffleContent() {
    const container = document.getElementById('raffleContentContainer');
    if (!container) return;

    if (!raffleData.winner && (!lastActiveState || !lastActiveState.enabled || (!lastActiveState.active && !lastActiveState.paused))) {
      const participantsHTML = '<div class="text-center text-gray-400"><span data-i18n="raffleNotConfigured"></span></div>';
      const inactiveText = getI18nText('raffleInactive');
      container.innerHTML = `
        <div id="raffleActiveContent">
          <div class="raffle-header">
            <div class="raffle-status-badge inactive" role="status" aria-live="polite">
              <span class="dot" aria-hidden="true"></span>
              <span data-i18n="raffleInactive">${inactiveText}</span>
            </div>
            <div class="participant-count">
              <span id="participantCount">0</span> <span data-i18n="raffleParticipants">participants</span>
            </div>
          </div>
          <div class="participants-list" id="participantsList">${participantsHTML}</div>
        </div>`;
      if (window.languageManager) window.languageManager.updatePageLanguage();
      return;
    }
    let winnerNames = [];
    if (Array.isArray(raffleData.winner)) winnerNames = raffleData.winner; else if (raffleData.winner) winnerNames = [raffleData.winner];
    if (raffleData.winner) {
      const truncate = (name) => name.length > 12 ? name.slice(0, 12) + '…' : name;
      const winnerNameHTML = winnerNames.length > 2 ? '<span class="winner-name-fade" id="winnerNameFade"></span>' : winnerNames.map(name => `<span class="winner-name">${truncate(name)}</span>`).join(', ');
      const winnerTimestampText = raffleData.timestamp ? (() => { const date = new Date(raffleData.timestamp); return `Winner announced on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`; })() : '';
      container.innerHTML = `
        <div class="winner-display">
          <div class="winner-icon">🏆</div>
          <div class="text-xl winner-title" data-i18n="raffleWinnerTitle">We have a winner!</div>
          <div class="winner-name" id="winnerName">${winnerNameHTML}</div>
          <div class="text-lg" data-i18n="rafflePrizeLabel"></div>
          <div class="winner-prize" id="winnerPrize">${raffleData.prize || '---'}</div>
          <div class="winner-meta">
            <div class="winner-command" id="winnerCommand">
              <span data-i18n="raffleCommandLabel">Command:</span>
              <span class="winner-command-value">${raffleData.command || window.lastRaffleCommand || ''}</span>
            </div>
            <div class="winner-icon winner-icon-sm">🎉</div>
            <div class="winner-timestamp text-gray-400 text-sm" id="winnerTimestamp">${winnerTimestampText}</div>
          </div>
        </div>`;
      if (window.languageManager) window.languageManager.updatePageLanguage();
      if (winnerNames.length > 2) {
        const fadeElem = document.getElementById('winnerNameFade');
        let idx = 0;
        function showNextWinner() {
          if (!fadeElem) return;
          fadeElem.classList.add('opacity-0');
          setTimeout(() => { fadeElem.textContent = truncate(winnerNames[idx]); fadeElem.classList.remove('opacity-0'); idx = (idx + 1) % winnerNames.length; }, 400);
        }
        showNextWinner(); setInterval(showNextWinner, 5000);
      }
      return;
    }
    const state = lastActiveState;
    const statusKey = (state && state.paused) ? 'rafflePaused' : 'raffleActive';
  const statusClass = (state && state.paused)
      ? 'raffle-status-badge paused'
      : 'raffle-status-badge active';
  const statusText = getI18nText(statusKey);
    const participantsList = (lastActiveState && Array.isArray(lastActiveState.participants) && lastActiveState.participants.length > 0) ? lastActiveState.participants : (Array.isArray(raffleData.participants) ? raffleData.participants : []);
    let participantsHTML = ''; let participantCount = 0;
    if (participantsList.length > 0) {
      participantsList.forEach(p => { let username = ''; if (typeof p === 'object' && p !== null) { username = p.username || p.name || ''; } else if (typeof p === 'string') { username = (p.length > 20) ? '' : p; } if (!username) username = 'Spaceman'; participantsHTML += '<div class="participant">' + username + '</div>'; participantCount++; });
    } else { participantsHTML = '<div class="text-center text-gray-400">No participants yet</div>'; }
  container.innerHTML = `
      <div id="raffleActiveContent">
    <div id="raffleTimer" class="text-center text-lg font-bold text-yellow-300 mb-2 hidden"></div>
        <div class="raffle-header">
          <div class="${statusClass}" role="status" aria-live="polite"><span class="dot" aria-hidden="true"></span><span data-i18n="${statusKey}">${statusText}</span></div>
          <div class="participant-count">
            <span id="participantCount">${participantCount}</span> <span data-i18n="raffleParticipants">participants</span>
          </div>
        </div>
        <div class="raffle-prize">
          <img id="prizeImage" src="${(state && state.imageUrl) ? state.imageUrl : ''}" alt="Prize" class="prize-image${(state && state.imageUrl) ? '' : ' hidden'}">
          <div>
            <div class="font-medium" data-i18n="rafflePrizeLabel">Prize:</div>
            <div id="prizeName" class="text-yellow-300">${(state && state.prize) ? state.prize : '<span data-i18n="raffleLoading">Loading...</span>'}</div>
          </div>
        </div>
        <div class="participants-list" id="participantsList">${participantsHTML}</div>
        <div class="stats">
          <div><span data-i18n="raffleCommand"></span> <span id="raffleCommand" class="font-mono">${(state && state.command) ? state.command : '!giveaway'}</span></div>
          <div><span data-i18n="raffleWinners">Winners:</span> <span id="winnersCount">${(state && state.totalWinners) ? state.totalWinners : 0}</span></div>
        </div>
      </div>`;
    if (window.languageManager) window.languageManager.updatePageLanguage();
  }

  function loadSavedData() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.timestamp && (Date.now() - parsed.timestamp) < (EXPIRATION_DAYS * 24 * 60 * 60 * 1000)) {
          raffleData = parsed; return true;
        }
      } catch (e) { console.error('Error parsing saved raffle data:', e); }
    }
    const activeState = localStorage.getItem(ACTIVE_STATE_KEY);
    if (activeState) {
      try {
        const parsed = JSON.parse(activeState);
        if (!raffleData.winner && parsed.timestamp && (Date.now() - parsed.timestamp) < (30 * 60 * 1000)) { lastActiveState = parsed; renderRaffleContent(); return false; }
      } catch (e) { console.error('Error parsing saved active raffle state:', e); }
    }
    return false;
  }
  function saveWinnerData(winner, prize, command, imageUrl) {
    raffleData = { winner, prize, command, imageUrl, timestamp: Date.now(), participants: raffleData.participants };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raffleData));
  }
  function handleWinner(winnerData) {
    let winnerNames = []; let prize = ''; let command = ''; let imageUrl = '';
    if (winnerData) {
      if (Array.isArray(winnerData.winner)) { winnerNames = winnerData.winner; prize = winnerData.prize || ''; command = winnerData.command || ''; imageUrl = winnerData.imageUrl || ''; }
      else if (typeof winnerData.winner === 'string') { winnerNames = [winnerData.winner]; prize = winnerData.prize || ''; command = winnerData.command || ''; imageUrl = winnerData.imageUrl || ''; }
      else if (typeof winnerData.winner === 'object' && winnerData.winner !== null) { winnerNames = [winnerData.winner.winner || winnerData.winner.username || winnerData.winner.name || '']; prize = winnerData.winner.prize || winnerData.prize || ''; command = winnerData.winner.command || winnerData.command || ''; imageUrl = winnerData.winner.imageUrl || winnerData.imageUrl || ''; }
      if (winnerNames.length > 0 && winnerNames.some(name => !!name)) { saveWinnerData(winnerNames.length === 1 ? winnerNames[0] : winnerNames, prize, command, imageUrl); renderRaffleContent(); }
    }
  }
  function updateRaffleState(state, isRestore) {
    window.lastRaffleCommand = state.command;
    if (state.command && raffleData.command && state.command !== raffleData.command) { raffleData = { winner: null, prize: null, command: state.command, imageUrl: null, timestamp: null, participants: [] }; localStorage.removeItem(STORAGE_KEY); }
    if (!isRestore && !raffleData.winner && state.enabled && (state.active || state.paused)) { localStorage.setItem(ACTIVE_STATE_KEY, JSON.stringify({ ...state, timestamp: Date.now() })); lastActiveState = state; }
    if (!state.enabled || (!state.active && !state.paused)) { localStorage.removeItem(ACTIVE_STATE_KEY); lastActiveState = null; } else { lastActiveState = state; }
    renderRaffleContent();
  }
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const getCookie = (name) => { try { return document.cookie.split('; ').find(r=>r.startsWith(name+'='))?.split('=')[1] || ''; } catch { return ''; } };
  ws = new WebSocket(protocol + window.location.host);
    ws.onopen = () => { reconnectAttempts = 0; try { ws.send(JSON.stringify({ type: 'get_raffle_state' })); } catch {}
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'raffle_state') { if (data.reset === true) { raffleData = { winner: null, prize: null, command: data.command || '!giveaway', imageUrl: null, timestamp: null, participants: [] }; localStorage.removeItem(STORAGE_KEY); } updateRaffleState(data); }
        else if (data.type === 'init' && data.data && data.data.raffle) { updateRaffleState(data.data.raffle, true); }
        else if (data.type === 'raffle_winner') { handleWinner(data); }
      } catch (e) { console.error('Error parsing WebSocket message:', e); }
    };
    ws.onclose = () => { if (reconnectAttempts < maxReconnectAttempts) { reconnectAttempts++; setTimeout(connectWebSocket, reconnectDelay); } };
    ws.onerror = (error) => { console.error('WebSocket error:', error); try { ws.close(); } catch {} };
  }

  loadSavedData();
  renderRaffleContent();
  connectWebSocket();
}

export default { initRaffle };
