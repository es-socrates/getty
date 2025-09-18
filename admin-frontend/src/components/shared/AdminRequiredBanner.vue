<template>
  <div
    v-if="visible"
    class="admin-banner mt-[-8px] mb-4 rounded-lg border border-border bg-card/70 backdrop-blur px-4 py-3 flex items-start gap-3 text-sm"
    role="status"
    aria-live="polite">
    <div class="mt-0.5 text-[var(--text-secondary)]" aria-hidden="true">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12" y2="16" />
      </svg>
    </div>
    <div class="flex-1">
      <p class="text-[var(--text-primary)] leading-snug">
        {{ t('adminBannerTitle') }}
      </p>
      <div class="mt-2">
        <a
          href="/new-session"
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-[var(--bg-chat)] hover:bg-card transition-colors"
          :aria-label="t('adminBannerCta')">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
          <span class="font-medium">{{ t('adminBannerCta') }}</span>
        </a>
      </div>
    </div>
    <button
      class="ml-2 p-1 rounded hover:bg-[var(--bg-chat)] text-[var(--text-secondary)]"
      @click="dismiss"
      :aria-label="t('commonClose')">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  </div>
  <div v-else aria-hidden="true"></div>
</template>
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';

const { t } = useI18n();
const visible = ref(false);

function setFromStatus(supported, active) {
  try {
    const dismissed = localStorage.getItem('admin_required_banner_dismissed') === '1';
    visible.value = !!supported && !active && !dismissed;
  } catch {
    visible.value = !!supported && !active;
  }
}

function dismiss() {
  try {
    localStorage.setItem('admin_required_banner_dismissed', '1');
  } catch {}
  visible.value = false;
}

async function checkStatus() {
  try {
    const r = await api.get('/api/session/status').catch(() => ({ data: {} }));
    const supported = !!r?.data?.supported;
    const active = !!r?.data?.active;
    setFromStatus(supported, active);
  } catch {
    // ignore
  }
}

function onAdminRequired() {
  try {
    localStorage.removeItem('admin_required_banner_dismissed');
  } catch {}
  visible.value = true;
}

onMounted(() => {
  checkStatus();
  try {
    window.addEventListener('getty:admin-required', onAdminRequired);
  } catch {}
});
onBeforeUnmount(() => {
  try {
    window.removeEventListener('getty:admin-required', onAdminRequired);
  } catch {}
});
</script>

<style scoped></style>
