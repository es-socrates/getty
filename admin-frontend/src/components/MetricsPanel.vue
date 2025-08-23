<template>
  <OsCard :title="t('metricsTitle') || 'Live Metrics'">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
      <div class="p-2 rounded-os-sm os-subtle">
        <div class="os-th text-xs">{{ t('metricsRequestsPerMin') || 'Requests/min' }}</div>
        <div class="flex items-end justify-between gap-2">
          <div class="text-xl font-semibold">{{ metrics.system?.requests?.perMin ?? '—' }}</div>
          <OsSparkline :data="hist.rpm" :width="90" :height="24" color="#34d399" />
        </div>
      </div>
      <div class="p-2 rounded-os-sm os-subtle">
        <div class="os-th text-xs">{{ t('metricsWsClients') || 'WS Clients' }}</div>
        <div class="text-xl font-semibold">{{ metrics.system?.wsClients ?? '—' }}</div>
      </div>
      <div class="p-2 rounded-os-sm os-subtle">
        <div class="os-th text-xs">{{ t('metricsHeapUsed') || 'Heap Used' }}</div>
        <div class="flex items-end justify-between gap-2">
          <div class="text-xl font-semibold">{{ metrics.system?.memory?.heapUsedMB ?? '—' }} MB</div>
          <OsSparkline :data="hist.heap" :width="90" :height="24" color="#60a5fa" />
        </div>
      </div>
      <div class="p-2 rounded-os-sm os-subtle">
        <div class="os-th text-xs">{{ t('metricsBandwidthPerMin') || 'Bandwidth/min' }}</div>
        <div class="flex items-end justify-between gap-2">
          <div class="text-xl font-semibold">{{ metrics.bandwidth?.human?.perMin ?? '—' }}</div>
          <OsSparkline :data="hist.bandwidth" :width="90" :height="24" color="#f59e0b" />
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div class="p-2 rounded-os-sm os-subtle">
        <div class="os-th text-xs mb-1">{{ t('metricsChatActivity') || 'Chat activity' }}</div>
        <div class="text-sm">{{ t('metrics1m') || '1m' }}: <strong>{{ metrics.chat?.perMin ?? 0 }}</strong></div>
        <div class="text-sm">{{ t('metrics5m') || '5m' }}: <strong>{{ metrics.chat?.last5m ?? 0 }}</strong></div>
        <div class="text-sm">{{ t('metrics1h') || '1h' }}: <strong>{{ metrics.chat?.lastHour ?? 0 }}</strong></div>
        <div class="mt-1"><OsSparkline :data="hist.chat" :width="160" :height="28" color="#a78bfa" /></div>
      </div>
      <div class="p-2 rounded-os-sm os-subtle">
        <div class="os-th text-xs mb-1">{{ t('metricsTips') || 'Tips' }}</div>
        <div class="text-sm">{{ t('metricsSession') || 'Session' }}: <strong>{{ metrics.tips?.session?.count ?? 0 }}</strong> ({{ metrics.tips?.session?.ar ?? 0 }} AR | ${{ metrics.tips?.session?.usd ?? 0 }})</div>
        <div class="text-sm">
          {{ t('metricsMonthly') || 'Monthly' }}: 
          <strong>{{ fmt1(metrics.tips?.monthly?.currentAR) }}</strong>
          / {{ fmt1(metrics.tips?.monthly?.goalAR) }} AR
          ({{ fmt1(metrics.tips?.monthly?.progress) }}%)
          <span class="text-neutral-400">• ${{ fmt1(monthlyUsd) }}</span>
        </div>
        <div class="text-xs mt-1 text-neutral-400">{{ t('metricsRate1m') || 'Rate 1m' }}: {{ metrics.tips?.rate?.perMin?.ar ?? 0 }} AR (${{ metrics.tips?.rate?.perMin?.usd ?? 0 }})</div>
        <div class="text-xs text-neutral-400">24h: {{ metrics.tips?.window?.last24h?.ar ?? 0 }} AR (${{ metrics.tips?.window?.last24h?.usd ?? 0 }})</div>
        <div class="mt-1"><OsSparkline :data="hist.tips" :width="160" :height="28" color="#ef4444" /></div>
      </div>
      <div class="p-2 rounded-os-sm os-subtle">
        <div class="os-th text-xs mb-1">{{ t('metricsLiveviews') || 'Liveviews' }}</div>
        <div class="text-sm">{{ metrics.liveviews?.live ? t('liveNow') : t('notLive') }}</div>
        <div class="text-2xl font-semibold">{{ metrics.liveviews?.viewerCount ?? 0 }}</div>
      </div>
    </div>
  </OsCard>
</template>
<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import OsCard from './os/OsCard.vue';
import OsSparkline from './os/OsSparkline.vue';

const { t } = useI18n();
const metrics = ref({});
const hist = ref({ rpm: [], heap: [], bandwidth: [], chat: [], tips: [] });
const MAX_POINTS = 30;
const arPriceUsd = ref(null);

function fmt1(v, digits = 1){
  const n = Number(v);
  if (!isFinite(n)) return '0.0';
  return n.toFixed(digits);
}

const monthlyUsd = computed(()=>{
  const m = metrics.value?.tips?.monthly;
  if (!m) return 0;
  if (typeof m.usdValue === 'number') return m.usdValue;
  const ar = Number(m.currentAR || 0);
  const p = Number(arPriceUsd.value || 0);
  return ar * p;
});

async function refresh(){
  try {
    const r = await axios.get('/api/metrics');
    const m = r.data || {};
    metrics.value = m;
    const push = (arr, v) => { arr.push(v); if (arr.length > MAX_POINTS) arr.shift(); };
    push(hist.value.rpm, +(m.system?.requests?.perMin ?? 0));
    push(hist.value.heap, +(m.system?.memory?.heapUsedMB ?? 0));

    const kb = (()=>{ const s=m.bandwidth?.human?.perMin||'0 KB'; const n=parseFloat(s); return isNaN(n)?0:n; })();
    push(hist.value.bandwidth, kb);
    push(hist.value.chat, +(m.chat?.perMin ?? 0));
    push(hist.value.tips, +(m.tips?.rate?.perMin?.ar ?? 0));
  } catch {}
}

onMounted(()=>{ refresh(); setInterval(refresh, 10000); });
onMounted(async ()=>{
  try {
    const r = await axios.get('/api/ar-price');
    arPriceUsd.value = r.data?.arweave?.usd ?? null;
  } catch {}
  setInterval(async ()=>{
    try {
      const r = await axios.get('/api/ar-price');
      arPriceUsd.value = r.data?.arweave?.usd ?? arPriceUsd.value;
    } catch {}
  }, 60000);
});
</script>
