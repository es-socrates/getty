import './raffle.css';

const STORAGE_KEY = 'raffle-winner-data';
const ACTIVE_STATE_KEY = 'raffle-active-state';
const EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_CACHE_MS = 30 * 60 * 1000;

const storage = (() => {
  try {
    const testKey = '__raffle_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
})();

const storageGet = (key) => {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const storageSet = (key, value) => {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {}
};

const storageRemove = (key) => {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {}
};

const getI18nText = (key, fallback) => {
  const defaultText = typeof fallback === 'string' && fallback.trim() ? fallback : key;
  try {
    if (window.languageManager && typeof window.languageManager.getText === 'function') {
      const value = window.languageManager.getText(key);
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
  } catch {}
  return defaultText;
};

const isDev = import.meta.env.DEV;
const backendPort = import.meta.env.VITE_BACKEND_PORT || '3000';
let wsPortOverride = null;
let attemptedDevFallback = false;

let container = null;
let contentRoot = null;
let rotateInterval = null;
let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 8;
const reconnectDelayBase = 1000;

let raffleData = {
  winner: null,
  prize: null,
  command: null,
  imageUrl: null,
  timestamp: null,
  participants: []
};
let lastActiveState = null;

const params = new URLSearchParams(window.location.search);
const tokenParam = (() => {
  try {
    return params.get('token') || params.get('widgetToken') || '';
  } catch {
    return '';
  }
})();

const withWidgetToken = (url) => {
  if (!tokenParam) return url;
  if (/^https?:/i.test(url)) {
    try {
      const parsed = new URL(url);
      if (!parsed.searchParams.has('widgetToken')) {
        parsed.searchParams.set('widgetToken', tokenParam);
      }
      return parsed.toString();
    } catch {
      return url;
    }
  }
  if (url.includes('widgetToken=')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}widgetToken=${encodeURIComponent(tokenParam)}`;
};

const safeFetchJson = async (url, options = {}) => {
  try {
    const response = await fetch(withWidgetToken(url), { cache: 'no-store', ...options });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

const parseTimestamp = (input) => {
  if (!input) return null;
  if (typeof input === 'number') {
    const ms = input > 1e12 ? input : input * 1000;
    return new Date(ms);
  }
  try {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

const formatTimestamp = (value) => {
  const date = parseTimestamp(value);
  if (!date) return '';
  try {
    const datePart = date.toLocaleDateString();
    const timePart = date.toLocaleTimeString();
    return `${datePart} ${timePart}`;
  } catch {
    return date.toISOString();
  }
};

const truncateName = (name) => {
  if (!name) return '';
  return name.length > 12 ? `${name.slice(0, 12)}…` : name;
};

const sanitizeParticipantName = (entry) => {
  if (!entry) return 'Spaceman';
  if (typeof entry === 'string') {
    return entry.length > 24 ? `${entry.slice(0, 21)}…` : entry;
  }
  if (typeof entry === 'object') {
    const candidate = entry.username || entry.name || entry.displayName;
    if (typeof candidate === 'string' && candidate.trim()) {
      return truncateName(candidate.trim());
    }
  }
  return 'Spaceman';
};

const clearWinnerRotation = () => {
  if (rotateInterval) {
    clearInterval(rotateInterval);
    rotateInterval = null;
  }
};

const setContent = (node) => {
  clearWinnerRotation();
  if (!contentRoot) return;
  contentRoot.replaceChildren(node);
  try {
    if (window.languageManager && typeof window.languageManager.updatePageLanguage === 'function') {
      window.languageManager.updatePageLanguage();
    }
  } catch {}
};

const renderInactive = () => {
  const wrapper = document.createElement('div');
  wrapper.className = 'raffle-active-state';

  const header = document.createElement('div');
  header.className = 'raffle-header';

  const badge = document.createElement('div');
  badge.className = 'raffle-status-badge inactive';
  const badgeDot = document.createElement('span');
  badgeDot.className = 'dot';
  badgeDot.setAttribute('aria-hidden', 'true');
  badge.appendChild(badgeDot);
  const badgeText = document.createElement('span');
  badgeText.textContent = getI18nText('raffleInactive', 'Raffle inactive');
  badge.appendChild(badgeText);

  const count = document.createElement('div');
  count.className = 'raffle-participant-count';
  const countValue = document.createElement('strong');
  countValue.textContent = '0';
  count.appendChild(countValue);
  const countLabel = document.createElement('span');
  countLabel.textContent = getI18nText('raffleParticipants', 'participants');
  count.appendChild(countLabel);

  header.appendChild(badge);
  header.appendChild(count);

  const participantsList = document.createElement('div');
  participantsList.className = 'participants-list';
  const empty = document.createElement('div');
  empty.className = 'participants-empty';
  empty.textContent = getI18nText('raffleNotConfigured', 'No raffle configured yet');
  participantsList.appendChild(empty);

  wrapper.appendChild(header);
  wrapper.appendChild(participantsList);
  setContent(wrapper);
};

const renderWinner = () => {
  const winnerNames = Array.isArray(raffleData.winner)
    ? raffleData.winner.filter(Boolean)
    : raffleData.winner
      ? [raffleData.winner]
      : [];

  const root = document.createElement('div');
  root.className = 'winner-display';

  const trophy = document.createElement('div');
  trophy.className = 'winner-icon';
  trophy.textContent = '🏆';
  root.appendChild(trophy);

  const title = document.createElement('div');
  title.className = 'winner-title';
  title.textContent = getI18nText('raffleWinnerTitle', 'We have a winner!');
  root.appendChild(title);

  const nameWrapper = document.createElement('div');
  nameWrapper.className = 'winner-name';

  if (winnerNames.length > 2) {
    const rotator = document.createElement('span');
    rotator.className = 'winner-name-fade opacity-0';
    nameWrapper.appendChild(rotator);
    clearWinnerRotation();
    let index = 0;
    const showNext = () => {
      if (!rotator.isConnected) {
        clearWinnerRotation();
        return;
      }
      rotator.classList.add('opacity-0');
      setTimeout(() => {
        rotator.textContent = truncateName(winnerNames[index] || '');
        rotator.classList.remove('opacity-0');
        index = (index + 1) % winnerNames.length;
      }, 400);
    };
    showNext();
    rotateInterval = setInterval(showNext, 5000);
  } else if (winnerNames.length) {
    winnerNames.forEach((winner) => {
      const span = document.createElement('span');
      span.textContent = truncateName(winner);
      nameWrapper.appendChild(span);
    });
  }
  root.appendChild(nameWrapper);

  const prizeLabel = document.createElement('div');
  prizeLabel.className = 'prize-label';
  prizeLabel.textContent = getI18nText('rafflePrizeLabel', 'Prize');
  root.appendChild(prizeLabel);

  const prizeValue = document.createElement('div');
  prizeValue.className = 'winner-prize';
  prizeValue.textContent = raffleData.prize || '—';
  root.appendChild(prizeValue);

  const meta = document.createElement('div');
  meta.className = 'winner-meta';

  const command = document.createElement('div');
  command.className = 'winner-command';
  const commandLabel = document.createElement('span');
  commandLabel.textContent = `${getI18nText('raffleCommandLabel', 'Command:')}`;
  const commandValue = document.createElement('span');
  commandValue.className = 'winner-command-value';
  commandValue.textContent = raffleData.command || window.lastRaffleCommand || '';
  command.appendChild(commandLabel);
  command.appendChild(commandValue);
  meta.appendChild(command);

  const confettiIcon = document.createElement('div');
  confettiIcon.className = 'winner-icon-sm';
  confettiIcon.textContent = '🎉';
  meta.appendChild(confettiIcon);

  const timestamp = formatTimestamp(raffleData.timestamp);
  if (timestamp) {
    const timeEl = document.createElement('div');
    timeEl.className = 'winner-timestamp';
    timeEl.textContent = `${getI18nText('raffleWinnerTimestamp', 'Announced on')} ${timestamp}`;
    meta.appendChild(timeEl);
  }

  root.appendChild(meta);
  setContent(root);
};

const renderActive = () => {
  const state = lastActiveState || {};
  const participants = Array.isArray(state.participants) && state.participants.length
    ? state.participants
    : raffleData.participants;
  const participantNames = Array.isArray(participants) ? participants.map(sanitizeParticipantName) : [];

  const wrapper = document.createElement('div');
  wrapper.className = 'raffle-active-state';

  const timerEl = document.createElement('div');
  timerEl.id = 'raffleTimer';
  timerEl.className = 'raffle-timer hidden';
  wrapper.appendChild(timerEl);

  const header = document.createElement('div');
  header.className = 'raffle-header';

  const statusBadge = document.createElement('div');
  const statusClass = state.paused ? 'paused' : 'active';
  statusBadge.className = `raffle-status-badge ${statusClass}`;
  statusBadge.setAttribute('role', 'status');
  statusBadge.setAttribute('aria-live', 'polite');

  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.setAttribute('aria-hidden', 'true');
  statusBadge.appendChild(dot);

  const statusText = document.createElement('span');
  const statusKey = state.paused ? 'rafflePaused' : 'raffleActive';
  statusText.textContent = getI18nText(statusKey, state.paused ? 'Paused' : 'Active');
  statusBadge.appendChild(statusText);

  const count = document.createElement('div');
  count.className = 'raffle-participant-count';
  const countValue = document.createElement('strong');
  countValue.textContent = String(participantNames.length);
  const countLabel = document.createElement('span');
  countLabel.textContent = getI18nText('raffleParticipants', 'participants');
  count.appendChild(countValue);
  count.appendChild(countLabel);

  header.appendChild(statusBadge);
  header.appendChild(count);

  const prizeGroup = document.createElement('div');
  prizeGroup.className = 'raffle-prize';

  const prizeImage = document.createElement('img');
  prizeImage.id = 'prizeImage';
  prizeImage.className = `prize-image${state.imageUrl ? '' : ' hidden'}`;
  if (state.imageUrl) {
    prizeImage.src = state.imageUrl;
    prizeImage.alt = 'Prize';
  }

  const prizeMeta = document.createElement('div');
  prizeMeta.className = 'prize-meta';

  const prizeLabel = document.createElement('div');
  prizeLabel.className = 'prize-label';
  prizeLabel.textContent = getI18nText('rafflePrizeLabel', 'Prize');

  const prizeName = document.createElement('div');
  prizeName.id = 'prizeName';
  prizeName.className = 'prize-text';
  prizeName.textContent = state.prize || getI18nText('raffleLoading', 'Loading…');

  prizeMeta.appendChild(prizeLabel);
  prizeMeta.appendChild(prizeName);

  prizeGroup.appendChild(prizeImage);
  prizeGroup.appendChild(prizeMeta);

  const list = document.createElement('div');
  list.className = 'participants-list';
  list.id = 'participantsList';

  if (participantNames.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'participants-empty';
    empty.textContent = getI18nText('raffleNoParticipants', 'No participants yet');
    list.appendChild(empty);
  } else {
    participantNames.forEach((name) => {
      const item = document.createElement('div');
      item.className = 'participant';
      item.textContent = name;
      list.appendChild(item);
    });
  }

  const stats = document.createElement('div');
  stats.className = 'stats';

  const command = document.createElement('div');
  const commandLabel = document.createElement('span');
  commandLabel.textContent = getI18nText('raffleCommand', 'Command');
  const commandValue = document.createElement('span');
  commandValue.id = 'raffleCommand';
  commandValue.className = 'value';
  commandValue.textContent = state.command || '!giveaway';
  command.appendChild(commandLabel);
  command.appendChild(commandValue);

  const winners = document.createElement('div');
  const winnersLabel = document.createElement('span');
  winnersLabel.textContent = getI18nText('raffleWinners', 'Winners');
  const winnersValue = document.createElement('span');
  winnersValue.id = 'winnersCount';
  winnersValue.className = 'value';
  winnersValue.textContent = String(state.totalWinners || 0);
  winners.appendChild(winnersLabel);
  winners.appendChild(winnersValue);

  stats.appendChild(command);
  stats.appendChild(winners);

  wrapper.appendChild(header);
  wrapper.appendChild(prizeGroup);
  wrapper.appendChild(list);
  wrapper.appendChild(stats);
  setContent(wrapper);
};

const renderRaffleContent = () => {
  if (!contentRoot) return;

  const hasWinner = raffleData.winner && (
    (Array.isArray(raffleData.winner) && raffleData.winner.length > 0) ||
    (typeof raffleData.winner === 'string' && raffleData.winner.trim())
  );

  if (hasWinner) {
    renderWinner();
    return;
  }

  const isActive = lastActiveState && lastActiveState.enabled && (lastActiveState.active || lastActiveState.paused);
  if (isActive) {
    renderActive();
    return;
  }

  renderInactive();
};

const loadSavedData = () => {
  const saved = storageGet(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp) < EXPIRATION_MS) {
        raffleData = { ...raffleData, ...parsed };
        if (parsed.command) {
          window.lastRaffleCommand = parsed.command;
        }
        return true;
      }
    } catch (error) {
      console.error('Failed to parse saved raffle winner:', error);
    }
  }

  const active = storageGet(ACTIVE_STATE_KEY);
  if (active) {
    try {
      const parsed = JSON.parse(active);
      if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp) < ACTIVE_CACHE_MS) {
        lastActiveState = parsed;
        if (parsed.command) {
          window.lastRaffleCommand = parsed.command;
        }
        renderRaffleContent();
        return false;
      }
    } catch (error) {
      console.error('Failed to parse saved raffle state:', error);
    }
  }
  return false;
};

const saveWinnerData = (winner, prize, command, imageUrl) => {
  raffleData = {
    winner,
    prize,
    command,
    imageUrl,
    timestamp: Date.now(),
    participants: raffleData.participants
  };
  if (command) {
    window.lastRaffleCommand = command;
  }
  try {
    storageSet(STORAGE_KEY, JSON.stringify(raffleData));
  } catch {}
};

const handleWinner = (payload) => {
  if (!payload) return;

  let names = [];
  let prize = '';
  let command = '';
  let imageUrl = '';

  if (Array.isArray(payload.winner)) {
    names = payload.winner.filter(Boolean);
    prize = payload.prize || '';
    command = payload.command || '';
    imageUrl = payload.imageUrl || '';
  } else if (typeof payload.winner === 'string') {
    names = [payload.winner];
    prize = payload.prize || '';
    command = payload.command || '';
    imageUrl = payload.imageUrl || '';
  } else if (payload.winner && typeof payload.winner === 'object') {
    const winner = payload.winner;
    names = [winner.winner || winner.username || winner.name || ''];
    prize = winner.prize || payload.prize || '';
    command = winner.command || payload.command || '';
    imageUrl = winner.imageUrl || payload.imageUrl || '';
  }

  names = names.filter(Boolean);
  if (!names.length) return;

  saveWinnerData(names.length === 1 ? names[0] : names, prize, command, imageUrl);
  renderRaffleContent();
};

const updateRaffleState = (state, isRestore = false) => {
  if (!state || typeof state !== 'object') return;
  if (typeof state.command === 'string') {
    window.lastRaffleCommand = state.command;
  }

  if (state.command && raffleData.command && state.command !== raffleData.command) {
    raffleData = {
      winner: null,
      prize: null,
      command: state.command,
      imageUrl: null,
      timestamp: null,
      participants: []
    };
    storageRemove(STORAGE_KEY);
  }

  if (!isRestore && !raffleData.winner && state.enabled && (state.active || state.paused)) {
    try {
      storageSet(ACTIVE_STATE_KEY, JSON.stringify({ ...state, timestamp: Date.now() }));
    } catch {}
  }

  if (!state.enabled || (!state.active && !state.paused)) {
    storageRemove(ACTIVE_STATE_KEY);
    lastActiveState = null;
  } else {
    lastActiveState = state;
  }

  if (Array.isArray(state.participants)) {
    raffleData.participants = state.participants.slice(0, 200);
  }
  if (state.prize) raffleData.prize = state.prize;
  if (state.command) raffleData.command = state.command;
  if (state.imageUrl) raffleData.imageUrl = state.imageUrl;

  renderRaffleContent();
};

const resolveSocketHost = () => {
  if (wsPortOverride) {
    return `${window.location.hostname}:${wsPortOverride}`;
  }
  return window.location.host;
};

const buildWsUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  const host = resolveSocketHost();
  const query = new URLSearchParams();
  if (tokenParam) {
    query.set('token', tokenParam);
    query.set('widgetToken', tokenParam);
  }
  const qs = query.toString();
  return qs ? `${protocol}${host}?${qs}` : `${protocol}${host}`;
};

const scheduleReconnect = () => {
  if (reconnectAttempts >= maxReconnectAttempts) {
    return;
  }
  reconnectAttempts += 1;
  const delay = reconnectDelayBase * Math.pow(2, reconnectAttempts - 1);
  setTimeout(connectWebSocket, delay);
};

const connectWebSocket = () => {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const url = buildWsUrl();
  try {
    ws = new WebSocket(url);
  } catch (error) {
    console.error('Raffle widget WebSocket init failed:', error);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    reconnectAttempts = 0;
    try {
      ws.send(JSON.stringify({ type: 'get_raffle_state' }));
    } catch {}
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (!message) return;

      if (message.type === 'raffle_state') {
        if (message.reset === true) {
          storageRemove(STORAGE_KEY);
          raffleData = {
            winner: null,
            prize: null,
            command: message.command || '!giveaway',
            imageUrl: null,
            timestamp: null,
            participants: []
          };
        }
        updateRaffleState(message);
        return;
      }

      if (message.type === 'init' && message.data && message.data.raffle) {
        updateRaffleState(message.data.raffle, true);
        return;
      }

      if (message.type === 'raffle_winner') {
        handleWinner(message);
        return;
      }
    } catch (error) {
      console.error('Raffle widget message error:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('Raffle widget WebSocket error:', error);
  };

  ws.onclose = () => {
    if (
      isDev &&
      !attemptedDevFallback &&
      !wsPortOverride &&
      window.location.port &&
      window.location.port !== backendPort
    ) {
      attemptedDevFallback = true;
      wsPortOverride = backendPort;
      reconnectAttempts = 0;
      setTimeout(connectWebSocket, 200);
      return;
    }
    scheduleReconnect();
  };
};

const fetchInitialState = async () => {
  const state = await safeFetchJson('/api/raffle/state');
  if (state && typeof state === 'object') {
    updateRaffleState(state, true);
  }
};

const init = () => {
  container = document.getElementById('raffleContainer');
  contentRoot = document.getElementById('raffleContentContainer');

  if (!container || !contentRoot) {
    console.error('Raffle widget container not found');
    return;
  }

  loadSavedData();
  renderRaffleContent();
  fetchInitialState();
  connectWebSocket();

  window.addEventListener('beforeunload', () => {
    try {
      if (ws) ws.close();
    } catch {}
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
