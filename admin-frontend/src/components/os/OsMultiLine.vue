<template>
  <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" class="block">
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
        :y1="(pad + y*((height - 2*pad)/4)).toFixed(1)"
        :y2="(pad + y*((height - 2*pad)/4)).toFixed(1)"
        stroke="currentColor"
        opacity="0.08"
      />
    </template>
    <template v-for="s in normalizedSeries" :key="s.name">
      <polygon v-if="area" :points="s.polygon" :fill="`url(#${s.gradId})`" />
      <polyline :points="s.points" fill="none" :stroke="s.color" :stroke-width="strokeWidth" stroke-linejoin="round" stroke-linecap="round" />
    </template>
  </svg>
</template>
<script setup>
import { computed } from 'vue';

const props = defineProps({
  series: { type: Array, default: () => [] },
  width: { type: Number, default: 360 },
  height: { type: Number, default: 80 },
  normalizeEach: { type: Boolean, default: true },
  strokeWidth: { type: Number, default: 1.6 },
  grid: { type: Boolean, default: true },
  padding: { type: Number, default: 8 },
  area: { type: Boolean, default: true },
});

function padTo(arr, len) {
  if (!Array.isArray(arr)) return Array(len).fill(0);
  if (arr.length >= len) return arr.slice(arr.length - len);
  const first = arr.length ? arr[0] : 0;
  return Array(len - arr.length).fill(first).concat(arr);
}

const pad = computed(() => Math.max(0, Math.min((props.width || 0)/4, props.padding || 0)));

const uid = Math.random().toString(36).slice(2);
const normalizedSeries = computed(() => {
  const s = Array.isArray(props.series) ? props.series.filter(x=>x && Array.isArray(x.data)) : [];
  if (!s.length) return [];
  const maxLen = Math.max(...s.map(x => x.data.length || 0), 1);
  const innerW = Math.max(0, props.width - 2*pad.value);
  const innerH = Math.max(0, props.height - 2*pad.value);
  const stepX = innerW / Math.max(maxLen - 1, 1);

  let globalMin = Infinity, globalMax = -Infinity;
  if (!props.normalizeEach) {
    for (const ss of s) {
      for (const v of ss.data) { if (v < globalMin) globalMin = v; if (v > globalMax) globalMax = v; }
    }
    if (!isFinite(globalMin)) globalMin = 0;
    if (!isFinite(globalMax)) globalMax = 1;
    if (globalMax === globalMin) globalMax = globalMin + 1;
  }

  return s.map((ss, idx) => {
    const arr = padTo(ss.data, maxLen);
    const localMin = props.normalizeEach ? Math.min(...arr) : globalMin;
    const localMax = props.normalizeEach ? Math.max(...arr) : globalMax;
    const range = (localMax - localMin) || 1;
    const pts = arr.map((v, i) => {
      const x = (pad.value + i * stepX);
      const y = (pad.value + (1 - ((v - localMin) / range)) * innerH);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
    const polygon = `${pad.value.toFixed(2)},${(pad.value + innerH).toFixed(2)} ${pts} ${(pad.value + innerW).toFixed(2)},${(pad.value + innerH).toFixed(2)}`;
    const gradId = `ml-grad-${uid}-${idx}`;
    return { name: ss.name, color: ss.color || '#999', points: pts, polygon, gradId };
  });
});
const gradients = computed(()=> normalizedSeries.value.map(s => ({ id: s.gradId, color: s.color })));
</script>
<style scoped>
svg { opacity: 0.95 }
</style>
