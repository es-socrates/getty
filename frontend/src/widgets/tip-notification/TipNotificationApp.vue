<template>
  <div ref="tipWrapper" class="tip-wrapper">
    <div ref="gifSlot" class="notification-gif-slot"></div>
    <div ref="notification" class="notification"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { mountTipNotification } from './tipNotificationCore';

const tipWrapper = ref<HTMLDivElement | null>(null);
const notification = ref<HTMLDivElement | null>(null);
const gifSlot = ref<HTMLDivElement | null>(null);

onMounted(() => {
  if (!tipWrapper.value || !notification.value || !gifSlot.value) {
    console.error('[tip-notification] Missing required DOM nodes');
    return;
  }
  mountTipNotification({
    tipWrapper: tipWrapper.value,
    notification: notification.value,
    gifSlot: gifSlot.value,
  });
});
</script>
