<template>
  <section class="admin-tab active">
    <div class="flex flex-col gap-4">
      <ModulesStatusPanel />
      <MetricsPanel />

      <div ref="historySentinel"></div>
      <div class="history-container">
        <component
          v-if="showHistory"
          :is="AsyncStreamHistoryPanel"
          class="animate-fade-in history-panel-card" />
        <div v-else class="history-placeholder">
          <div class="flex items-center gap-2 mb-4">
            <SkeletonLoader class="w-6 h-6 rounded" />
            <SkeletonLoader class="w-48 h-6 rounded" />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <SkeletonLoader class="h-24 rounded-lg" />
            <SkeletonLoader class="h-24 rounded-lg" />
            <SkeletonLoader class="h-24 rounded-lg" />
          </div>
          <SkeletonLoader class="w-full h-64 rounded-lg" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, defineAsyncComponent } from 'vue';
import MetricsPanel from '../components/MetricsPanel.vue';
import ModulesStatusPanel from '../components/ModulesStatusPanel.vue';
import SkeletonLoader from '../components/SkeletonLoader.vue';
// import ActivityPanel from '../components/ActivityPanel/ActivityPanel.vue'; // optional

const AsyncStreamHistoryPanel = defineAsyncComponent(() =>
  import(
    /* webpackChunkName: "stream-history" */ '../components/StreamHistoryPanel/StreamHistoryPanel.vue'
  )
);

const showHistory = ref(false);
const historySentinel = ref(null);

function revealHistory() {
  if (showHistory.value) return;
  showHistory.value = true;
}

onMounted(() => {
  const fallbackTimer = setTimeout(revealHistory, 2500);

  try {
    if ('IntersectionObserver' in window && historySentinel.value) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              revealHistory();
              io.disconnect();
              clearTimeout(fallbackTimer);
              break;
            }
          }
        },
        { rootMargin: '200px 0px' }
      );
      io.observe(historySentinel.value);
    } else {
      revealHistory();
      clearTimeout(fallbackTimer);
    }
  } catch {
    revealHistory();
    clearTimeout(fallbackTimer);
  }
});
</script>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.animate-fade-in {
  animation: fade-in 240ms ease-out;
}
.history-container {
  --history-frame: clamp(640px, 82vh, 1180px);
  min-height: var(--history-frame);
  position: relative;
}
.history-panel-card {
  min-height: inherit;
}
.history-placeholder {
  min-height: inherit;
  border: 1px solid var(--card-border);
  border-radius: var(--os-card-radius, 16px);
  padding: 1.5rem;
  background: var(--card-bg);
}
</style>
