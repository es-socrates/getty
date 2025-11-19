<template>
  <section class="sh-sidebar-group" data-sidebar-group>
    <slot />
  </section>
</template>
<script setup lang="ts"></script>
<style scoped>
.sh-sidebar-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.85rem;
  border-radius: 0.9rem;
  border: 1px solid var(--card-border, rgba(148, 163, 184, 0.3));
  background: rgba(148, 163, 184, 0.08);
  transition: border-color 0.2s ease, background 0.2s ease;
}
:global(.theme-dark) .sh-sidebar-group,
:global(.dark) .sh-sidebar-group {
  border-color: rgba(148, 163, 184, 0.15);
  background: rgba(15, 23, 42, 0.75);
}
</style>
