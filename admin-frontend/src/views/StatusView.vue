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
import { ref, onMounted, computed } from 'vue';
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
</script>
