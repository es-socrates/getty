<template>
  <div class="channel-performance-chart">
    <div v-if="!hasData && !loading" class="chart-empty">
      {{ t('userProfileChartEmpty') }}
    </div>
    <div v-else ref="chartEl" class="chart-surface" :class="{ 'chart-loading': loading }"></div>
  </div>
</template>
<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { renderStreamHistoryChart } from '../StreamHistoryPanel/utils/renderChart.js';

const props = defineProps({
  data: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});

const { t } = useI18n();
const chartEl = ref(null);
let resizeObserver = null;

const hasData = computed(() => {
  if (!Array.isArray(props.data)) return false;
  return props.data.some((entry) => {
    try {
      return (
        Number(entry?.hours || 0) > 0 ||
        Number(entry?.avgViewers || 0) > 0 ||
        Number(entry?.peakViewers || 0) > 0
      );
    } catch {
      return false;
    }
  });
});

const render = async () => {
  await nextTick();
  if (!chartEl.value) return;
  const dataset = Array.isArray(props.data) ? props.data : [];
  if (!dataset.length) {
    chartEl.value.innerHTML = '';
    return;
  }
  renderStreamHistoryChart(chartEl.value, dataset, {
    mode: 'bar',
    showViewers: true,
    smoothWindow: 3,
  });
};

watch(
  () => props.data,
  () => {
    if (!props.loading) render();
  },
  { deep: true }
);

watch(
  () => props.loading,
  (busy) => {
    if (!busy) render();
  }
);

onMounted(() => {
  render();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      render();
    });
    if (chartEl.value) resizeObserver.observe(chartEl.value);
  }
});

onBeforeUnmount(() => {
  if (resizeObserver) {
    try {
      resizeObserver.disconnect();
    } catch {}
    resizeObserver = null;
  }
});
</script>
<style scoped>
.channel-performance-chart {
  position: relative;
  min-height: 240px;
}
.chart-surface {
  width: 100%;
  height: 300px;
  background: var(--chart-bg, #fefefe);
  border-radius: 12px;
  border: 1px solid var(--card-border);
  padding: 12px;
  box-sizing: border-box;
}
.chart-loading::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.08) 0%,
    rgba(148, 163, 184, 0.18) 50%,
    rgba(148, 163, 184, 0.08) 100%
  );
  animation: shimmer 1.4s infinite;
  pointer-events: none;
}
.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 260px;
  border: 1px dashed var(--card-border);
  border-radius: 12px;
  color: var(--text-secondary);
  font-size: 0.95rem;
}
@keyframes shimmer {
  0% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.9;
  }
  100% {
    opacity: 0.4;
  }
}
</style>
