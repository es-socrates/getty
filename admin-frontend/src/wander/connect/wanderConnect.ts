import { WanderConnect, type AuthInfo, type BackupInfo, type BalanceInfo, type RequestsInfo, type DirectAccess } from '@wanderapp/connect';

export interface WanderConnectCallbacks {
  onAuth?(info: AuthInfo): void;
  onBackup?(info: BackupInfo | null): void;
  onBalance?(info: BalanceInfo | null): void;
  onRequest?(info: RequestsInfo | null): void;
  onOpen?(): void;
  onClose?(): void;
}

const callbackRegistry: WanderConnectCallbacks[] = [];

let wanderInstance: WanderConnect | null = null;
let initPromise: Promise<WanderConnect | null> | null = null;
let hostElement: HTMLElement | null = null;
let lastAuthSnapshot: AuthInfo | null = null;

function ensureHost(): HTMLElement {
  if (hostElement && document.body.contains(hostElement)) return hostElement;
  const existing = document.getElementById('wander-connect-host');
  if (existing) {
    hostElement = existing;
    return existing;
  }
  const wrapper = document.createElement('div');
  wrapper.id = 'wander-connect-host';
  wrapper.style.position = 'absolute';
  wrapper.style.width = '1px';
  wrapper.style.height = '1px';
  wrapper.style.overflow = 'hidden';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.opacity = '0';
  document.body.appendChild(wrapper);
  hostElement = wrapper;
  return wrapper;
}

function dispatch(event: keyof WanderConnectCallbacks, ...args: unknown[]) {
  for (const callbacks of callbackRegistry) {
    const handler = callbacks[event];
    if (typeof handler === 'function') {
      try {
        (handler as (...received: unknown[]) => void)(...args);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[wander-connect] callback error', event, error);
        }
      }
    }
  }
}

function buildOptions(): ConstructorParameters<typeof WanderConnect>[0] {
  const host = ensureHost();
  const clientId = (import.meta.env.VITE_WANDER_CLIENT_ID as string | undefined) || 'FREE_TRIAL';
  const preferredTheme = (document.documentElement.dataset.theme as 'light' | 'dark' | undefined) || 'dark';

  return {
    clientId,
    theme: preferredTheme === 'light' ? 'light' : 'dark',
    button: {
      parent: host,
      label: false,
      customStyles: `:host { display: none !important; } #wanderConnectButtonHost { display: none !important; }`,
    },
    iframe: {
      routeLayout: {
        default: { type: 'modal' },
        auth: { type: 'modal' },
        'auth-request': { type: 'modal' },
        account: { type: 'modal' },
        settings: { type: 'modal' },
      },
      cssVars: {
        light: {},
        dark: {
          boxShadow: 'none',
        },
      },
    },
    onAuth(authInfo) {
      lastAuthSnapshot = authInfo;
      dispatch('onAuth', authInfo);
    },
    onBackup(backupInfo) {
      dispatch('onBackup', backupInfo ?? null);
    },
    onBalance(balanceInfo) {
      dispatch('onBalance', balanceInfo ?? null);
    },
    onRequest(requestsInfo) {
      dispatch('onRequest', requestsInfo ?? null);
    },
    onOpen() {
      dispatch('onOpen');
    },
    onClose() {
      dispatch('onClose');
    },
  } satisfies ConstructorParameters<typeof WanderConnect>[0];
}

async function bootstrapInstance(): Promise<WanderConnect | null> {
  if (typeof window === 'undefined') return null;
  if (window.wanderInstance) {
    wanderInstance = window.wanderInstance;
    return wanderInstance;
  }

  if (initPromise) return initPromise;

  initPromise = new Promise<WanderConnect | null>((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          resolve(createInstanceSafe());
        },
        { once: true }
      );
    } else {
      resolve(createInstanceSafe());
    }
  });

  return initPromise;
}

function createInstanceSafe(): WanderConnect | null {
  try {
    const instance = new WanderConnect(buildOptions());
    window.wanderInstance = instance;
    wanderInstance = instance;
    if (lastAuthSnapshot) dispatch('onAuth', lastAuthSnapshot);
    return instance;
  } catch (error) {
    console.error('[wander-connect] failed to initialize WanderConnect', error);
    wanderInstance = null;
    return null;
  } finally {
    initPromise = null;
  }
}

export async function registerWanderCallbacks(callbacks: WanderConnectCallbacks): Promise<WanderConnect | null> {
  callbackRegistry.push(callbacks);
  const instance = await bootstrapInstance();
  if (instance && lastAuthSnapshot) {
    callbacks.onAuth?.(lastAuthSnapshot);
  }
  return instance;
}

export async function ensureWander(): Promise<WanderConnect | null> {
  return bootstrapInstance();
}

export async function openWander(directAccess?: DirectAccess): Promise<void> {
  const instance = await bootstrapInstance();
  instance?.open(directAccess);
}

export async function closeWander(): Promise<void> {
  const instance = await bootstrapInstance();
  instance?.close();
}

export async function destroyWanderInstance(): Promise<void> {
  const instance = window.wanderInstance ?? wanderInstance;
  if (!instance) return;
  try {
    instance.destroy();
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[wander-connect] destroy failed', error);
    }
  }
  if (hostElement?.parentElement) {
    hostElement.parentElement.removeChild(hostElement);
  }
  hostElement = null;
  wanderInstance = null;
  window.wanderInstance = undefined;
  lastAuthSnapshot = null;
}

export function getWanderInstance(): WanderConnect | null {
  return window.wanderInstance ?? wanderInstance ?? null;
}

declare global {
  interface Window {
    wanderInstance?: WanderConnect;
  }
}
