<template>
  <div v-if="session.state.address" class="relative group">
    <button
      v-if="hasValidSession"
      type="button"
      class="inline-flex items-center gap-1 rounded border border-red-500/40 bg-red-600/10 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-600/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
      @click="logout">
      <span class="i-material-symbols-logout-rounded text-base" /> Logout
    </button>

    <button
      v-else-if="session.state.address && session.state.sessionStale"
      type="button"
      class="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-400/10 px-2 py-1 text-xs font-medium text-amber-200 hover:bg-amber-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
      @click="reconnect">
      <span class="i-material-symbols-refresh-rounded text-base" /> Reconnect
    </button>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue';
import { useWanderSession } from '../wander/store/wanderSession';

const session = useWanderSession();
const busy = ref(false);

async function globalLogoutSequence() {
  try {
    await fetch('/api/auth/wander/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch {}

  try {
    localStorage.setItem('getty_logout', String(Date.now()));
    localStorage.removeItem('wanderWalletConnected');
    localStorage.removeItem('arweaveAddress');
  } catch {}

  try {
    await session.logout();
  } catch {}
  try {
    window.location.href = '/';
  } catch {}
}

const logout = async () => {
  if (busy.value) return;
  busy.value = true;
  try {
    await globalLogoutSequence();
  } catch (e) {
    console.warn('[global-logout] failed', e?.message || e);
    busy.value = false;
  }
};
const reconnect = () => session.attemptReconnect?.();
const hasValidSession = computed(() => !!session.state.address && !session.state.sessionStale);
</script>
