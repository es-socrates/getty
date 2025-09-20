import { computed } from 'vue';
import { useWanderSession } from '../wander/store/wanderSession';

export function useWalletSession() {
  const { state, refreshSession, logout, markWsConnected } = useWanderSession();

  const walletHash = computed(() => state.walletHash);
  const address = computed(() => state.address);
  const capabilities = computed(() => state.capabilities || []);
  const loading = computed(() => state.loading);
  const error = computed(() => state.error);
  const canReadConfig = computed(() => capabilities.value.includes('config.read'));
  const canWriteConfig = computed(() => capabilities.value.includes('config.write'));
  const hasSession = computed(() => !!walletHash.value && !!address.value);

  function withAuth(urlBase) { return urlBase; }

  return {
    walletHash,
    address,
    capabilities,
    loading,
    error,
    canReadConfig,
    canWriteConfig,
    hasSession,
    refresh: refreshSession,
    logout,
    markWsConnected,
    withAuth,
  };
}
