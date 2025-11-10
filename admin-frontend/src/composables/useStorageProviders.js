import { ref, reactive, computed, watch, effectScope } from 'vue';
import api from '../services/api';
import { useWalletSession } from './useWalletSession';

const PROVIDER_LABELS = {
  supabase: 'Supabase',
  turbo: 'Arweave',
};

const STORAGE_PREF_PREFIX = 'getty.storage-provider';

const state = reactive({
  providers: [],
  extras: new Map(),
  loading: false,
  error: '',
  activeProvider: '',
  preferredProvider: '',
  lastFetched: 0,
  userPreference: '',
});

const selectedProvider = ref('');
let inflightPromise = null;
const CACHE_TTL_MS = 60_000;

function normalizeProviderId(id) {
  if (!id || typeof id !== 'string') return '';
  const lower = id.trim().toLowerCase();
  if (lower === 'supabase') return 'supabase';
  if (lower === 'turbo' || lower === 'arweave') return 'turbo';
  return lower;
}

function labelFor(id) {
  const normalized = normalizeProviderId(id);
  if (normalized && PROVIDER_LABELS[normalized]) return PROVIDER_LABELS[normalized];
  return id ? id : 'Unknown';
}

function includeExtraProvider(id) {
  const normalized = normalizeProviderId(id);
  if (!normalized) return;
  if (!state.extras.has(normalized)) {
    state.extras.set(normalized, {
      id: normalized,
      label: labelFor(normalized),
      available: false,
      fromConfig: true,
    });
  }
}

function mergedProviders() {
  const seen = new Set();
  const output = [];
  for (const entry of state.providers) {
    if (!entry || typeof entry !== 'object') continue;
    const normalized = normalizeProviderId(entry.id);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push({
      id: normalized,
      label: labelFor(normalized),
      available: !!entry.available,
    });
  }
  for (const [normalized, entry] of state.extras.entries()) {
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    output.push({
      id: normalized,
      label: entry.label,
      available: !!entry.available,
    });
  }
  return output;
}

const providerOptions = computed(() => mergedProviders());

function storageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function preferenceKey(hash) {
  return `${STORAGE_PREF_PREFIX}:${hash}`;
}

function loadPreference(hash) {
  if (!hash || !storageAvailable()) return '';
  try {
    return normalizeProviderId(window.localStorage.getItem(preferenceKey(hash)));
  } catch {
    return '';
  }
}

function savePreference(hash, value) {
  if (!hash || !value || !storageAvailable()) return;
  try {
    window.localStorage.setItem(preferenceKey(hash), value);
  } catch {}
}

function setSelectedProvider(id) {
  const normalized = normalizeProviderId(id);
  selectedProvider.value = normalized;
}

function resolveInitialSelection(preferences = []) {
  const options = providerOptions.value;
  if (!options.length) return '';
  const candidates = [
    normalizeProviderId(state.userPreference),
    ...preferences.map((p) => normalizeProviderId(p)).filter(Boolean),
    normalizeProviderId(state.activeProvider),
    normalizeProviderId(state.preferredProvider),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const match = options.find((opt) => opt.id === candidate);
    if (match) return match.id;
  }
  return options[0].id;
}

async function fetchProviders(force = false) {
  const now = Date.now();
  if (!force && state.lastFetched && now - state.lastFetched < CACHE_TTL_MS) {
    return providerOptions.value;
  }
  if (inflightPromise && !force) {
    return inflightPromise;
  }
  state.loading = true;
  state.error = '';
  inflightPromise = api
    .get('/api/storage/providers')
    .then(({ data }) => {
      const list = Array.isArray(data?.providers) ? data.providers : [];
      state.providers = list.map((entry) => ({
        id: normalizeProviderId(entry.id),
        label: labelFor(entry.id),
        available: !!entry.available,
      }));
      state.activeProvider = normalizeProviderId(data?.activeProvider);
      state.preferredProvider = normalizeProviderId(data?.preferredProvider);
      state.lastFetched = Date.now();
      if (!selectedProvider.value) {
        const next = resolveInitialSelection();
        if (next) setSelectedProvider(next);
      }
      return providerOptions.value;
    })
    .catch((error) => {
      state.error = error?.message || 'storage_provider_fetch_failed';
      return providerOptions.value;
    })
    .finally(() => {
      state.loading = false;
      inflightPromise = null;
    });
  return inflightPromise;
}

export function useStorageProviders() {
  return {
    providerOptions,
    loading: computed(() => state.loading),
    error: computed(() => state.error),
    activeProvider: computed(() => state.activeProvider),
    preferredProvider: computed(() => state.preferredProvider),
    selectedProvider,
    fetchProviders,
    setSelectedProvider,
    registerProvider(id) {
      includeExtraProvider(id);
      if (!selectedProvider.value) {
        setSelectedProvider(resolveInitialSelection([id]));
      }
    },
    ensureSelection(preferences = []) {
      if (!providerOptions.value.length) return;
      const current = normalizeProviderId(selectedProvider.value);
      if (current) {
        const currentAvailable = providerOptions.value.some(
          (opt) => opt.id === current && opt.available
        );
        if (currentAvailable) {
          return;
        }
      }
      const resolved = resolveInitialSelection(preferences);
      if (resolved && selectedProvider.value !== resolved) {
        setSelectedProvider(resolved);
      }
    },
    isProviderAvailable(id) {
      const normalized = normalizeProviderId(id);
      return providerOptions.value.some((p) => p.id === normalized && p.available);
    },
  };
}

const preferenceScope = effectScope();

preferenceScope.run(() => {
  const wallet = useWalletSession();

  watch(
    () => wallet.walletHash.value,
    (hash, prev) => {
      state.userPreference = hash ? loadPreference(hash) : '';
      if (!hash) {
        selectedProvider.value = '';
        return;
      }
      if (hash !== prev) {
        selectedProvider.value = '';
      }
      const resolved = resolveInitialSelection([state.userPreference]);
      if (resolved) {
        setSelectedProvider(resolved);
      }
    },
    { immediate: true }
  );

  watch(
    providerOptions,
    () => {
      const current = normalizeProviderId(selectedProvider.value);
      if (current) {
        const stillAvailable = providerOptions.value.some(
          (opt) => opt.id === current && opt.available
        );
        if (stillAvailable) {
          return;
        }
      }
      const resolved = resolveInitialSelection();
      if (resolved && resolved !== selectedProvider.value) {
        setSelectedProvider(resolved);
      }
    },
    { immediate: false }
  );

  watch(
    selectedProvider,
    (val) => {
      const hash = wallet.walletHash.value;
      if (!hash || !val) return;
      state.userPreference = val;
      savePreference(hash, val);
    },
    { flush: 'post' }
  );
});
