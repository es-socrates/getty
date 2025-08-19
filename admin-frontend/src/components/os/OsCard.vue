<template>
  <section :class="['os-card', padding ? 'p-4' : '', $attrs.class]">
    <header v-if="title || $slots.actions || $slots.header" class="flex items-center justify-between mb-2">
      <h3 v-if="title" class="os-card-title">{{ title }}</h3>
      <div v-if="$slots.actions"><slot name="actions" /></div>
      <slot v-else name="header" />
    </header>
    <div><slot /></div>
  </section>
</template>
<script setup>
defineProps({ title: { type: String, default: '' }, padding: { type: Boolean, default: true } })
</script>
