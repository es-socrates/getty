<template>
  <div v-if="session.state.address" class="relative group">
    <button
      v-if="hasValidSession"
      type="button"
      class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-card transition-colors"
      @click="logout"
      :aria-label="t('logout')">
      <svg
        viewBox="0 0 24 24"
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true">
        <rect x="6" y="3" width="12" height="18" rx="1" />
        <path d="M10 12h.01" />
      </svg>
      <span>{{ t('logout') }}</span>
    </button>

    <button
      v-else-if="session.state.address && session.state.sessionStale"
      type="button"
      class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-card transition-colors"
      @click="reconnect"
      :aria-label="t('reconnect')">
      <svg
        viewBox="0 0 24 24"
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true">
        <rect x="6" y="3" width="12" height="18" rx="1" />
        <path d="M10 12h.01" />
      </svg>
      <span>{{ t('reconnect') }}</span>
    </button>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue';
import { useWanderSession } from '../wander/store/wanderSession';
import { useI18n } from 'vue-i18n';

const session = useWanderSession();
const busy = ref(false);
const { t } = useI18n();

async function globalLogoutSequence() {
  try {
    const wander = window.wanderInstance;
    if (wander && typeof wander.signOut === 'function') {
      await wander.signOut().catch(() => undefined);
    }
  } catch {}

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
