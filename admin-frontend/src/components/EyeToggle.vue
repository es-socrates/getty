<template>
  <button
    type="button"
    :aria-pressed="shown ? 'true' : 'false'"
    :aria-label="shown ? hideLabel : showLabel"
    class="eye-toggle"
    @click="onClick">
    <svg
      v-if="!shown"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
    <svg
      v-else
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94" />
      <path d="M1 1l22 22" />
      <path d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 3-3 3 3 0 0 0-.24-1.17" />
    </svg>
  </button>
</template>
<script setup>
import { defineProps, defineEmits } from 'vue';
const props = defineProps({
  shown: { type: Boolean, default: false },
  hideLabel: { type: String, default: 'Hide secret' },
  showLabel: { type: String, default: 'Show secret' },
});
const emit = defineEmits(['toggle']);
function onClick() {
  emit('toggle', !props.shown);
}
</script>
<style>
.eye-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.5rem;
  font-size: 0.75rem;
  color: #222;
  cursor: pointer;
  background: transparent;
  border: none;
  transition: color 0.15s ease-in-out;
}
.eye-toggle:hover,
.eye-toggle:focus-visible {
  color: #000;
  outline: none;
}
.dark .eye-toggle {
  color: rgba(255, 255, 255, 0.85);
}
.dark .eye-toggle:hover,
.dark .eye-toggle:focus-visible {
  color: #fff;
}
</style>
