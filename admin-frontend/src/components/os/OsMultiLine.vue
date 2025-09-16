<template>
  <div class="relative select-none" :style="`width:${width}px;height:${height}px`">
    <svg
      ref="root"
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      class="block">
      <defs>
        <template v-for="g in gradients" :key="g.id">
          <linearGradient :id="g.id" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="g.color" :stop-opacity="0.24" />
            <stop offset="100%" :stop-color="g.color" :stop-opacity="0" />
          </linearGradient>
        </template>
      </defs>
      <template v-if="grid">
        <line
          v-for="y in 3"
          :key="y"
          :x1="pad"
          :x2="width - pad"
          :y1="(pad + y * ((height - 2 * pad) / 4)).toFixed(1)"
          :y2="(pad + y * ((height - 2 * pad) / 4)).toFixed(1)"
          stroke="currentColor"
          opacity="0.08" />
      </template>
      <template v-for="s in normalizedSeries" :key="s.name">
        <polygon v-if="area" :points="s.polygon" :fill="`url(#${s.gradId})`" />
        <polyline
          class="ml-line"
          :points="s.points"
          fill="none"
          :stroke="s.color"
          :stroke-width="strokeWidth"
          stroke-linejoin="round"
          stroke-linecap="round" />
        <!-- Latest point highlight -->
        <template v-if="s.latestPoint">
          <circle
            :cx="s.latestPoint.x"
            :cy="s.latestPoint.y"
            :r="4.5"
            fill="var(--bg,#111)"
            fill-opacity="0.85"
            stroke="s.color"
            stroke-width="1.4" />
          <circle :cx="s.latestPoint.x" :cy="s.latestPoint.y" :r="2.2" :fill="s.color" />
        </template>
        <circle
          v-if="tooltip.active"
          :cx="s.tooltipPoint.x"
          :cy="s.tooltipPoint.y"
          :r="3"
          :fill="s.color"
          fill-opacity="0.9" />
      </template>
      <line
        v-if="tooltip.active"
        :x1="tooltip.lineX"
        :x2="tooltip.lineX"
        :y1="pad"
        :y2="height - pad"
        stroke="currentColor"
        stroke-opacity="0.25"
        stroke-dasharray="2 2" />
      <rect
        v-if="enableTooltip"
        class="cursor-crosshair"
        :x="pad"
        :y="pad"
        :width="width - pad * 2"
        :height="height - pad * 2"
        fill="transparent"
        @pointermove="onPointerMove"
        @pointerleave="onPointerLeave" />
    </svg>
    <div
      v-if="tooltip.active"
      class="absolute z-10 text-[10px] leading-tight rounded-os-sm bg-[var(--bg-chat,#111)]/85 backdrop-blur px-2 py-1 shadow pointer-events-none"
      :style="`left:${tooltip.boxX}px;top:${tooltip.boxY}px;max-width:180px`">
      <div class="opacity-70 mb-0.5">{{ tooltip.label }}</div>
      <div v-for="row in tooltip.rows" :key="row.name" class="flex items-center gap-1">
        <span :style="`background:${row.color}`" class="inline-block w-2 h-2 rounded-sm"></span>
        <span class="font-medium">{{ row.name }}</span>
        <span class="ml-auto tabular-nums">{{ row.value }}</span>
        <span v-if="row.delta" :class="['tabular-nums', 'ml-1', row.deltaClass]">{{
          row.delta
        }}</span>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed, ref, onMounted, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  series: { type: Array, default: () => [] },
  width: { type: Number, default: 360 },
  height: { type: Number, default: 80 },
  normalizeEach: { type: Boolean, default: true },
  strokeWidth: { type: Number, default: 1.6 },
  grid: { type: Boolean, default: true },
  padding: { type: Number, default: 8 },
  area: { type: Boolean, default: true },
  animate: { type: Boolean, default: false },
  animateDuration: { type: Number, default: 400 },
  enableTooltip: { type: Boolean, default: true },
  constantLiftPercent: { type: Number, default: 0.05 },
  timestamps: { type: Array, default: () => [] },
  showDeltas: { type: Boolean, default: true },
});

function padTo(arr, len) {
  if (!Array.isArray(arr)) return Array(len).fill(0);
  if (arr.length >= len) return arr.slice(arr.length - len);
  const first = arr.length ? arr[0] : 0;
  return Array(len - arr.length)
    .fill(first)
    .concat(arr);
}

const pad = computed(() => Math.max(0, Math.min((props.width || 0) / 4, props.padding || 0)));

const uid = Math.random().toString(36).slice(2);
const stepXRef = ref(0);
const maxLenRef = ref(0);
const tooltip = ref({ active: false, index: -1, lineX: 0, boxX: 0, boxY: 0, label: '', rows: [] });
const { t } = useI18n?.() || { t: () => '' };

