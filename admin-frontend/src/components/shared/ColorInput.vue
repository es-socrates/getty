<template>
  <div class="color-field" :data-color="normalized">
    <div class="color-meta">
      <label :for="id" class="color-label">{{ label }}</label>
      <button type="button" class="color-copy" :aria-label="`Copy ${label}`" @click="copy">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
    </div>
    <div class="color-shell">
      <div class="picker-wrapper">
        <input
          class="color-input"
          type="color"
          :id="id"
          :value="normalized"
          @input="onPick"
          :aria-label="label"
        />
        <span class="swatch-ring" :style="{ background: normalized }"></span>
      </div>
      <input
        class="hex-input"
        :value="normalized"
        maxlength="9"
        @input="onHexInput"
        :aria-label="`${label} hex value`"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const emit = defineEmits(['update:modelValue']);

const props = defineProps({
  modelValue: { type: String, required: true },
  label: { type: String, required: true },
});

const id = computed(() => `color-${props.label.replace(/\s+/g, '-').toLowerCase()}`);
const normalized = computed(() => normalizeHex(props.modelValue));

function normalizeHex(v) {
  if (!v) return '#000000';
  let x = v.trim();
  if (!x.startsWith('#')) x = '#' + x;
  if (/^#([0-9a-fA-F]{3})$/.test(x)) {
    x = '#' + x.slice(1).split('').map(c => c + c).join('');
  }
  if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(x)) return x.toLowerCase();
  return '#000000';
}

function onPick(e) {
  emit('update:modelValue', e.target.value.toLowerCase());
}

function onHexInput(e) {
  const val = e.target.value;
  if (/^#?[0-9a-fA-F]{0,8}$/.test(val)) {
    const norm = normalizeHex(val);
    if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(norm)) emit('update:modelValue', norm);
  } else {
    e.target.value = normalized.value;
  }
}

async function copy() {
  try { await navigator.clipboard.writeText(normalized.value); } catch {}
}
</script>

<style scoped>

.color-field {
  --color-size: 2.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1 1 calc(25% - 0.5rem);
  min-width: 11rem;
  max-width: 20rem;
  padding: 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid var(--card-border);
  backdrop-filter: blur(4px);
  background: color-mix(in srgb, var(--card-bg) 70%, transparent);
  position: relative;
}

.color-field:hover {
  background: color-mix(in srgb, var(--card-bg) 80%, transparent);
}

.color-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.color-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-secondary);
}

.color-copy {
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  padding: 0.25rem;
  color: var(--text-secondary);
  transition: color .2s, background .2s;
}

.color-copy:hover,
.color-copy:focus-visible {
  color: var(--text-primary);
  background: var(--bg-chat);
  outline: none;
}

.color-shell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.picker-wrapper { position: relative; }

.color-input {
  width: var(--color-size);
  height: var(--color-size);
  padding: 0;
  border-radius: 0.5rem;
  cursor: pointer;
  border: 1px solid var(--card-border);
  background: transparent;
}

.color-input::-webkit-color-swatch-wrapper { padding: 0; }
.color-input::-webkit-color-swatch { border: none; border-radius: 4px; }

.swatch-ring {
  position: absolute;
  inset: 0;
  border-radius: 0.5rem;
  pointer-events: none;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.15) inset;
}

html.dark .swatch-ring {
  box-shadow: 0 0 0 2px rgba(255,255,255,0.07) inset, 0 0 0 1px var(--card-border);
}

.hex-input {
  flex: 1;
  background: transparent;
  border: 1px solid var(--card-border);
  border-radius: 0.5rem;
  padding: 0 0.5rem;
  height: var(--color-size);
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  letter-spacing: .05em;
}

.hex-input:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--primary-600,#ca004b);
}

@media (max-width: 640px) {
  .color-field {
    flex: 1 1 100%;
    width: 100%;
    max-width: 100%;
  }
}
</style>
