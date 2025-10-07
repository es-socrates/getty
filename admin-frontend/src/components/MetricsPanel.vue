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
            <polyline points="4 14 8 10 12 14 16 8 20 12" />
          </svg>
        </span>
        {{ t('metricsTitle') || 'Live Metrics' }}
      </h3>
    </template>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div class="p-2 rounded-os-sm os-subtle">
        <div class="os-th text-xs mb-1 flex items-center gap-1.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
          </svg>
          <span>{{ t('metricsChatActivity') || 'Chat activity' }}</span>
        </div>
        <div class="text-sm flex items-baseline gap-2">
          {{ t('metrics1m') || '1m' }}: <strong>{{ metrics.chat?.perMin ?? 0 }}</strong>
          <span
            v-if="enableDeltas && deltas.chat"
            :class="
              deltas.chat.dir === 'up'
                ? 'text-green-500'
                : deltas.chat.dir === 'down'
                ? 'text-red-500'
                : 'text-neutral-400'
            "
            class="text-xs font-normal">
            <span v-if="deltas.chat.dir === 'up'">▲</span>
            <span v-else-if="deltas.chat.dir === 'down'">▼</span>
            {{ deltas.chat.text }}
          </span>
        </div>
        <div class="text-sm">
          {{ t('metrics5m') || '5m' }}: <strong>{{ metrics.chat?.last5m ?? 0 }}</strong>
        </div>
        <div class="text-sm">
          {{ t('metrics15m') || '15m' }}: <strong>{{ metrics.chat?.last15m ?? 0 }}</strong>
        </div>
        <div class="text-sm">
          {{ t('metrics30m') || '30m' }}: <strong>{{ metrics.chat?.last30m ?? 0 }}</strong>
        </div>
        <div class="text-sm">
          {{ t('metrics1h') || '1h' }}: <strong>{{ metrics.chat?.lastHour ?? 0 }}</strong>
        </div>
        <div class="mt-1">
          <OsSparkline :data="hist.chat" :width="sparkMedW" :height="28" color="#a78bfa" />
        </div>
      </div>
      <div class="p-2 rounded-os-sm os-subtle">
        <div class="os-th text-xs mb-1 flex items-center gap-1.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M12 1v22" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <span>{{ t('metricsTips') || 'Tips' }}</span>
        </div>
        <div class="text-sm">
          {{ t('metricsSession') || 'Session' }}:
          <strong>{{ metrics.tips?.session?.count ?? 0 }}</strong> ({{
            metrics.tips?.session?.ar ?? 0
          }}
          AR | ${{ metrics.tips?.session?.usd ?? 0 }})
        </div>
        <div class="text-sm">
          {{ t('metricsMonthly') || 'Monthly' }}:
          <strong>{{ fmt1(metrics.tips?.monthly?.currentAR) }}</strong>
          / {{ fmt1(metrics.tips?.monthly?.goalAR) }} AR ({{
            fmt1(metrics.tips?.monthly?.progress)
          }}%)
          <span class="text-neutral-400">• ${{ fmt1(monthlyUsd) }}</span>
        </div>
        <div class="text-sm" v-if="metrics.tips?.totalBalance || metrics.tips?.total">
          {{ t('metricsTotal') || 'Total' }}:
          <template v-if="metrics.tips?.totalBalance">
            <strong>{{ fmt1(metrics.tips.totalBalance.ar) }} AR</strong>
            <span class="text-neutral-400" v-if="metrics.tips.totalBalance?.usd != null">
              • ${{ fmt1(metrics.tips.totalBalance.usd) }}
            </span>
            <span class="text-neutral-400" v-else-if="metrics.tips?.total?.usd">
              • ${{ fmt1(metrics.tips.total.usd) }}
            </span>
            <span class="text-[10px] ml-1 text-indigo-400" v-if="metrics.tips?.wallet?.address"
              >(wallet)</span
            >
          </template>
          <template v-else>
            <strong>{{ fmt1(metrics.tips.total.ar) }} AR</strong>
            <span class="text-neutral-400">• ${{ fmt1(metrics.tips.total.usd) }}</span>
          </template>
        </div>
        <div class="text-xs mt-1 text-neutral-400">
          {{ t('metricsRate1m') || 'Rate 1m' }}: {{ metrics.tips?.rate?.perMin?.ar ?? 0 }} AR (${{
            metrics.tips?.rate?.perMin?.usd ?? 0
          }})
        </div>
        <div class="text-xs text-neutral-400">
          {{ t('metricsRate5m') || 'Last 5m' }}: {{ metrics.tips?.rate?.last5m?.ar ?? 0 }} AR (${{
            metrics.tips?.rate?.last5m?.usd ?? 0
          }}) • {{ metrics.tips?.rate?.last5m?.count ?? 0 }} {{ t('metricsTipsCount') || 'tips' }}
        </div>
        <div class="mt-1">
          <OsSparkline :data="hist.tips" :width="sparkMedW" :height="28" color="#ef4444" />
        </div>
      </div>
      <div class="p-2 rounded-os-sm os-subtle flex flex-col">
        <div class="os-th text-xs mb-1 flex items-center gap-1.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>{{ t('metricsLiveviews') || 'Liveviews' }}</span>
        </div>
        <div class="text-xs tracking-wide uppercase opacity-80 mb-1 text-center">
          {{ metrics.liveviews?.live ? t('liveNow') || 'Live now' : t('notLive') || 'Offline' }}
        </div>
        <div
          class="font-semibold leading-none tracking-tight select-none text-center"
          style="color: rgb(255 24 76); font-size: 4.75rem; line-height: 0.95"
          :aria-label="(metrics.liveviews?.viewerCount ?? 0) + ' live viewers'">
          {{ liveviewsPretty }}
        </div>
      </div>
    </div>
  </OsCard>
