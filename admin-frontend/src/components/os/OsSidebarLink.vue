<template>
  <RouterLink :to="to" class="sidebar-link os-nav-link group" active-class="active">
    <span v-if="$slots.icon" class="icon os-icon" aria-hidden="true"><slot name="icon" /></span>
    <span><slot /></span>
  </RouterLink>
</template>
<script setup>
import { RouterLink } from 'vue-router'
defineProps({ to: { type: [String, Object], required: true } })
</script>
