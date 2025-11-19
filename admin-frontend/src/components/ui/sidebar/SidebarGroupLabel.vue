<template>
  <div class="sh-sidebar-group-label">
    <slot />
  </div>
</template>
<script setup lang="ts"></script>
<style scoped>
.sh-sidebar-group-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  color: var(--text-secondary, rgba(71, 85, 105, 0.9));
}
:global(.theme-dark) .sh-sidebar-group-label,
:global(.dark) .sh-sidebar-group-label {
  color: rgba(148, 163, 184, 0.85);
}
</style>