</template>
<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import api from '../services/api';
import { useI18n } from 'vue-i18n';
import OsCard from './os/OsCard.vue';
import OsSparkline from './os/OsSparkline.vue';
import { metrics, hist, deltas, setRange, start as startMetrics } from '../stores/metricsStore.js';

const { t } = useI18n();
const props = defineProps({
  range: { type: String, default: '5m' },
  enableDeltas: { type: Boolean, default: true },
});

const rangeOpts = [
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '60m', label: '60m' },
];
watch(
  () => props.range,
  (v) => {
    if (rangeOpts.some((o) => o.value === v)) setRange(v);
  },
  { immediate: true }
);

const arPriceUsd = ref(null);

function fmt1(v, digits = 1) {
  const n = Number(v);
  if (!isFinite(n)) return '0.0';
  return n.toFixed(digits);
}

const monthlyUsd = computed(() => {
  const m = metrics.value?.tips?.monthly;
  if (!m) return 0;
  if (typeof m.usdValue === 'number') return m.usdValue;
  const ar = Number(m.currentAR || 0);
  const p = Number(arPriceUsd.value || 0);
  return ar * p;
});

const isSmall = ref(false);
const sparkMedW = computed(() => (isSmall.value ? 210 : 160));
function updateIsSmall() {
  try {
    isSmall.value = window.innerWidth < 768;
  } catch {}
}

function abbreviateNumber(n) {
  try {
    const v = Number(n || 0);
    if (!isFinite(v)) return '0';
    if (v >= 1_000_000) {
      const m = v / 1_000_000;
      return (m >= 10 ? Math.round(m) : m.toFixed(1)).replace(/\.0$/, '') + 'M';
    }
    if (v >= 1_000) {
      const k = v / 1_000;
      return (k >= 10 ? Math.round(k) : k.toFixed(1)).replace(/\.0$/, '') + 'k';
    }
    return String(v);
  } catch {
    return '0';
  }
}
const liveviewsPretty = computed(() => abbreviateNumber(metrics.value?.liveviews?.viewerCount));

onMounted(() => {
  startMetrics();
});

onMounted(() => {
  try {
    updateIsSmall();
    try {
      window.addEventListener('resize', updateIsSmall);
    } catch {}
  } catch {}
});
onUnmounted(() => {
  try {
    window.removeEventListener('resize', updateIsSmall);
  } catch {}
});
onMounted(async () => {
  try {
    const r = await api.get('/api/ar-price');
    arPriceUsd.value = r.data?.arweave?.usd ?? null;
  } catch {}
  setInterval(async () => {
    try {
      const r = await api.get('/api/ar-price');
      arPriceUsd.value = r.data?.arweave?.usd ?? arPriceUsd.value;
    } catch {}
  }, 60000);
});
</script>
<script>
export default { name: 'MetricsPanel' };
</script>
