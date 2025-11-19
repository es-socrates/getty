<template>
  <div class="chart-shell" ref="container" role="img" aria-label="Channel analytics bar chart">
    <Bar ref="chartRef" :data="chartData" :options="chartOptions" :height="height" />
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue';
import {
  Chart,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Bar } from 'vue-chartjs';

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface DatasetConfig {
  label: string;
  backgroundColor: string;
  borderRadius?: number;
  data: number[];
  yAxisID?: string;
}

interface Props {
  labels: string[];
  datasets: DatasetConfig[];
  height?: number;
}

const props = defineProps<Props>();

const chartData = computed<ChartData<'bar'>>(() => ({
  labels: props.labels,
  datasets: props.datasets,
}));

const chartOptions = computed<ChartOptions<'bar'>>(() => {
  const hasDualAxis = props.datasets.some((d) => d.yAxisID === 'y1');
  const scales: any = {
    x: {
      grid: { display: false },
      ticks: { autoSkip: true, maxRotation: 0, minRotation: 0 },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(148, 163, 184, 0.25)' },
      ticks: {
        callback(value: number | string) {
          if (typeof value !== 'number') return String(value);
          if (value >= 1000)
            return value % 1000 === 0 ? `${value / 1000}k` : `${(value / 1000).toFixed(1)}k`;
          return String(value);
        },
      },
    },
  };
  if (hasDualAxis) {
    scales.y1 = {
      beginAtZero: true,
      position: 'right',
      grid: { display: false },
      ticks: {
        callback(value: number | string) {
          return String(value);
        },
      },
    };
  }
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, boxWidth: 12, boxHeight: 12 },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        cornerRadius: 8,
        padding: 12,
        displayColors: true,
      },
    },
    scales,
  };
});

const container = ref<HTMLElement | null>(null);
const chartRef = ref<InstanceType<typeof Bar> | null>(null);
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
  resizeObserver = new ResizeObserver(() => {
    scheduleResize();
  });
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
  () => [props.labels, props.datasets],
  () => {
    scheduleResize();
  },
  { deep: true }
);

const height = computed(() => props.height || 280);
</script>
<style scoped>
.chart-shell {
  position: relative;
  width: 100%;
  min-height: 260px;
}
</style>
