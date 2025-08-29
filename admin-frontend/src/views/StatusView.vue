<template>
  <section class="admin-tab active">
    <div v-if="showInfo" style="position: fixed; inset: 0; z-index: 50;" aria-modal="true" role="dialog">
      <div style="position:absolute; inset:0; background:rgba(0,0,0,.45); backdrop-filter: blur(3px);" @click="showInfo=false"></div>
      <div style="position:relative; max-width: 560px; margin: 12vh auto; background: var(--bg-chat); color: var(--card-text); border:1px solid var(--card-border); border-radius: 8px; padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.35);">
        <div class="text-lg font-semibold mb-1">{{ t('tokenModalTitle') }}</div>
        <div class="opacity-90 text-sm leading-6 mb-3">{{ t('tokenModalBody') }}</div>
        <div class="flex gap-2 justify-end">
          <button class="px-3 py-2 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm" @click="showInfo=false">{{ t('commonClose') || 'Close' }}</button>
          <button class="px-3 py-2 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm" @click="onCreateTokenClick">{{ t('createTokenNow') }}</button>
        </div>
      </div>
    </div>

    <div v-if="showTokenNudge" class="mb-4">
      <div class="p-3 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] flex flex-col gap-2">
        <div class="font-semibold">{{ t('tokenNudgeTitle') }}</div>
        <div class="text-sm opacity-90">{{ t('tokenNudgeBody') }}</div>
        <div class="flex gap-2 flex-wrap mt-1">
          <button class="px-3 py-2 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm" @click="onCreateTokenClick">
            {{ t('createTokenNow') }}
          </button>
          <button class="px-3 py-2 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm" @click="showInfo = true">
            {{ t('whyNeedToken') }}
          </button>
          <button class="px-3 py-2 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm" @click="onMaybeLater">
            {{ t('maybeLater') }}
          </button>
        </div>
      </div>
    </div>

    <OsCard :title="t('statusModules')" class="mb-4">
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;">
        <div v-for="m in modulesList" :key="m.key" class="os-subtle p-3 rounded-os-sm" :title="m.tooltip || ''">
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
            <button
              class="px-3 py-2 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm disabled:opacity-50"
              :disabled="!sessionStatus.supported || !sessionStatus.active || !lastPublicToken"
              @click="exportPublicToken"
            >
              {{ t('exportPublicToken') || 'Export public token' }}
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
            <div v-if="importApplied.lastTip !== null || importApplied.tipGoal !== null || importApplied.socialmedia !== null || importApplied.external !== null || importApplied.liveviews !== null || importApplied.announcement !== null" class="flex flex-wrap gap-2 text-xs mt-1">
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
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)]">
                {{ t('liveviewsTitle') }}:
                <span :class="importApplied.liveviews ? 'text-green-500' : 'text-red-500'">{{ importApplied.liveviews ? '✓' : '✗' }}</span>
              </span>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)]">
                {{ t('announcementTitle') }}:
                <span :class="importApplied.announcement ? 'text-green-500' : 'text-red-500'">{{ importApplied.announcement ? '✓' : '✗' }}</span>
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
const nudgeReady = ref(false);
const importing = ref(false);
const fileInputEl = ref(null);
const importApplied = ref({ lastTip: null, tipGoal: null, socialmedia: null, external: null, liveviews: null, announcement: null });
let importAppliedTimer = null;

const showInfo = ref(false);
const showTokenNudge = computed(() => {
  try {
    const dismissed = localStorage.getItem('getty_token_nudge_v1') === '1';

    return (
      nudgeReady.value &&
      !regenLoading.value &&
      sessionStatus.value.supported &&
      (
        !sessionStatus.value.active ||
        !lastPublicToken.value
      ) &&
      !dismissed
    );
  } catch {
    return (
      nudgeReady.value &&
      !regenLoading.value &&
      sessionStatus.value.supported &&
      (
        !sessionStatus.value.active ||
        !lastPublicToken.value
      )
    );
  }
});

function dismissNudge() {
  try { localStorage.setItem('getty_token_nudge_v1', '1'); } catch {}
}

function onMaybeLater() {
  dismissNudge();
  try { pushToast({ i18nKey: 'tokenNudgeDismissed', type: 'info', timeout: 2500 }); } catch {}
}

async function onCreateTokenClick() {
  try {
    if (!sessionStatus.value.active) {
      window.location.href = '/new-session';
      return;
    }
    await regeneratePublic();
    dismissNudge();
  } catch {}
}

function clearImportApplied() {
  importApplied.value = { lastTip: null, tipGoal: null, socialmedia: null, external: null, liveviews: null, announcement: null };
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
  const masked = !!d.masked;
  const tooltip = masked ? t('statusMaskedTooltip') : '';
  modulesList.value = [
      { key: 'lastTip', label: t('lastTip'), active: d.lastTip?.active !== false, tooltip },
      { key: 'tipGoal', label: t('tipGoal'), active: d.tipGoal?.active !== false, tooltip },
      { key: 'chat', label: t('chat'), active: d.chat?.active !== false, tooltip },
      {
        key: 'announcement',
        label: t('announcementTitle'),
        active: d.announcement?.active,
        tooltip,
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
        tooltip,
        extra: d.socialmedia ? t('statusItems', { n: d.socialmedia.entries }) : '',
      },
      {
        key: 'externalNotifications',
        label: t('externalNotificationsTitle'),
        active: d.externalNotifications?.active,
        tooltip,
      },
      {
        key: 'liveviews',
        label: t('liveviewsTitle'),
        active: !!d.liveviews?.active,
        tooltip,
        extra: d.liveviews?.claimid ? t('statusItems', { n: 1 }) : '',
      },
      {
        key: 'raffle',
        label: t('raffleTitle'),
        active: !!d.raffle?.active,
        tooltip,
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

    try {
      if (sessionStatus.value.supported && sessionStatus.value.active) {
        const pt = await axios.get('/api/session/public-token');
        if (pt?.data?.publicToken) lastPublicToken.value = pt.data.publicToken;
      }
    } catch {}

    if (!nudgeReady.value) nudgeReady.value = true;
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

function exportPublicToken() {
  try {
    if (!lastPublicToken.value) return;
    const payload = {
      publicToken: lastPublicToken.value,
      origin: window.location.origin,
      createdAt: new Date().toISOString(),
      note: 'Public token for Getty session. Do not share the admin token.'
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `getty-public-token-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
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
        liveviews: typeof restored.liveviews === 'boolean' ? restored.liveviews : null,
        announcement: typeof restored.announcement === 'boolean' ? restored.announcement : null,
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

