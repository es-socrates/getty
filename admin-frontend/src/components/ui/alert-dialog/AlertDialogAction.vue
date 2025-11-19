<template>
  <AlertDialogAction :class="cn('mt-2 sm:mt-0', props.class)">
    <slot />
  </AlertDialogAction>
</template>

<script setup lang="ts">
import { AlertDialogAction } from 'radix-vue';
import { cn } from '@/lib/utils';

const props = defineProps<{
  class?: string;
}>();
</script>
