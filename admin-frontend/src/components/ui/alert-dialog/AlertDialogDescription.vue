<template>
  <AlertDialogDescription class="text-sm text-muted-foreground" :class="props.class">
    <slot />
  </AlertDialogDescription>
</template>

<script setup lang="ts">
import { AlertDialogDescription } from 'radix-vue';

const props = defineProps<{
  class?: string;
}>();
</script>
