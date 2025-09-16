<template>
  <span :class="wrapperClass" :style="sizeStyle" :aria-hidden="ariaHidden ? 'true' : null">
    <slot />
  </span>
</template>
<script setup>
import { computed } from 'vue';

const props = defineProps({
  size: { type: Number, default: 28 },
  variant: { type: String, default: 'default' },
  ariaHidden: { type: Boolean, default: true },
});

const variantClass = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'icon-badge--primary';
    case 'neutral':
      return 'icon-badge--neutral';
    case 'danger':
      return 'icon-badge--danger';
    default:
      return '';
  }
});

const sizeClass = computed(() => {
  if (props.size === 20) return 'icon-badge--sm';
  if (props.size === 24) return 'icon-badge--md';
  return props.size !== 28 ? 'icon-badge--custom' : '';
});

const sizeStyle = computed(() => {
  if (props.size && ![20, 24, 28].includes(props.size)) {
    return { width: props.size + 'px', height: props.size + 'px' };
  }
  return undefined;
});

const wrapperClass = computed(() => ['icon-badge', variantClass.value, sizeClass.value]);
</script>
<style scoped></style>
