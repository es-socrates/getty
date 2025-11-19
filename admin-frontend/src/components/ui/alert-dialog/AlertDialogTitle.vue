<template>
  <AlertDialogTitle class="text-lg font-semibold" :class="props.class">
    <slot />
  </AlertDialogTitle>
</template>

<script setup lang="ts">
import { AlertDialogTitle } from 'radix-vue';

const props = defineProps<{
  class?: string;
}>();
</script>
