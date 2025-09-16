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
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
      <div class="p-2 rounded-os-sm os-subtle">
        <div class="os-th text-xs flex items-center gap-1.5">
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
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span>{{ t('metricsRequestsPerMin') || 'Requests/min' }}</span>
        </div>
        <div class="flex items-end justify-between gap-2">
          <div class="text-xl font-semibold flex items-baseline gap-2">
            <span>{{ metrics.system?.requests?.perMin ?? '—' }}</span>
            <span
              v-if="enableDeltas && deltas.rpm"
              :class="
                deltas.rpm.dir === 'up'
                  ? 'text-green-500'
                  : deltas.rpm.dir === 'down'
                  ? 'text-red-500'
                  : 'text-neutral-400'
              "
              class="text-xs">
              <span v-if="deltas.rpm.dir === 'up'">▲</span>
              <span v-else-if="deltas.rpm.dir === 'down'">▼</span>
              {{ deltas.rpm.text }}
            </span>
          </div>
          <OsSparkline :data="hist.rpm" :width="sparkSmallW" :height="24" color="#34d399" />
        </div>
      </div>
      <div class="p-2 rounded-os-sm os-subtle">
        <div class="os-th text-xs flex items-center gap-1.5">
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
            <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="3" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>{{ t('metricsWsClients') || 'WS Clients' }}</span>
        </div>
        <div class="text-xl font-semibold flex items-baseline gap-2">
          <span>{{ metrics.system?.wsClients ?? '—' }}</span>
          <span
            v-if="enableDeltas && deltas.ws"
            :class="
              deltas.ws.dir === 'up'
                ? 'text-green-500'
                : deltas.ws.dir === 'down'
                ? 'text-red-500'
                : 'text-neutral-400'
            "
            class="text-xs">
            <span v-if="deltas.ws.dir === 'up'">▲</span>
            <span v-else-if="deltas.ws.dir === 'down'">▼</span>
            {{ deltas.ws.text }}
          </span>
        </div>
      </div>
      <div class="p-2 rounded-os-sm os-subtle">
        <div class="os-th text-xs flex items-center gap-1.5">
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
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M7 5v14" />
            <path d="M17 5v14" />
          </svg>
          <span>{{ t('metricsHeapUsed') || 'Heap Used' }}</span>
        </div>
        <div class="flex items-end justify-between gap-2">
          <div class="text-xl font-semibold flex items-baseline gap-2">
            <span>{{ metrics.system?.memory?.heapUsedMB ?? '—' }} MB</span>
            <span
              v-if="enableDeltas && deltas.heap"
              :class="
                deltas.heap.dir === 'up'
                  ? 'text-red-500'
                  : deltas.heap.dir === 'down'
                  ? 'text-green-500'
                  : 'text-neutral-400'
              "
              class="text-xs">
              <span v-if="deltas.heap.dir === 'up'">▲</span>
              <span v-else-if="deltas.heap.dir === 'down'">▼</span>
              {{ deltas.heap.text }}
            </span>
          </div>
          <OsSparkline :data="hist.heap" :width="sparkSmallW" :height="24" color="#60a5fa" />
        </div>
      </div>
      <div class="p-2 rounded-os-sm os-subtle">
        <div class="os-th text-xs flex items-center gap-1.5">
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
            <polyline points="3 7 12 16 21 7" />
          </svg>
          <span>{{ t('metricsBandwidthPerMin') || 'Bandwidth/min' }}</span>
        </div>
        <div class="flex items-end justify-between gap-2">
          <div class="text-xl font-semibold flex items-baseline gap-2">
            <span>{{ metrics.bandwidth?.human?.perMin ?? '—' }}</span>
            <span
              v-if="enableDeltas && deltas.bandwidth"
              :class="
                deltas.bandwidth.dir === 'up'
                  ? 'text-green-500'
                  : deltas.bandwidth.dir === 'down'
                  ? 'text-red-500'
                  : 'text-neutral-400'
              "
              class="text-xs">
              <span v-if="deltas.bandwidth.dir === 'up'">▲</span>
              <span v-else-if="deltas.bandwidth.dir === 'down'">▼</span>
              {{ deltas.bandwidth.text }}
            </span>
          </div>
          <OsSparkline :data="hist.bandwidth" :width="sparkSmallW" :height="24" color="#f59e0b" />
        </div>
      </div>
    </div>

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
        <div class="text-xs text-neutral-400">
          24h: {{ metrics.tips?.window?.last24h?.ar ?? 0 }} AR (${{
            metrics.tips?.window?.last24h?.usd ?? 0
          }})
        </div>
        <div class="mt-1">
          <OsSparkline :data="hist.tips" :width="sparkMedW" :height="28" color="#ef4444" />
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
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>{{ t('metricsLiveviews') || 'Liveviews' }}</span>
        </div>
        <div class="text-sm">{{ metrics.liveviews?.live ? t('liveNow') : t('notLive') }}</div>
        <div class="text-2xl font-semibold">{{ metrics.liveviews?.viewerCount ?? 0 }}</div>
      </div>
    </div>

    <div class="mt-3 p-2 rounded-os-sm os-subtle overflow-hidden" ref="trendsWrap">
      <div class="flex items-center justify-between mb-2">
        <div class="os-th text-xs flex items-center gap-1.5">
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
            <polyline points="23 4 16 11 12 7 1 18" />
            <polyline points="17 4 23 4 23 10" />
          </svg>
          <span>{{ t('metricsTrends') || 'Trends' }}</span>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            class="text-xs flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)]"
            @click="collapsed = !collapsed">
            <span v-if="collapsed">{{ t('show') || 'Show' }}</span>
            <span v-else>{{ t('hide') || 'Hide' }}</span>
          </button>
          <template v-if="!collapsed">
            <button
              type="button"
              class="text-xs flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)]"
              :class="visible.rpm ? 'bg-[var(--bg-chat)]' : 'opacity-60 hover:bg-[var(--bg-chat)]'"
              @click="visible.rpm = !visible.rpm">
              <span class="inline-block w-2 h-2 rounded-sm bg-[#34d399]"></span>
              {{ t('metricsLegendRpm') || 'RPM' }}
            </button>
            <button
              type="button"
              class="text-xs flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)]"
              :class="visible.chat ? 'bg-[var(--bg-chat)]' : 'opacity-60 hover:bg-[var(--bg-chat)]'"
              @click="visible.chat = !visible.chat">
              <span class="inline-block w-2 h-2 rounded-sm bg-[#a78bfa]"></span>
              {{ t('metricsLegendChat') || 'Chat' }}
            </button>
            <button
              type="button"
              class="text-xs flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)]"
              :class="
                visible.bandwidth ? 'bg-[var(--bg-chat)]' : 'opacity-60 hover:bg-[var(--bg-chat)]'
              "
              @click="visible.bandwidth = !visible.bandwidth">
              <span class="inline-block w-2 h-2 rounded-sm bg-[#f59e0b]"></span>
              {{ t('metricsLegendBandwidth') || 'BW' }}
            </button>
            <button
              type="button"
              class="text-xs flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)]"
              :class="visible.heap ? 'bg-[var(--bg-chat)]' : 'opacity-60 hover:bg-[var(--bg-chat)]'"
              @click="visible.heap = !visible.heap">
              <span class="inline-block w-2 h-2 rounded-sm bg-[#60a5fa]"></span>
              {{ t('metricsLegendHeap') || 'Heap' }}
            </button>
            <button
              type="button"
              class="text-xs flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)]"
              :class="visible.tips ? 'bg-[var(--bg-chat)]' : 'opacity-60 hover:bg-[var(--bg-chat)]'"
              @click="visible.tips = !visible.tips">
              <span class="inline-block w-2 h-2 rounded-sm bg-[#ef4444]"></span>
              {{ t('metricsLegendTips') || 'Tips' }}
            </button>
            <button
              v-if="hasLatency"
              type="button"
              class="text-xs flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)]"
              :class="
                visible.latency ? 'bg-[var(--bg-chat)]' : 'opacity-60 hover:bg-[var(--bg-chat)]'
              "
              @click="visible.latency = !visible.latency">
              <span class="inline-block w-2 h-2 rounded-sm bg-[#f472b6]"></span>
              {{ t('metricsLegendLatency') || 'Latency' }}
            </button>
            <button
              v-if="hasViews"
              type="button"
              class="text-xs flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)]"
              :class="
                visible.viewsAvg ? 'bg-[var(--bg-chat)]' : 'opacity-60 hover:bg-[var(--bg-chat)]'
              "
              @click="visible.viewsAvg = !visible.viewsAvg">
              <span class="inline-block w-2 h-2 rounded-sm bg-[#e11d48]"></span>
              {{ t('metricsLegendViewsAvg') || 'Views avg' }}
            </button>
            <div class="hidden md:inline-block w-px h-4 bg-[var(--card-border)] mx-1"></div>
            <div
              class="inline-flex gap-1"
              :title="
                t('overviewRangeHelp') ||
                'Range: sets history window length (sampling every 10s). 5m ≈ 30 pts, 15m ≈ 90 pts, 60m ≈ 240 pts (capped).'
              ">
              <button
                v-for="opt in rangeOpts"
                :key="opt.value"
                type="button"
                class="text-xs px-2 py-0.5 rounded-os-sm border border-[var(--card-border)]"
                :class="
                  currentRange === opt.value ? 'bg-[var(--bg-chat)]' : 'hover:bg-[var(--bg-chat)]'
                "
                @click="setRange(opt.value)">
                {{ opt.label }}
              </button>
            </div>
          </template>
        </div>
      </div>
      <OsMultiLine
        v-if="!collapsed"
        :series="seriesList"
        :width="chartWidth"
        :height="chartHeight"
        :timestamps="histTs"
        :normalize-each="true"
        :padding="8"
        :animate="true"
        :animate-duration="600" />
    </div>
  </OsCard>
