const { getStorage: getSupabaseStorage, SupabaseStorage } = require('../supabase-storage');

const STORAGE_PROVIDERS = {
  SUPABASE: 'supabase',
  TURBO: 'turbo',
};

let turboModule = null;
let turboModuleLoaded = false;
let turboModuleErrorLogged = false;

function loadTurboModule() {
  if (turboModuleLoaded) {
    return turboModule;
  }
  turboModuleLoaded = true;
  try {
    turboModule = require('./turbo-storage');
  } catch (error) {
    turboModule = null;
    if (!turboModuleErrorLogged && process.env.NODE_ENV !== 'production') {
      turboModuleErrorLogged = true;
      console.warn('[storage] Turbo storage module unavailable:', error.message);
    }
  }
  return turboModule;
}

function isTurboConfiguredLazy() {
  const mod = loadTurboModule();
  if (!mod || typeof mod.isTurboConfigured !== 'function') return false;
  return mod.isTurboConfigured();
}

function getTurboStorageLazy() {
  const mod = loadTurboModule();
  if (!mod || typeof mod.getTurboStorage !== 'function') return null;
  return mod.getTurboStorage();
}

function isSupabaseConfigured() {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
}

function adaptInstance(instance, provider) {
  if (!instance) return null;
  if (!instance.provider) {
    try {
      instance.provider = provider;
    } catch (_error) {
      // ignore if read only
    }
  }
  return instance;
}

function normalizeProvider(provider) {
  if (!provider || typeof provider !== 'string') return null;
  const lower = provider.toLowerCase();
  if (lower === STORAGE_PROVIDERS.SUPABASE) return STORAGE_PROVIDERS.SUPABASE;
  if (lower === 'turbo' || lower === 'arweave') return STORAGE_PROVIDERS.TURBO;
  return null;
}

function collectProviderOrder(preferred) {
  const order = [];
  const normalizedPreferred = normalizeProvider(preferred);
  const envProvider = normalizeProvider(process.env.STORAGE_PROVIDER);
  if (normalizedPreferred) order.push(normalizedPreferred);
  if (envProvider) order.push(envProvider);
  // default order
  order.push(STORAGE_PROVIDERS.TURBO, STORAGE_PROVIDERS.SUPABASE);
  const deduped = [];
  const seen = new Set();
  for (const provider of order) {
    if (!provider || seen.has(provider)) continue;
    seen.add(provider);
    deduped.push(provider);
  }
  return deduped;
}

function getStorage(preferredProvider) {
  const order = collectProviderOrder(preferredProvider);
  for (const provider of order) {
    if (provider === STORAGE_PROVIDERS.SUPABASE) {
      if (!isSupabaseConfigured()) continue;
      const instance = getSupabaseStorage();
      if (instance) {
        adaptInstance(instance, STORAGE_PROVIDERS.SUPABASE);
        return instance;
      }
    }
    if (provider === STORAGE_PROVIDERS.TURBO) {
      if (!isTurboConfiguredLazy()) continue;
      const instance = getTurboStorageLazy();
      if (instance) {
        adaptInstance(instance, STORAGE_PROVIDERS.TURBO);
        return instance;
      }
    }
  }
  return null;
}

function getConfiguredProvider() {
  const storage = getStorage();
  return storage ? storage.provider || null : null;
}

module.exports = {
  getStorage,
  getConfiguredProvider,
  isSupabaseConfigured,
  isTurboConfigured: isTurboConfiguredLazy,
  STORAGE_PROVIDERS,
  SupabaseStorage,
};

Object.defineProperty(module.exports, 'TurboStorage', {
  enumerable: true,
  get() {
    const mod = loadTurboModule();
    return mod ? mod.TurboStorage : undefined;
  }
});

Object.defineProperty(module.exports, 'getTurboStorage', {
  enumerable: true,
  get() {
    return getTurboStorageLazy;
  }
});
