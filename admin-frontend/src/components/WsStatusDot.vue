<template>
  <span
    :class="[
      'inline-flex rounded-full flex-shrink-0 status-dot',
      sizeClass,
      statusClass,
      stateClass,
    ]"
    :aria-label="srLabel || (connected ? 'WebSocket conectado' : 'WebSocket desconectado')"
    role="status"></span>
</template>
<script setup>
import { computed } from 'vue';

const props = defineProps({
  connected: { type: Boolean, default: false },
  size: { type: String, default: 'sm' },
  srLabel: { type: String, default: '' },
});

const statusClass = computed(() => (props.connected ? 'bg-green-500' : 'bg-red-500'));
const stateClass = computed(() => (props.connected ? 'connected' : 'disconnected'));

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