</template>
<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import OsCard from './os/OsCard.vue';
import OsSparkline from './os/OsSparkline.vue';
import OsMultiLine from './os/OsMultiLine.vue';
import {
  metrics,
  hist,
  deltas,
  currentRange,
  histTs,
  setRange,
  start as startMetrics,
} from '../stores/metricsStore.js';

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
const sparkSmallW = computed(() => (isSmall.value ? 130 : 90));
const sparkMedW = computed(() => (isSmall.value ? 210 : 160));
function updateIsSmall() {
  try {
    isSmall.value = window.innerWidth < 768;
  } catch {}
}

const visible = ref({
  rpm: true,
  chat: true,
  bandwidth: true,
  heap: false,
  tips: true,
  latency: true,
  viewsAvg: true,
});
const hasLatency = computed(() => {
  try {
    if (hist.value.latency && hist.value.latency.some((v) => v > 0)) return true;
    const m = metrics.value || {};
    return !!(m.latency?.ms || m.system?.latencyMs);
  } catch {
    return false;
  }
});
function movingAvg(arr, windowSize = 5) {
  try {
    const a = Array.isArray(arr) ? arr : [];
    if (!a.length) return [];
    const w = Math.max(1, Number(windowSize) || 5);
    const out = [];
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Number(a[i] || 0);
      if (i >= w) sum -= Number(a[i - w] || 0);
      out.push(sum / Math.min(i + 1, w));
    }
    return out;
  } catch {
    return [];
  }
}
const viewsAvg = computed(() => movingAvg(hist.value.views, 5));
const hasViews = computed(() => Array.isArray(viewsAvg.value) && viewsAvg.value.some((v) => v > 0));
const seriesList = computed(() => {
  const list = [];
  if (visible.value.rpm) list.push({ name: 'rpm', color: '#34d399', data: hist.value.rpm });
  if (visible.value.chat) list.push({ name: 'chat', color: '#a78bfa', data: hist.value.chat });
  if (visible.value.bandwidth)
    list.push({ name: 'bandwidth', color: '#f59e0b', data: hist.value.bandwidth });
  if (visible.value.heap) list.push({ name: 'heap', color: '#60a5fa', data: hist.value.heap });
  if (visible.value.tips) list.push({ name: 'tips', color: '#ef4444', data: hist.value.tips });
  if (visible.value.latency && hasLatency.value)
    list.push({ name: 'latency', color: '#f472b6', data: hist.value.latency });
  if (visible.value.viewsAvg && hasViews.value)
    list.push({ name: 'viewsAvg', color: '#e11d48', data: viewsAvg.value });
  return list;
});