const SAMPLE_INTERVAL_MS = 10_000;
const baseTimeRef = ref(Date.now());
const normalizedSeries = computed(() => {
  const s = Array.isArray(props.series)
    ? props.series.filter((x) => x && Array.isArray(x.data))
    : [];
  if (!s.length) return [];
  const maxLen = Math.max(...s.map((x) => x.data.length || 0), 1);
  const innerW = Math.max(0, props.width - 2 * pad.value);
  const innerH = Math.max(0, props.height - 2 * pad.value);
  const stepX = innerW / Math.max(maxLen - 1, 1);

  let globalMin = Infinity,
    globalMax = -Infinity;
  if (!props.normalizeEach) {
    for (const ss of s) {
      for (const v of ss.data) {
        if (v < globalMin) globalMin = v;
        if (v > globalMax) globalMax = v;
      }
    }
    if (!isFinite(globalMin)) globalMin = 0;
    if (!isFinite(globalMax)) globalMax = 1;
    if (globalMax === globalMin) globalMax = globalMin + 1;
  }

  const out = s.map((ss, idx) => {
    const arr = padTo(ss.data, maxLen);
    let localMin = props.normalizeEach ? Math.min(...arr) : globalMin;
    let localMax = props.normalizeEach ? Math.max(...arr) : globalMax;
    if (props.normalizeEach && localMax === localMin && localMax > 0) {
      const p = Math.max(0.005, Math.min(0.5, props.constantLiftPercent));
      localMin = localMin * (1 - p);
      localMax = localMax * (1 + p);
    }
    const range = localMax - localMin || 1;
    const pts = arr
      .map((v, i) => {
        const x = pad.value + i * stepX;
        const y = pad.value + (1 - (v - localMin) / range) * innerH;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
    const polygon = `${pad.value.toFixed(2)},${(pad.value + innerH).toFixed(2)} ${pts} ${(
      pad.value + innerW
    ).toFixed(2)},${(pad.value + innerH).toFixed(2)}`;
    const gradId = `ml-grad-${uid}-${idx}`;
    let tooltipPoint = { x: -10, y: -10 };
    if (tooltip.value.index >= 0 && tooltip.value.index < arr.length) {
      const v = arr[tooltip.value.index];
      const x = pad.value + tooltip.value.index * stepX;
      const y = pad.value + (1 - (v - localMin) / range) * innerH;
      tooltipPoint = { x, y };
    }
    let latestPoint = null;
    try {
      const lastIdx = arr.length - 1;
      const lv = arr[lastIdx];
      const lx = pad.value + lastIdx * stepX;
      const ly = pad.value + (1 - (lv - localMin) / range) * innerH;
      latestPoint = { x: lx, y: ly };
    } catch {}
    return {
      name: ss.name,
      color: ss.color || '#999',
      points: pts,
      polygon,
      gradId,
      arr,
      localMin,
      localMax,
      tooltipPoint,
      latestPoint,
    };
  });
  // defer side-effects via nextTick
  nextTick(() => {
    maxLenRef.value = maxLen;
    stepXRef.value = stepX;
    if (!normalizedSeries.value.length) return;
    // Recompute a base time assuming last sample ~ now
    try {
      baseTimeRef.value = Date.now() - (maxLen - 1) * SAMPLE_INTERVAL_MS;
    } catch {}
  });
  return out;
});
const gradients = computed(() =>
  normalizedSeries.value.map((s) => ({ id: s.gradId, color: s.color }))
);

const root = ref(null);
function onPointerMove(e) {
  if (!props.enableTooltip) return;
  try {
    const svg = root.value;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xRaw = e.clientX - rect.left - pad.value;
    const step = stepXRef.value || 1;
    let idx = Math.round(xRaw / step);
    idx = Math.max(0, Math.min(idx, (maxLenRef.value || 1) - 1));
    const lineX = pad.value + idx * step;
    const rows = normalizedSeries.value.map((s) => {
      const v = s.arr[idx];
      const prev = idx > 0 ? s.arr[idx - 1] : undefined;
      const value = typeof v === 'number' && isFinite(v) ? v.toFixed(v < 1 ? 2 : 1) : '0.0';
      let delta = '';
      let deltaClass = '';
      if (
        props.showDeltas &&
        typeof v === 'number' &&
        isFinite(v) &&
        typeof prev === 'number' &&
        isFinite(prev)
      ) {
        const d = v - prev;
        if (d !== 0) {
          const pct = prev !== 0 ? (d / Math.abs(prev)) * 100 : 0;
          let pctStr = '';
          if (pct !== 0) {
            const ap = Math.abs(pct);
            if (ap >= 9999) pctStr = t('deltaPercentHuge');
            else if (ap >= 1000)
              pctStr = t('deltaPercentFormat', { n: ap.toFixed(0) }) || ap.toFixed(0) + '%';
            else if (ap >= 100)
              pctStr = t('deltaPercentFormat', { n: ap.toFixed(0) }) || ap.toFixed(0) + '%';
            else if (ap >= 10)
              pctStr = t('deltaPercentFormat', { n: ap.toFixed(1) }) || ap.toFixed(1) + '%';
            else pctStr = t('deltaPercentFormat', { n: ap.toFixed(1) }) || ap.toFixed(1) + '%';
          }
          const sign = d > 0 ? '+' : '-';
          const absD = Math.abs(d);
          let dStr;
          if (absD < 1) dStr = absD.toFixed(2);
          else if (absD < 10) dStr = absD.toFixed(2);
          else if (absD < 100) dStr = absD.toFixed(1);
          else dStr = absD.toFixed(0);
          if (pctStr) {
            delta =
              t('deltaFormatWithPercent', { sign, delta: dStr, percent: pctStr }) ||
              `${sign}${dStr} (${pctStr})`;
          } else {
            delta = t('deltaFormatNoPercent', { sign, delta: dStr }) || `${sign}${dStr}`;
          }
          deltaClass = d > 0 ? 'text-green-400' : 'text-red-400';
        }
      }
      return { name: s.name, color: s.color, value, delta, deltaClass };
    });

    const ts = baseTimeRef.value + idx * SAMPLE_INTERVAL_MS;

    try {
      if (Array.isArray(props.timestamps) && props.timestamps.length) {
        const tArr = props.timestamps;
        const maxLen = maxLenRef.value || tArr.length;
        const slice = tArr.slice(Math.max(0, tArr.length - maxLen));
        if (idx < slice.length) {
          const realTs = Number(slice[idx]);
          if (realTs > 0) {
            // override ts variable in a safe way by shadowing
          }
        }
      }
    } catch {}
    let tsFinal = ts;
    try {
      if (Array.isArray(props.timestamps) && props.timestamps.length) {
        const tArr = props.timestamps;
        const maxLen = maxLenRef.value || tArr.length;
        const slice = tArr.slice(Math.max(0, tArr.length - maxLen));
        if (idx < slice.length) {
          const candidate = Number(slice[idx]);
          if (candidate > 0) tsFinal = candidate;
        }
      }
    } catch {}
    const now = Date.now();
    const agoMs = Math.max(0, now - tsFinal);
    const agoSec = Math.floor(agoMs / 1000);
    let agoStr;
    if (agoSec < 60) {
      agoStr = t('timeAgoSeconds', { n: agoSec }) || `${agoSec}s ago`;
    } else if (agoSec < 3600) {
      agoStr =
        t('timeAgoMinutes', { n: Math.floor(agoSec / 60) }) || `${Math.floor(agoSec / 60)}m ago`;
    } else {
      agoStr =
        t('timeAgoHours', { n: Math.floor(agoSec / 3600) }) || `${Math.floor(agoSec / 3600)}h ago`;
    }
    const timeStr =
      new Date(tsFinal).toLocaleTimeString?.([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) || '';
    tooltip.value = {
      active: true,
      index: idx,
      lineX,
      boxX: Math.min(Math.max(0, lineX + 8), props.width - 160),
      boxY: 8,
      label: `#${idx + 1} • ${timeStr} • ${agoStr}`,
      rows,
    };
  } catch {}
}
function onPointerLeave() {
  tooltip.value.active = false;
}
watch(normalizedSeries, () => {
  if (tooltip.value.active)
    tooltip.value.index = Math.min(tooltip.value.index, (maxLenRef.value || 1) - 1);
});
function runAnimate() {
  try {
    if (!props.animate) return;
    const el = root.value;
    if (!el) return;
    const lines = Array.from(el.querySelectorAll('polyline.ml-line'));
    for (const ln of lines) {
      const len = typeof ln.getTotalLength === 'function' ? ln.getTotalLength() : 0;
      ln.style.transition = 'none';
      ln.style.strokeDasharray = len ? `${len}` : '';
      ln.style.strokeDashoffset = len ? `${len}` : '';
      ln.style.opacity = '0.2';
    }
    requestAnimationFrame(() => {
      for (const ln of lines) {
        ln.style.transition = `stroke-dashoffset ${props.animateDuration}ms ease, opacity ${props.animateDuration}ms ease`;
        ln.style.strokeDashoffset = '0';
        ln.style.opacity = '1';
      }
    });
  } catch {}
}

onMounted(async () => {
  await nextTick();
  runAnimate();
});
watch(normalizedSeries, async () => {
  await nextTick();
  runAnimate();
});
</script>
<style scoped>
svg {
  opacity: 0.95;
}
</style>
