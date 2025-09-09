<template>
  <teleport to="body">
    <div
      v-if="state.open"
      class="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="os-confirm-title"
      aria-describedby="os-confirm-desc"
      @keydown.escape.prevent="onCancel"
      @click.self="onCancel">
      <div
        class="modal-card os-surface rounded-os border border-[var(--card-border)] p-4 shadow-os bg-[var(--bg-card)] max-w-[460px] w-full">
        <div class="modal-title text-sm font-semibold mb-1" id="os-confirm-title">
          {{ state.title }}
        </div>
        <div class="text-sm opacity-80 leading-6" id="os-confirm-desc">{{ state.description }}</div>
        <div class="modal-actions flex gap-2 mt-4 justify-end">
          <button type="button" class="btn" @click="onCancel">{{ state.cancelText }}</button>
          <button
            type="button"
            class="btn"
            :class="state.danger ? 'danger' : 'primary'"
            @click="onConfirm">
            {{ state.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { useConfirmState, resolveConfirm } from '../../services/confirm';

const state = useConfirmState();

function onCancel() {
  resolveConfirm(false);
}
function onConfirm() {
  resolveConfirm(true);
}

function onKeydown(e) {
  if (!state.open) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    onConfirm();
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
}
.modal-card {
  background: var(--bg-card);
}
.modal-title {
  color: var(--text-primary);
}
.modal-actions .btn.danger {
  background: #e11d48;
  color: #fff;
}
.modal-actions .btn.primary {
  background: #1f2937;
  color: #fff;
}
</style>
