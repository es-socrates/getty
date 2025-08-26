<template>
  <section class="admin-tab active">
    <OsCard :title="t('statusModules')" class="mb-4">
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;">
        <div v-for="m in modulesList" :key="m.key" class="os-subtle p-3 rounded-os-sm">
          <div class="flex items-center gap-2 font-semibold text-sm">
            <span :class="['w-2 h-2 rounded-full', m.active ? 'bg-[#16a34a]' : 'bg-neutral-400']"></span>
            {{ m.label }}
          </div>
          <div class="os-card-meta" v-if="m.extra">{{ m.extra }}</div>
        </div>
      </div>
    </OsCard>

    <div class="mb-4">
      <MetricsPanel />
    </div>

    <OsCard :title="t('statusSystem')" class="mb-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div class="p-3 os-subtle rounded-os-sm">
          <div class="os-th text-xs">{{ t('statusLocale') }}</div>
          <div class="text-sm font-semibold">{{ locale }}</div>
        </div>
        <div class="p-3 os-subtle rounded-os-sm">
          <div class="os-th text-xs">{{ t('statusTime') }}</div>
          <div class="text-sm font-semibold">{{ now }}</div>
        </div>
        <div class="p-3 os-subtle rounded-os-sm">
          <div class="os-th text-xs">{{ t('statusUptime') }}</div>
          <div class="text-xl font-semibold">{{ formattedUptime }}</div>
        </div>
        <div class="p-3 os-subtle rounded-os-sm">
          <div class="os-th text-xs">{{ t('statusWsClients') }}</div>
          <div class="text-xl font-semibold">{{ system?.wsClients ?? 0 }}</div>
        </div>
        <div class="p-3 os-subtle rounded-os-sm">
          <div class="os-th text-xs">ENV</div>
          <div class="inline-flex items-center px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs font-mono uppercase tracking-wide">{{ system?.env || '—' }}</div>
        </div>
      </div>
    </OsCard>
  <OsCard :title="t('sessionTools')" class="mb-4">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        <div class="p-3 os-subtle rounded-os-sm flex flex-col gap-2">
          <div class="os-th text-xs">{{ t('regeneratePublicToken') }}</div>
          <div class="flex gap-2 items-center">
            <button
              class="px-3 py-2 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm"
              @click="regeneratePublic"
        :disabled="regenLoading || !sessionStatus.supported || !sessionStatus.active"
            >
              {{ regenLoading ? t('commonUpdating') : t('regeneratePublicToken') }}
            </button>
          </div>
          <div v-if="lastPublicToken" class="flex gap-2 items-center">
            <input :value="lastPublicToken" readonly class="flex-1 px-2 py-1 rounded-os-sm bg-[var(--bg-chat)] border border-[var(--card-border)] text-xs font-mono" />
            <button
              class="px-2 py-1 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-xs"
              @click="copyToken"
            >
              {{ t('commonCopy') || 'Copy' }}
            </button>
          </div>
        </div>
        <div class="p-3 os-subtle rounded-os-sm flex flex-col gap-2">
          <div class="os-th text-xs">{{ t('exportConfig') }}</div>
          <div>
            <button
              class="px-3 py-2 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm"
              @click="exportCfg"
            >
              {{ t('exportConfig') }}
            </button>
          </div>
        </div>
        <div class="p-3 os-subtle rounded-os-sm flex flex-col gap-2">
          <div class="os-th text-xs">{{ t('importConfig') }}</div>
          <div class="flex flex-col gap-2">
            <input ref="fileInputEl" type="file" accept="application/json,.json" @change="onImportFile" style="display:none" aria-hidden="true" tabindex="-1" />
            <button
              class="px-3 py-2 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm disabled:opacity-50"
              :disabled="importing"
              @click="triggerFile"
            >
              {{ importing ? t('commonLoading') : t('importConfig') }}
            </button>
            <div v-if="importApplied.lastTip !== null || importApplied.tipGoal !== null || importApplied.socialmedia !== null || importApplied.external !== null" class="flex flex-wrap gap-2 text-xs mt-1">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)]">
                {{ t('lastTip') }}:
                <span :class="importApplied.lastTip ? 'text-green-500' : 'text-red-500'">{{ importApplied.lastTip ? '✓' : '✗' }}</span>
              </span>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)]">
                {{ t('tipGoal') }}:
                <span :class="importApplied.tipGoal ? 'text-green-500' : 'text-red-500'">{{ importApplied.tipGoal ? '✓' : '✗' }}</span>
              </span>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)]">
                {{ t('socialMediaTitle') }}:
                <span :class="importApplied.socialmedia ? 'text-green-500' : 'text-red-500'">{{ importApplied.socialmedia ? '✓' : '✗' }}</span>
              </span>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)]">
                {{ t('externalNotificationsTitle') }}:
                <span :class="importApplied.external ? 'text-green-500' : 'text-red-500'">{{ importApplied.external ? '✓' : '✗' }}</span>
              </span>
            </div>
          </div>
        </div>
        <div class="p-3 os-subtle rounded-os-sm flex flex-col gap-2" v-if="sessionStatus.supported && !sessionStatus.active">
          <div class="os-th text-xs">{{ t('newSession') }}</div>
          <div>
            <a href="/new-session" class="px-3 py-2 inline-block rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm">
              {{ t('newSession') }}
            </a>
          </div>
        </div>
      </div>
    </OsCard>
    <div class="divider"></div>
    <div class="mb-4">
      <ActivityPanel />
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import OsCard from '../components/os/OsCard.vue'
import ActivityPanel from '../components/ActivityPanel.vue'
import MetricsPanel from '../components/MetricsPanel.vue'
import { pushToast } from '../services/toast'

