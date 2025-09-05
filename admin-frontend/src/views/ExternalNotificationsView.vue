<template>
  <div class="mb-4">
    <div v-if="showObsBanner" class="relative p-3 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] flex items-start gap-3">
      <span class="icon os-icon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="11" stroke="currentColor" stroke-width="2" />
          <path d="M12 7v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <circle cx="12" cy="16" r="1" fill="currentColor" />
        </svg>
      </span>
      <div class="flex-1">
        <div class="font-semibold">{{ t('obsWsReminderTitle') }}</div>
        <div class="text-sm opacity-90">{{ t('obsWsReminderDesc') }}</div>
        <ul class="text-sm opacity-90 mt-2 list-disc pl-5">
          <li>{{ t('obsWsReminderNetwork') }}</li>
          <li>{{ t('obsWsReminderRemoteUrl') }}</li>
          <li>{{ t('obsWsReminderLocalMode') }}</li>
          <li>{{ t('obsWsReminderUpdateUrl') }}</li>
          <li>{{ t('obsWsReminderFirewall') }}</li>
          <li>{{ t('obsWsReminderNetworkConfig') }}</li>
          <li class="text-[#ca004b]">{{ t('obsWsReminderCopyUrl') }}</li>
        </ul>
      </div>
      <div class="absolute right-2 top-2">
        <button class="px-2 py-1 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-xs" @click="collapseObsBanner" :aria-label="t('commonHide') || 'Ocultar'">
          {{ t('commonHide') || 'Ocultar' }}
        </button>
      </div>
    </div>
    <div v-else class="p-2 rounded-os-sm border border-dashed border-[var(--card-border)] bg-[var(--bg-chat)] flex items-center justify-between">
      <div class="flex items-center gap-2 text-sm opacity-80">
        <span class="icon os-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="11" stroke="currentColor" stroke-width="2" />
            <path d="M12 7v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <circle cx="12" cy="16" r="1" fill="currentColor" />
          </svg>
        </span>
        <span>{{ t('obsWsReminderTitle') }}</span>
      </div>
      <button class="px-2 py-1 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-xs" @click="expandObsBanner" :aria-label="t('commonShow') || 'Mostrar'">
        {{ t('commonShow') || 'Mostrar' }}
      </button>
    </div>
  </div>

  <ExternalNotificationsPanel />
  <div class="mt-4">
    <LiveAnnouncementPanel />
  </div>
</template>
<script setup>
import ExternalNotificationsPanel from '../components/ExternalNotificationsPanel.vue';
import LiveAnnouncementPanel from '../components/LiveAnnouncementPanel.vue';
import { useI18n } from 'vue-i18n';
import { ref, onMounted } from 'vue';
const { t } = useI18n();

const OBS_BANNER_KEY = 'getty_obs_banner_collapsed_v1';
const showObsBanner = ref(true);
function collapseObsBanner(){
  showObsBanner.value = false;
  try { localStorage.setItem(OBS_BANNER_KEY, '1'); } catch {}
}
function expandObsBanner(){
  showObsBanner.value = true;
  try { localStorage.setItem(OBS_BANNER_KEY, '0'); } catch {}
}
onMounted(() => {
  try {
    const v = localStorage.getItem(OBS_BANNER_KEY);
    showObsBanner.value = v !== '1';
  } catch {}
});
</script>
