<template>
  <OsCard>
    <template #header>
      <h3 class="os-card-title flex items-center gap-1.5">
        <span class="icon os-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
        </span>
        {{ t('statusModules') || 'Modules' }}
        <button
          type="button"
          class="ml-auto text-[11px] px-2 py-0.5 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)]"
          :disabled="loading"
          @click="refresh">
          <span v-if="loading">{{ t('loading') || 'Loading' }}…</span>
          <span v-else>{{ t('refresh') || 'Refresh' }}</span>
        </button>
      </h3>
    </template>
    <div class="text-xs opacity-70 mb-2" v-if="masked">
      <span>{{ t('masked') || 'Masked (sin sesión activa)' }}</span>
    </div>
    <div v-if="error" class="text-xs text-red-400 mb-2">{{ error }}</div>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
      <div
        v-for="it in items"
        :key="it.key"
        class="p-2 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] flex flex-col gap-1">
        <div class="flex items-center gap-1 justify-between">
          <span class="font-medium">{{ it.label }}</span>
          <span
            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide"
            :class="badgeClass(it.displayState)">
            <template v-if="it.displayState === 'active'">{{ t('commonOn') || 'On' }}</template>
            <template v-else-if="it.displayState === 'configured'">{{
              t('commonConfigured') || 'Configured'
            }}</template>
            <template v-else>{{ t('commonOff') || 'Off' }}</template>
          </span>
        </div>
        <div v-if="it.extra" class="text-[10px] opacity-70 leading-snug">{{ it.extra }}</div>
        <div v-if="it.uptime" class="text-[10px] opacity-60">↑ {{ it.uptime }}</div>
      </div>
    </div>
    <div class="mt-3 text-[10px] opacity-60 flex justify-between" v-if="lastUpdated">
      <span>{{ t('lastUpdated') || 'Última actualización' }}: {{ fmtTime(lastUpdated) }}</span>
      <button type="button" class="underline hover:no-underline" @click="auto = !auto">
        {{ auto ? t('pause') || 'Pausar' : t('resume') || 'Reanudar' }}
      </button>
    </div>
  </OsCard>
</template>
<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import OsCard from './os/OsCard.vue';
import api from '../services/api';
import { useWanderSession } from '../wander/store/wanderSession';

const { t } = useI18n();
const session = useWanderSession();
const loading = ref(false);
const error = ref('');
const data = ref(null);
const masked = ref(false);
const lastUpdated = ref(0);
const auto = ref(true);
let timer = null;

function fmtDuration(sec) {
  try {
    sec = Number(sec) || 0;
    if (sec <= 0) return '0s';
    const d = Math.floor(sec / 86400);
    sec %= 86400;
    const h = Math.floor(sec / 3600);
    sec %= 3600;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const parts = [];
    if (d) parts.push(d + 'd');
    if (h) parts.push(h + 'h');
    if (m) parts.push(m + 'm');
    if (s && parts.length < 2) parts.push(s + 's');
    return parts.slice(0, 2).join(' ');
  } catch {
    return '';
  }
}
function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return '';
  }
}
function buildItems(d) {
  if (!d) return [];
  const out = [];
  const push = (key, label, obj, extraFn) => {
    if (!obj || typeof obj !== 'object') return;
    const uptime =
      typeof obj.uptimeSeconds === 'number' && obj.uptimeSeconds > 0
        ? fmtDuration(obj.uptimeSeconds)
        : '';
    const extra = extraFn ? extraFn(obj) : '';
    let state = obj.displayState;
    if (!state) {
      if (obj.active || obj.connected) state = 'active';
      else if (obj.configured || obj.initialized) state = 'configured';
      else state = 'inactive';
    }
    if (key === 'socialmedia' && obj.entries > 0) state = 'configured';
    if (key === 'liveviews' && obj.claimid) state = 'configured';
    const showActive = state === 'active' || state === 'configured';
    out.push({ key, label, active: showActive, uptime, extra, displayState: state });
  };
  push('lastTip', t('lastTipModule') || 'Last Tip', d.lastTip, (o) =>
    o.active ? (o.lastDonation ? '✓ tip' : '') : ''
  );
  push('tipWidget', t('tipWidget') || 'Tip Widget', d.tipWidget);
  push('tipGoal', t('tipGoalModule') || 'Tip Goal', d.tipGoal, (o) =>
    o.active ? (o.progress ? o.progress + '%' : '') : ''
  );
  push('chat', t('chatModule') || 'Chat', d.chat, (o) => (o.connected ? 'connected' : ''));
  push('announcement', t('announcementModule') || 'Announcement', d.announcement, (o) =>
    o.active ? `${o.enabledMessages}/${o.totalMessages}` : ''
  );
  push('socialmedia', t('socialModule') || 'Social', d.socialmedia, (o) =>
    o.configured ? `${o.entries} ${t('statusEntries') || 'entries'}` : ''
  );
  push(
    'externalNotifications',
    t('externalNotificationsTitle') || 'Integrations',
    d.externalNotifications,
    (o) => (o.active && o.lastTips ? o.lastTips.length + ' tips' : '')
  );
  push('liveviews', t('liveviewsModule') || 'Liveviews', d.liveviews, (o) =>
    o.active ? o.viewersLabel || '' : ''
  );
  push('raffle', t('raffleTitle') || 'Raffle', d.raffle, (o) =>
    o.active ? (o.participants?.length || 0) + ' ppl' : ''
  );
  push('achievements', t('achievementsTitle') || 'Achievements', d.achievements, (o) =>
    o.active ? (o.items || 0) + ' items' : ''
  );
  push('events', t('eventsModule') || 'Events', d.events, (o) =>
    o.active ? (o.eventCount || 0) + ' events' : ''
  );
  return out;
}

const items = ref([]);

function badgeClass(state) {
  switch (state) {
    case 'active':
      return 'bg-[var(--badge-active-bg)] text-[var(--badge-active-fg)]';
    case 'configured':
      return 'bg-[var(--badge-configured-bg)] text-[var(--badge-configured-fg)]';
    default:
      return 'bg-[var(--badge-inactive-bg)] text-[var(--badge-inactive-fg)]';
  }
}

async function refresh() {
  loading.value = true;
  error.value = '';
  try {
    const r = await api.get('/api/modules');
    data.value = r.data || {};
    masked.value = !!data.value.masked;
    items.value = buildItems(data.value);
    lastUpdated.value = Date.now();
  } catch (e) {
    error.value = e?.message || 'failed';
  } finally {
    loading.value = false;
  }
}

function startTimer() {
  if (timer) return;
  timer = setInterval(() => {
    if (auto.value) refresh();
  }, 30000);
}
function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

onMounted(() => {
  refresh();
  startTimer();
});
onUnmounted(() => {
  stopTimer();
});

watch(
  () => session.state.address,
  (addr, prev) => {
    if (addr && addr !== prev) {
      setTimeout(() => refresh(), 400);
    }
  }
);
watch(
  () => session.state.sessionStale,
  (stale, was) => {
    if (was && !stale && session.state.address) {
      setTimeout(() => refresh(), 300);
    }
  }
);
</script>
<style scoped>
.os-card-title svg {
  width: 16px;
  height: 16px;
}
</style>
