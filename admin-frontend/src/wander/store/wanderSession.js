import { reactive, readonly } from 'vue';
import { fetchJson } from '../../services/api';

const state = reactive({
  address: null,
  walletHash: null,
  capabilities: [],
  expiresAt: null,
  loading: true,
  error: null,
  wsConnected: false,
  sessionStale: false,
  lastHeartbeat: 0,
});

let __hbTimer = null;
const HEARTBEAT_INTERVAL_MS = 30_000;
const FOCUS_RECHECK_DELAY_MS = 750;

function __dispatchDebug(msg) {
  try {
    if (globalThis.process?.env?.VITE_GETTY_WALLET_AUTH_DEBUG === '1') {
      console.warn('[wallet-session]', msg);
    }
  } catch {}
}

function markSessionStale(val = true) {
  if (state.sessionStale === !!val) return;
  state.sessionStale = !!val;
  if (val) __dispatchDebug('marked stale');
}

async function heartbeat(force = false) {
  if (!state.address) return;
  const now = Date.now();
  if (!force && now - state.lastHeartbeat < 5_000) return;
  state.lastHeartbeat = now;
  try {
    const res = await fetchJson('/api/auth/wander/me', { method: 'GET' });
    if (res && res.address) {
      if (state.sessionStale) __dispatchDebug('session restored during heartbeat');
      state.address = res.address;
      state.walletHash = res.walletHash;
      state.capabilities = res.capabilities || [];
      state.expiresAt = res.expiresAt;
      markSessionStale(false);
      return;
    }

    markSessionStale(true);
  } catch {
    if (state.address) markSessionStale(true);
  }
}

function startHeartbeat() {
  if (__hbTimer) return;
  __hbTimer = setInterval(() => {
    if (!state.address) return;
    if (state.sessionStale) return;
    heartbeat();
  }, HEARTBEAT_INTERVAL_MS);
}

function setupVisibilityListeners() {
  try {
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => heartbeat(true), FOCUS_RECHECK_DELAY_MS);
      }
    });
    window.addEventListener('focus', () => {
      setTimeout(() => heartbeat(true), FOCUS_RECHECK_DELAY_MS);
    });
  } catch {}
}

function setupStaleEventListener() {
  try {
    window.addEventListener('getty:wallet-session-stale', () => {
      if (state.address) markSessionStale(true);
    });
    window.addEventListener('getty:wallet-bad-signature', () => {
      forceFullReset('bad_signature_event');
    });
  } catch {}
}

setupVisibilityListeners();
setupStaleEventListener();

async function refreshSession() {
  state.loading = true; state.error = null;
  try {
    let res = null;
    try {
      res = await fetchJson('/api/auth/wander/me', { method: 'GET' });
      if (res && res.error === 'unauthorized') throw new Error('unauthorized');
    } catch {
      try { res = await fetchJson('/api/auth/wallet/me', { method: 'GET' }); } catch { res = {}; }
    }
    state.address = res.address || null;
    state.walletHash = res.walletHash || null;
    state.capabilities = res.capabilities || [];
    state.expiresAt = res.expiresAt || null;
    if (state.address) {
      markSessionStale(false);
      startHeartbeat();
    }
  } catch {
    if (state.address) markSessionStale(true);
    state.address = null; state.walletHash = null; state.capabilities = []; state.expiresAt = null;
  } finally { state.loading = false; }
}

async function logout() {
  try {
    try { await fetchJson('/api/auth/wander/logout', { method: 'POST' }); }
    catch { await fetchJson('/api/auth/wallet/logout', { method: 'POST' }); }
  } catch {}
  await refreshSession();
  markSessionStale(false);
}

function markWsConnected(val) { state.wsConnected = !!val; }

async function attemptReconnect() {
  await refreshSession();
  if (state.sessionStale) {
    forceFullReset('attemptReconnect_stale');
  }
}

function forceFullReset(reason = 'force_reset') {
  try { console.warn('[wander-session] full reset', reason); } catch {}
  state.address = null;
  state.walletHash = null;
  state.capabilities = [];
  state.expiresAt = null;
  state.sessionStale = false;
  try {
    fetchJson('/api/auth/wander/logout', { method: 'POST' }).catch(()=>{});
  } catch {}

  try { localStorage.setItem('getty_logout', String(Date.now())); } catch {}

  try { window.location.replace('/?logout=true'); } catch { window.location.href = '/?logout=true'; }
}

export function useWanderSession() { return { state: readonly(state), refreshSession, logout, markWsConnected, attemptReconnect, markSessionStale, forceFullReset }; }

refreshSession();
startHeartbeat();
