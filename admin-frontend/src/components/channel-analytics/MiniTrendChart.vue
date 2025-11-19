<template>
  <div
    class="mini-trend-chart"
    ref="container"
    :role="ariaRole"
    :aria-label="ariaLabelValue || undefined">
    <Line ref="chartRef" :data="chartData" :options="chartOptions" :height="height" />
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  Chart,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'vue-chartjs';

Chart.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler);

interface Props {
  points: number[];
  color: string;
  ariaLabel?: string;
  height?: number;
}

const props = defineProps<Props>();

const labels = computed(() => props.points.map((_value, idx) => `Point ${idx + 1}`));

function hexToRgba(hex: string, alpha: number) {
  const sanitized = hex.replace('#', '');
  if (sanitized.length !== 6) return `rgba(34, 197, 94, ${alpha})`;
  const bigint = Number.parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const borderColor = computed(() => props.color || '#22c55e');
const fillColor = computed(() => hexToRgba(borderColor.value, 0.18));

const chartData = computed<ChartData<'line'>>(() => ({
  labels: labels.value,
  datasets: [
    {
      data: props.points,
      borderColor: borderColor.value,
      backgroundColor: fillColor.value,
      fill: {
        target: 'origin',
        above: fillColor.value,
        below: fillColor.value,
      },
      pointRadius: 0,
      pointHoverRadius: 3,
      pointHitRadius: 12,
      pointBackgroundColor: borderColor.value,
      borderWidth: 2.2,
      tension: 0.45,
    },
  ],
}));

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      enabled: true,
      intersect: false,
      mode: 'index',
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      cornerRadius: 8,
      padding: 10,
      displayColors: false,
      callbacks: {
        title: () => '',
        label: (ctx) => {
          const value = typeof ctx.parsed?.y === 'number' ? ctx.parsed.y : ctx.formattedValue;
          return ` ${value}`;
        },
      },
    },
  },
  interaction: { mode: 'index', intersect: false },
  elements: {
    line: { borderCapStyle: 'round', borderJoinStyle: 'round' },
  },
  scales: {
    x: { display: false },
    y: {
      display: false,
    },
  },
}));

const container = ref<HTMLElement | null>(null);
const chartRef = ref<InstanceType<typeof Line> | null>(null);
let resizeObserver: ResizeObserver | null = null;

function scheduleResize() {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame?.(() => {
    const chartInstance = chartRef.value?.chart as Chart | undefined;
    chartInstance?.resize();
  });
}

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return;
  const target = container.value;
  if (!target) return;
  resizeObserver = new ResizeObserver(() => scheduleResize());
  resizeObserver.observe(target);
  nextTick(() => scheduleResize());
});

onBeforeUnmount(() => {
  if (resizeObserver) {
    try {
      resizeObserver.disconnect();
    } catch {}
    resizeObserver = null;
  }
});

watch(
  () => [props.points, props.color],
  () => {
    scheduleResize();
  },
  { deep: true }
);

const height = computed(() => props.height || 60);
const ariaRole = computed(() => (props.ariaLabel ? 'img' : undefined));
const ariaLabelValue = computed(() => props.ariaLabel ?? null);
</script>
<style scoped>
.mini-trend-chart {
  position: relative;
  width: 100%;
}
</style>
