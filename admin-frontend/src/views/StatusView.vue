<template>
  <section class="admin-tab active">
    <div class="flex flex-col gap-4">
      <ModulesStatusPanel />
      <MetricsPanel />

      <div ref="historySentinel"></div>
      <component v-if="showHistory" :is="AsyncStreamHistoryPanel" class="animate-fade-in" />
      <div
        v-else
        class="os-card p-4 text-xs opacity-60 border border-[var(--card-border)] rounded-os-sm flex items-center gap-2">
        <span
          class="inline-block w-3 h-3 border-2 border-[var(--border)] border-t-[var(--text)] rounded-full animate-spin"></span>
        <span>Loading history…</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, defineAsyncComponent } from 'vue';
import MetricsPanel from '../components/MetricsPanel.vue';
import ModulesStatusPanel from '../components/ModulesStatusPanel.vue';
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
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {}

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
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in {
  animation: fade-in 240ms ease-out;
}
</style>
