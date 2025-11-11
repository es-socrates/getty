import { reactive, readonly } from 'vue';
import { fetchJson } from '../../services/api';
import type {
  WalletDisconnectedEvent,
  WalletLoadedEvent,
  WalletSwitchEvent
} from '../provider/walletTypes';

type Capability = string;

interface WanderSessionState {
  address: string | null;
  walletHash: string | null;
  capabilities: Capability[];
  expiresAt: string | null;
  loading: boolean;
  error: string | null;
  wsConnected: boolean;
  sessionStale: boolean;
  lastHeartbeat: number;
  walletCheckedAt: number | null;
}

interface SessionResponse {
  address?: string | null;
  walletHash?: string | null;
  capabilities?: Capability[];
  expiresAt?: string | null;
  error?: string;
}

const state = reactive<WanderSessionState>({
  address: null,
  walletHash: null,
  capabilities: [],
  expiresAt: null,
  loading: true,
  error: null,
  wsConnected: false,
  sessionStale: false,
  lastHeartbeat: 0,
  walletCheckedAt: null
});

const stateProxy = readonly(state);

let __hbTimer: ReturnType<typeof setInterval> | null = null;
const HEARTBEAT_INTERVAL_MS = 30_000;
const FOCUS_RECHECK_DELAY_MS = 750;

function __dispatchDebug(msg: string): void {
  try {
    if (globalThis.process?.env?.VITE_GETTY_WALLET_AUTH_DEBUG === '1') {
      console.warn('[wallet-session]', msg);
    }
  } catch {
    /* noop */
  }
}

function markSessionStale(val = true): void {
  if (state.sessionStale === !!val) return;
  state.sessionStale = !!val;
  if (val) __dispatchDebug('marked stale');
}

async function heartbeat(force = false): Promise<void> {
  if (!state.address) return;
  const now = Date.now();
  if (!force && now - state.lastHeartbeat < 5_000) return;
  state.lastHeartbeat = now;
  try {
    const res = (await fetchJson('/api/auth/wander/me', { method: 'GET' })) as SessionResponse;
    if (res && res.address) {
      if (state.sessionStale) __dispatchDebug('session restored during heartbeat');
      state.address = res.address ?? null;
      state.walletHash = res.walletHash ?? null;
      state.capabilities = res.capabilities ?? [];
      state.expiresAt = res.expiresAt ?? null;
      markSessionStale(false);
      return;
    }

    markSessionStale(true);
  } catch {
    if (state.address) markSessionStale(true);
  }
}

function startHeartbeat(): void {
  if (__hbTimer) return;
  __hbTimer = setInterval(() => {
    if (!state.address) return;
    if (state.sessionStale) return;
    void heartbeat();
  }, HEARTBEAT_INTERVAL_MS);
}

function setupVisibilityListeners(): void {
  try {
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => {
          void heartbeat(true);
        }, FOCUS_RECHECK_DELAY_MS);
      }
    });
    window.addEventListener('focus', () => {
      setTimeout(() => {
        void heartbeat(true);
      }, FOCUS_RECHECK_DELAY_MS);
    });
  } catch {
    /* noop */
  }
}

function setupStaleEventListener(): void {
  try {
    window.addEventListener('getty:wallet-session-stale', () => {
      if (state.address) markSessionStale(true);
    });
    window.addEventListener('getty:wallet-bad-signature', () => {
      forceFullReset('bad_signature_event');
    });
  } catch {
    /* noop */
  }
}

let walletEventsBound = false;

function setupWalletEventListeners(): void {
  if (walletEventsBound) return;
  walletEventsBound = true;
  try {
    window.addEventListener('arweaveWalletLoaded', onWalletLoaded as EventListener);
    window.addEventListener('walletSwitch', onWalletSwitch as EventListener);
    window.addEventListener('walletDisconnected', onWalletDisconnected as EventListener);
  } catch {
    /* noop */
  }
}

function onWalletLoaded(event: WalletLoadedEvent): void {
  state.walletCheckedAt = Date.now();
  const perms = event.detail?.permissions ?? [];
  if (!perms.length) {
    markSessionStale(true);
    return;
  }
  void refreshSession();
}

function onWalletSwitch(event: WalletSwitchEvent): void {
  const nextAddress = event.detail?.address;
  if (!nextAddress) {
    markSessionStale(true);
    return;
  }
  if (state.address && nextAddress !== state.address) {
    __dispatchDebug(`wallet switched ${state.address} -> ${nextAddress}`);
  }
  void refreshSession();
}

function onWalletDisconnected(event: WalletDisconnectedEvent): void {
  const reason = event.detail?.reason;
  forceFullReset(reason ? `wallet_disconnected:${reason}` : 'wallet_disconnected');
}

async function refreshSession(): Promise<void> {
  state.loading = true;
  state.error = null;
  try {
    let res: SessionResponse | undefined;
    try {
      res = (await fetchJson('/api/auth/wander/me', { method: 'GET' })) as SessionResponse;
      if (res && res.error === 'unauthorized') throw new Error('unauthorized');
    } catch (error) {
      try {
        res = (await fetchJson('/api/auth/wallet/me', { method: 'GET' })) as SessionResponse;
      } catch {
        res = {};
      }
      if (error instanceof Error && error.message !== 'unauthorized') state.error = error.message;
    }
    state.address = res?.address ?? null;
    state.walletHash = res?.walletHash ?? null;
    state.capabilities = res?.capabilities ?? [];
    state.expiresAt = res?.expiresAt ?? null;
    if (state.address) {
      markSessionStale(false);
      startHeartbeat();
    }
  } catch (error) {
    if (state.address) markSessionStale(true);
    state.address = null;
    state.walletHash = null;
    state.capabilities = [];
    state.expiresAt = null;
    state.error = error instanceof Error ? error.message : String(error ?? '');
  } finally {
    state.loading = false;
  }
}

async function logout(): Promise<void> {
  try {
    try {
      await fetchJson('/api/auth/wander/logout', { method: 'POST' });
    } catch {
      await fetchJson('/api/auth/wallet/logout', { method: 'POST' });
    }
  } catch {
    /* noop */
  }
  await refreshSession();
  markSessionStale(false);
}

function markWsConnected(val: boolean): void {
  state.wsConnected = !!val;
}

async function attemptReconnect(): Promise<void> {
  await refreshSession();
  if (state.sessionStale) {
    forceFullReset('attemptReconnect_stale');
  }
}

function forceFullReset(reason = 'force_reset'): void {
  try {
    console.warn('[wander-session] full reset', reason);
  } catch {
    /* noop */
  }
  state.address = null;
  state.walletHash = null;
  state.capabilities = [];
  state.expiresAt = null;
  state.sessionStale = false;
  try {
    fetchJson('/api/auth/wander/logout', { method: 'POST' }).catch(() => {});
  } catch {
    /* noop */
  }

  try {
    localStorage.setItem('getty_logout', String(Date.now()));
  } catch {
    /* noop */
  }

  try {
    window.location.replace('/?logout=true');
  } catch {
    window.location.href = '/?logout=true';
  }
}

export function useWanderSession() {
  return {
    state: stateProxy,
    refreshSession,
    logout,
    markWsConnected,
    attemptReconnect,
    markSessionStale,
    forceFullReset
  };
}

export type WanderSessionComposable = ReturnType<typeof useWanderSession>;

setupVisibilityListeners();
setupStaleEventListener();
setupWalletEventListeners();

void refreshSession();
startHeartbeat();
