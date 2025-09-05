<template>
  <div role="alert" class="alert-root">
    <slot />
  </div>
</template>
<script setup lang="ts">

</script>
<style scoped>
.alert-root{ display:flex; gap:.75rem; align-items:flex-start; padding:.75rem; border-radius:.5rem; border:1px solid var(--card-border); background:rgba(85,63,238,0.08); border-left-width:4px; border-left-color:#553fee; }
.alert-icon{ color:#553fee; margin-top:.25rem; }
</style>
