<template>
  <div class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2" :class="props.class">
    <slot />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  class?: string;
}>();
</script>
