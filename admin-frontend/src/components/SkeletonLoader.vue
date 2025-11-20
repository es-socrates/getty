<template>
  <div class="skeleton-loader" :class="{ 'skeleton-dark': isDark }"></div>
</template>

<script setup>
import { computed } from 'vue';

const isDark = computed(() => {
  try {
    return document.body.classList.contains('dark');
  } catch {
    return false;
  }
});
</script>

<style scoped>
.skeleton-loader {
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.skeleton-dark {
  background: rgba(255, 255, 255, 0.06);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