const { t, locale } = useI18n();
const modulesList = ref([]);
const now = ref(new Date().toLocaleString());
const system = ref(null);
const regenLoading = ref(false);
const lastPublicToken = ref('');
const sessionStatus = ref({ supported: false, active: false });
const importing = ref(false);
const fileInputEl = ref(null);
const importApplied = ref({ lastTip: null, tipGoal: null, socialmedia: null, external: null });
let importAppliedTimer = null;

function clearImportApplied() {
  importApplied.value = { lastTip: null, tipGoal: null, socialmedia: null, external: null };
}

function formatUptime(seconds) {
  if (seconds < 60) return t('statusSeconds', { n: seconds });
  if (seconds < 3600) return t('statusMinutes', { n: Math.floor(seconds / 60) });
  if (seconds < 86400) return t('statusHours', { n: Math.floor(seconds / 3600) });
  return t('statusDays', { n: Math.floor(seconds / 86400) });
}
const formattedUptime = computed(() =>
  system.value ? formatUptime(system.value.uptimeSeconds || 0) : ''
);

async function load() {
  try {
    const r = await axios.get('/api/modules');
    const d = r.data;
    system.value = d.system || null;
  modulesList.value = [
      { key: 'lastTip', label: t('lastTip'), active: d.lastTip?.active !== false },
      { key: 'tipGoal', label: t('tipGoal'), active: d.tipGoal?.active !== false },
      { key: 'chat', label: t('chat'), active: d.chat?.active !== false },
      {
        key: 'announcement',
        label: t('announcementTitle'),
        active: d.announcement?.active,
        extra: d.announcement
          ? t('statusAnnouncements', {
              enabled: d.announcement.enabledMessages,
              total: d.announcement.totalMessages,
            })
          : '',
      },
      {
        key: 'socialmedia',
        label: t('socialMediaTitle'),
        active: d.socialmedia?.configured,
        extra: d.socialmedia ? t('statusItems', { n: d.socialmedia.entries }) : '',
      },
      {
        key: 'externalNotifications',
        label: t('externalNotificationsTitle'),
        active: d.externalNotifications?.active,
      },
      {
        key: 'liveviews',
        label: t('liveviewsTitle'),
        active: !!d.liveviews?.active,
        extra: d.liveviews?.claimid ? t('statusItems', { n: 1 }) : '',
      },
      {
        key: 'raffle',
        label: t('raffleTitle'),
        active: !!d.raffle?.active,
        extra: (() => {
          const parts = [];
          if (typeof d.raffle?.participants?.length === 'number') {
            parts.push(t('statusItems', { n: d.raffle.participants.length }));
          }
          if (typeof d.raffle?.totalWinners === 'number') {
            parts.push(t('statusRaffleWinners', { n: d.raffle.totalWinners }));
          }
          if (d.raffle?.paused) parts.push(t('rafflePaused'));
          return parts.join(' • ');
        })(),
      },
    ];
    try {
      const ss = await axios.get('/api/session/status');
      sessionStatus.value = {
        supported: !!ss?.data?.supported,
        active: !!ss?.data?.active,
      };
    } catch {}
  } catch {}
}
onMounted(() => {
  load();
  setInterval(() => {
    now.value = new Date().toLocaleString();
    load();
  }, 60000);

  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        clearImportApplied();
        if (importAppliedTimer) { clearTimeout(importAppliedTimer); importAppliedTimer = null; }
      }
    });
  } catch {}
});

