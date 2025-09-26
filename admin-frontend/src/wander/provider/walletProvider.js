function b64ToUrl(b64) {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToB64Url(bytes) {
  try {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    let str = '';
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return b64ToUrl(btoa(str));
  } catch { return ''; }
}

function adaptWindowProvider(raw) {
  if (!raw) return null;
  const provider = raw;
  const cache = { address: null, addressTs: 0, publicKey: null, publicKeyTs: 0 };
  let polling = false;
  const listeners = new Set();
  function emit(evt, data) { listeners.forEach(fn => { try { fn(evt, data); } catch {} }); }
  function startPolling() {
    if (polling) return; polling = true;
    let last = null;
    const interval = setInterval(async () => {
      try {
        if (document.hidden) return;

        let a = '';
        if (provider.getActiveAddress) a = await provider.getActiveAddress();
        else if (provider.getAddress) a = await provider.getAddress();
        else if (provider.address) a = provider.address;
        if (a && a !== last) {
          const prev = last; last = a; cache.address = a; cache.addressTs = Date.now(); emit('account-changed', { previous: prev, current: a });
        }
      } catch {}
    }, 1500);
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => clearInterval(interval));
    }
  }

  const PERMISSION_STEPS = [
    ['ACCESS_ADDRESS'],
    ['ACCESS_ADDRESS','ACCESS_PUBLIC_KEY','SIGN_MESSAGE','SIGNATURE'],
    ['ACCESS_ADDRESS','ACCESS_PUBLIC_KEY','SIGN_MESSAGE','SIGNATURE','SIGN_TRANSACTION'],
    ['ACCESS_ADDRESS','ACCESS_PUBLIC_KEY','SIGN_MESSAGE','SIGNATURE','SIGN_TRANSACTION','DISPATCH']
  ];
  async function requestPermissions(step) {
    const perms = PERMISSION_STEPS[step] || [];
    if (!perms.length) return;
    try {
      if (provider.connect) await provider.connect(perms);
      else if (provider.connectPermissions) await provider.connectPermissions(perms);
    } catch {
    }
  }
  const granted = new Set();
  async function ensurePermissionNeeded(targets) {
    const missing = targets.filter(p => !granted.has(p));
    if (!missing.length) return;
    for (let i=0;i<PERMISSION_STEPS.length;i++) {
      await requestPermissions(i);
      try {
        if (provider.getPermissions) {
          const current = await provider.getPermissions();
          if (Array.isArray(current)) current.forEach(p=>granted.add(p));
        }
      } catch {}
      const still = targets.filter(p => !granted.has(p));
      if (!still.length) break;
    }
  }
  return {
    hasProvider: true,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async ensurePermissions(minimal = ['ACCESS_ADDRESS']) { await ensurePermissionNeeded(minimal); startPolling(); },
    async getActiveAddress() {
      const now = Date.now();
      if (cache.address && (now - cache.addressTs) < 10000) return cache.address;
      let a = '';
      if (provider.getActiveAddress) a = await provider.getActiveAddress();
      else if (provider.getAddress) a = await provider.getAddress();
      else if (provider.address) a = provider.address;
      cache.address = a || '';
      cache.addressTs = now;
      return cache.address;
    },
    async getActivePublicKey() {
      const now = Date.now();
      if (cache.publicKey && (now - cache.publicKeyTs) < 15000) return cache.publicKey;
      let pk = '';
      if (provider.getActivePublicKey) pk = await provider.getActivePublicKey();
      else if (provider.getPublicKey) pk = await provider.getPublicKey();
      else if (provider.getOwner) pk = await provider.getOwner();
      cache.publicKey = pk || '';
      cache.publicKeyTs = now;
      return cache.publicKey;
    },
    async disconnect() {
      try { if (provider.disconnect) await provider.disconnect(); } catch {}
      cache.address = null; cache.publicKey = null; granted.clear();
      if (typeof window !== 'undefined') emit('disconnected', {});
    },
    async signMessage(message) {
      const win = typeof window !== 'undefined' ? window : {};
      const debug = win.GETTY_WALLET_AUTH_DEBUG === '1';
      win.__wanderDebug = win.__wanderDebug || {};
      const cacheKey = '__wallet_sig_strategy_v1';

      function toBytes(m) {
        if (m instanceof Uint8Array) return m;
        if (m instanceof ArrayBuffer) return new Uint8Array(m);
        if (typeof m === 'string') return new TextEncoder().encode(m);
        if (typeof m === 'object' && m && (m.data || m.message)) {
          const inner = m.data || m.message;
          return toBytes(inner);
        }
        return new TextEncoder().encode(String(m));
      }
      const originalMessage = message;
      const data = toBytes(message);
      const dataBuffer = data.buffer;
      const errors = [];
      let successLabel = null;
      async function attempt(label, fn) {
        try {
          const r = await fn();
          if (r) { if (debug) console.warn('[walletProvider][attempt-ok]', label); return r; }
        } catch (e) {
          errors.push(label+': '+(e?.message||e)); if (debug) console.warn('[walletProvider][attempt-fail]', label, e?.message||e);
        }
        return null;
      }

      let signed = null;

      if (!signed && typeof provider.signMessage === 'function') {
        signed = await attempt('signMessage(ArrayBuffer)', () => provider.signMessage(dataBuffer));
        if (signed) successLabel = 'signMessage(ArrayBuffer)';
      }

      if (!signed && typeof provider.signMessage === 'function') {
        signed = await attempt('signMessage(Uint8Array)', () => provider.signMessage(data));
        if (signed) successLabel = 'signMessage(Uint8Array)';
      }

      if (!signed && typeof provider.signMessage === 'function') {
        signed = await attempt('signMessage({data})', () => provider.signMessage({ data: dataBuffer }));
        if (signed) successLabel = 'signMessage({data})';
      }

      if (!signed && typeof provider.signMessage === 'function') {
        signed = await attempt('signMessage(string)', () => provider.signMessage(String(originalMessage)));
        if (signed) successLabel = 'signMessage(string)';
      }

      if (!signed) {
        win.__wanderDebug.lastSignatureAttempts = errors.slice();
        throw new Error('Wander signMessage API failed: '+errors.join(' | '));
      }

      const sigRaw = signed;
      let ownerRaw = null;

      try { if (provider.getActivePublicKey) ownerRaw = await provider.getActivePublicKey(); } catch {}
      if (!ownerRaw) { try { if (provider.getPublicKey) ownerRaw = await provider.getPublicKey(); } catch {} }
      if (!ownerRaw) { try { if (provider.getOwner) ownerRaw = await provider.getOwner(); } catch {} }

      const signature = typeof sigRaw === 'string' ? b64ToUrl(sigRaw) : bytesToB64Url(sigRaw);
      const publicKey = typeof ownerRaw === 'string' ? b64ToUrl(ownerRaw) : bytesToB64Url(ownerRaw);

      if (!signature || !publicKey) throw new Error('Incomplete signature (missing signature or publicKey)');

      if (successLabel && win.localStorage) {
        try { win.localStorage.setItem(cacheKey, successLabel); } catch {}
      }

      win.__wanderDebug.signatureSuccess = true;
      win.__wanderDebug.signatureErrors = errors.slice();
      win.__wanderDebug.successStrategy = successLabel;
      if (import.meta.env.DEV && debug) console.warn('[walletProvider] sign success via', successLabel, 'errors=', errors.length);

      return { signature, publicKey, strategy: successLabel, method: successLabel };
    }
  };
}

export async function getWalletProvider() {
  const win = typeof window !== 'undefined' ? window : {};
  const candidates = [win.wander, win.arweaveWallet, win.arconnect];
  for (const c of candidates) {
    const adapted = adaptWindowProvider(c);
    if (adapted) return adapted;
  }
  if (import.meta.env.VITE_WANDER_SDK_PKG) {
    console.warn('[walletProvider] VITE_WANDER_SDK_PKG is defined but ignored (extension-only mode).');
  }
  return {
    hasProvider: false,
    async ensurePermissions() { throw new Error('No wallet extension detected'); },
    async getActiveAddress() { throw new Error('No wallet extension detected'); },
    async signMessage() { throw new Error('No wallet extension detected'); }
  };
}

export function isDummyAllowed() {
  return import.meta.env.DEV || (typeof window !== 'undefined' && window.__GETTY_DUMMY_WALLET === true);
}
