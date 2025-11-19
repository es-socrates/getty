<template>
  <AlertDialogRoot v-model:open="open">
    <slot />
  </AlertDialogRoot>
</template>

<script setup lang="ts">
import { AlertDialogRoot } from 'radix-vue';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    open?: boolean;
    class?: string;
  }>(),
  {
    open: undefined,
    class: '',
  }
);

const emits = defineEmits<{
  'update:open': [open: boolean];
}>();

const open = computed({
  get: () => props.open ?? false,
  set: (value) => emits('update:open', value),
});
</script>