onUnmounted(() => {
  try { if (importAppliedTimer) clearTimeout(importAppliedTimer); } catch {}
});

async function regeneratePublic() {
  try {
    regenLoading.value = true;
    const r = await axios.post('/api/session/regenerate-public');
    const tok = r?.data?.publicToken;
    if (tok) {
      lastPublicToken.value = tok;
    }
    pushToast({ i18nKey: 'tokenRegenerated', type: 'success', timeout: 2500 });
  } catch (e) {
    const msg = e?.response?.data?.error || 'Failed';
    pushToast({ message: msg, type: 'error', timeout: 3000, autoTranslate: false });
  } finally {
    regenLoading.value = false;
  }
}

async function copyToken() {
  try {
    await navigator.clipboard.writeText(lastPublicToken.value || '');
    pushToast({ i18nKey: 'urlCopied', type: 'success', timeout: 2000 });
  } catch {}
}

function exportCfg() {
  try {
    window.location.href = '/api/session/export';
  } catch {}
}

function triggerFile() {
  try {
    if (!fileInputEl.value) {
      const inputs = document.querySelectorAll('input[type="file"][accept*="json"]');
      if (inputs && inputs[0]) inputs[0].click();
    } else {
      fileInputEl.value.click();
    }
  } catch {}
}

async function onImportFile(e) {
  try {
    const file = e?.target?.files?.[0];
    if (!file) return;
    importing.value = true;
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    if (!data || typeof data !== 'object') {
      pushToast({ message: 'Invalid JSON', type: 'error', timeout: 2500, autoTranslate: false });
      return;
    }
    const r = await axios.post('/api/session/import', data);
    if (r?.data?.ok) {
      const restored = r?.data?.restored || {};
      importApplied.value = {
        lastTip: typeof restored.lastTip === 'boolean' ? restored.lastTip : null,
        tipGoal: typeof restored.tipGoal === 'boolean' ? restored.tipGoal : null,
        socialmedia: typeof restored.socialmedia === 'boolean' ? restored.socialmedia : null,
        external: typeof restored.external === 'boolean' ? restored.external : null,
      };
      pushToast({ message: t('importedOk'), type: 'success', timeout: 2500, autoTranslate: false });
      load();

      try {
        if (importAppliedTimer) clearTimeout(importAppliedTimer);
        importAppliedTimer = setTimeout(() => { clearImportApplied(); importAppliedTimer = null; }, 6000);
      } catch {}
    } else {
      pushToast({ message: 'Import failed', type: 'error', timeout: 2500, autoTranslate: false });
    }
  } catch (err) {
    const msg = err?.response?.data?.error || 'Import failed';
    pushToast({ message: msg, type: 'error', timeout: 3000, autoTranslate: false });
  } finally {
    importing.value = false;
    try { e.target.value = ''; } catch {}
  }
}
</script>