const chartWidth = ref(720);
const chartHeight = computed(() => {
  const h = Math.round(chartWidth.value * 0.4);
  return Math.max(160, Math.min(260, h));
});
const trendsWrap = ref(null);
let ro = null;

const TRENDS_KEY = 'getty_trends_prefs_v1';
const collapsed = ref(true);
try {
  const saved = JSON.parse(localStorage.getItem(TRENDS_KEY) || 'null');
  if (saved && typeof saved.collapsed === 'boolean') collapsed.value = saved.collapsed;
} catch {}
watch(
  collapsed,
  (v) => {
    try {
      localStorage.setItem(TRENDS_KEY, JSON.stringify({ collapsed: v }));
    } catch {}
  },
  { immediate: false }
);
function updateChartWidth(el) {
  try {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const padL = parseFloat(style.paddingLeft || '0');
    const padR = parseFloat(style.paddingRight || '0');
    const contentWidth = rect.width - padL - padR;
    const w = Math.floor(contentWidth);
    chartWidth.value = Math.max(360, w);
  } catch {}
}

onMounted(() => {
  startMetrics();
});

onMounted(() => {
  try {
    updateIsSmall();
    try {
      window.addEventListener('resize', updateIsSmall);
    } catch {}
    updateChartWidth(trendsWrap.value);
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        for (const e of entries) {
          const el = e.target;
          updateChartWidth(el);
        }
      });
      if (trendsWrap.value) ro.observe(trendsWrap.value);
    } else {
      const onResize = () => updateChartWidth(trendsWrap.value);
      window.addEventListener('resize', onResize);
      ro = {
        disconnect() {
          window.removeEventListener('resize', onResize);
        },
      };
    }
  } catch {}
});
onUnmounted(() => {
  try {
    if (ro && ro.disconnect) ro.disconnect();
  } catch {}
  try {
    window.removeEventListener('resize', updateIsSmall);
  } catch {}
});
onMounted(async () => {
  try {
    const r = await axios.get('/api/ar-price');
    arPriceUsd.value = r.data?.arweave?.usd ?? null;
  } catch {}
  setInterval(async () => {
    try {
      const r = await axios.get('/api/ar-price');
      arPriceUsd.value = r.data?.arweave?.usd ?? arPriceUsd.value;
    } catch {}
  }, 60000);
});
</script>
<script>
export default { name: 'MetricsPanel' };
</script>
