<template>
  <section
    :class="['os-card', padding !== false ? 'os-card--padded' : 'os-card--bare', $attrs.class]">
    <header v-if="title || $slots.actions || $slots.header" class="os-card__header">
      <h3 v-if="title" class="os-card-title">{{ title }}</h3>
      <div v-if="$slots.actions" class="os-card__actions"><slot name="actions" /></div>
      <slot v-else name="header" />
    </header>
    <div class="os-card__body"><slot /></div>
  </section>
</template>
<script setup>
defineProps({ title: { type: String, default: '' }, padding: { type: Boolean, default: true } });
</script>
<style scoped>
.os-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--os-card-radius, 16px);
  color: var(--card-text);
  display: flex;
  flex-direction: column;
  gap: var(--os-card-gap, 12px);
}
.os-card--padded {
  padding: var(--os-card-padding, 16px);
}
.os-card--bare {
  padding: 0;
}
.os-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  gap: 12px;
}
.os-card-title {
  font-size: var(--os-card-title-size, 15px);
  font-weight: var(--os-card-title-weight, 600);
  line-height: 1.3;
  margin: 0 0 var(--os-card-title-mb, 4px);
  display: flex;
  align-items: center;
  gap: 6px;
}
.os-card__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.os-card__actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.os-card :focus-visible {
  outline: 2px solid var(--primary, #2563eb);
  outline-offset: 2px;
}
</style>
