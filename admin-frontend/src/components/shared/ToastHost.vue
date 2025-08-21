<template>
  <div
    class="toast-container"
    v-if="toasts.length"
    role="status"
    aria-live="assertive"
    aria-atomic="true"
  >
    <div
      v-for="t in toasts"
      :key="t.id"
      class="toast"
      :class="t.type"
      @click="remove(t.id)"
      :aria-label="t.message"
    >
      {{ t.message }}
    </div>
  </div>
</template>

<script setup>
import { toasts, removeToast as remove } from '../../services/toast';
</script>

<style>
.toast-container {
  position: fixed;
  bottom: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
}

.toast {
  background: #1e293b;
  color: #fff;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.toast.success { background: #553fee; }
.toast.error { background: #b91c1c; }
.toast.info { background: #0369a1; }
</style>
