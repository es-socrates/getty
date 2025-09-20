<template>
  <span
    :class="[
      'inline-flex rounded-full flex-shrink-0',
      sizeClass,
      connected ? 'bg-green-500' : 'bg-yellow-500',
    ]"
    :aria-label="srLabel || (connected ? 'WebSocket conectado' : 'WebSocket pendiente')"
    role="status"></span>
</template>
<script setup>
import { computed } from 'vue';

const props = defineProps({
  connected: { type: Boolean, default: false },
  size: { type: String, default: 'sm' },
  srLabel: { type: String, default: '' },
});

const sizeClass = computed(() => {
  switch (props.size) {
    case 'md':
      return 'w-3 h-3';
    case 'lg':
      return 'w-4 h-4';
    default:
      return 'w-2 h-2';
  }
});
</script>
