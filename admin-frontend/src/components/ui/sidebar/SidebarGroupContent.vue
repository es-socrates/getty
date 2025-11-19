<template>
  <div class="sh-sidebar-group-content">
    <slot />
  </div>
</template>
<script setup lang="ts"></script>
<style scoped>
.sh-sidebar-group-content {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
</style>
