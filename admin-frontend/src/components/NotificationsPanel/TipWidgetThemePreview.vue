<template>
  <div class="tip-theme-preview">
    <div :class="wrapperClasses" :style="styleVars">
      <div v-if="showGif" class="tip-theme-preview__gif" aria-hidden="true">
        <img :src="gifUrl" alt="" loading="lazy" decoding="async" />
      </div>
      <div v-if="resolvedTheme === 'deterministic'" class="tip-theme-preview__card deterministic">
        <div class="deterministic__header">
          <span class="deterministic__badge">{{ sample.badge }}</span>
          <span class="deterministic__amount">{{ sample.arAmount }}</span>
        </div>
        <div class="deterministic__body">
          <div class="deterministic__usd">{{ sample.usdAmount }}</div>
          <div class="deterministic__from">{{ sample.from }}</div>
          <div class="deterministic__msg">{{ sample.msg }}</div>
        </div>
      </div>
      <div v-else class="tip-theme-preview__card classic">
        <div class="classic__title">{{ sample.title }}</div>
        <div class="classic__amount-row">
          <span class="classic__amount">{{ sample.arAmount }}</span>
          <span class="classic__usd">{{ sample.usdAmount }}</span>
        </div>
        <div class="classic__from">{{ sample.from }}</div>
        <div class="classic__msg">{{ sample.msg }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

/**
 * @typedef {'classic' | 'deterministic'} WidgetTheme
 * @typedef {'left' | 'right' | 'top' | 'bottom'} GifPosition
 * @typedef {Object} ThemePreviewColors
 * @property {string} [bg]
 * @property {string} [font]
 * @property {string} [border]
 * @property {string} [amount]
 * @property {string} [from]
 */

const props = defineProps({
  theme: { type: String, required: true },
  colors: { type: Object, required: true },
  gifPosition: { type: String, required: true },
  gifUrl: { type: String, default: '' },
});

const sample = {
  title: '🎉 Tip Received. Woohoo!',
  badge: '🎉 Tip Received',
  arAmount: '0.50 AR',
  usdAmount: '($2.50 USD)',
  from: '🧑‍🚀 From: Spaceman…',
  msg: 'This is a fake notification. Thanks for the stream!',
};

const resolvedTheme = computed(() =>
  props.theme === 'deterministic' ? 'deterministic' : 'classic'
);
const showGif = computed(() => Boolean(props.gifUrl));

const wrapperClasses = computed(() => [
  'tip-theme-preview__wrapper',
  `position-${props.gifPosition}`,
  `theme-${resolvedTheme.value}`,
  showGif.value ? 'has-gif' : 'no-gif',
]);

const styleVars = computed(() => ({
  '--tn-bg': props.colors.bg || '#080c10',
  '--tn-text': props.colors.font || '#ffffff',
  '--tn-border': props.colors.border || '#00ff7f',
  '--tn-amount': props.colors.amount || '#00ff7f',
  '--tn-from': props.colors.from || '#ffffff',
}));

const gifUrl = computed(() => props.gifUrl || '');
</script>

<style scoped>
.tip-theme-preview {
  width: 100%;
  border: 1px solid var(--border, var(--border-color));
  border-radius: 12px;
  padding: 8px;
  background: color-mix(in srgb, var(--card, rgb(16 16 16)) 80%, transparent);
}

.tip-theme-preview__wrapper {
  display: flex;
  gap: 14px;
  align-items: stretch;
  justify-content: flex-start;
  transition: all 0.25s ease;
}

.tip-theme-preview__wrapper.position-left {
  flex-direction: row;
}
.tip-theme-preview__wrapper.position-right {
  flex-direction: row-reverse;
}
.tip-theme-preview__wrapper.position-top {
  flex-direction: column;
  align-items: center;
}
.tip-theme-preview__wrapper.position-bottom {
  flex-direction: column-reverse;
  align-items: center;
}

.tip-theme-preview__gif {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: 10px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  background: color-mix(in srgb, var(--card, #14161f) 65%, transparent);
  min-width: 120px;
  min-height: 90px;
}
.tip-theme-preview__gif img {
  max-width: 160px;
  max-height: 160px;
  border-radius: 6px;
}

.tip-theme-preview__card {
  flex: 1 1 auto;
  border-radius: 6px;
  padding: 16px 18px;
  min-width: 0;
  color: var(--tn-text, #ffffff);
  background: var(--tn-bg, #080c10);
  border-left: 6px solid var(--tn-border, #00ff7f);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tip-theme-preview__card.classic .classic__title {
  font-weight: 700;
  font-size: 16px;
}
.tip-theme-preview__card.classic .classic__amount-row {
  display: flex;
  gap: 12px;
  align-items: baseline;
}
.tip-theme-preview__card.classic .classic__amount {
  font-size: 22px;
  font-weight: 800;
  color: var(--tn-amount, #00ff7f);
}
.tip-theme-preview__card.classic .classic__usd {
  font-size: 16px;
  font-weight: 700;
}
.tip-theme-preview__card.classic .classic__from {
  font-size: 13px;
  color: var(--tn-from, #ffffff);
}
.tip-theme-preview__card.classic .classic__msg {
  font-size: 12px;
}

.tip-theme-preview__card.deterministic {
  background-image: linear-gradient(-20deg, #22213d 0%, #121212 100%);
  border-left: none;
  gap: 14px;
}

.deterministic__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.deterministic__badge {
  font-size: 14px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  background: #252525;
}
.deterministic__amount {
  font-size: 24px;
  font-weight: 800;
  color: #ffffff;
}
.deterministic__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.deterministic__usd {
  font-size: 18px;
  font-weight: 800;
  color: #18ff4a;
}
.deterministic__from {
  font-size: 12px;
  font-weight: 600;
  color: var(--tn-from, #ffffff);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.deterministic__msg {
  font-size: 16px;
  line-height: 1.4;
}

.tip-theme-preview__wrapper.theme-classic.has-gif .tip-theme-preview__card,
.tip-theme-preview__wrapper.theme-deterministic.has-gif .tip-theme-preview__card {
  min-width: 220px;
}

@media (max-width: 720px) {
  .tip-theme-preview {
    padding: 12px;
  }
  .tip-theme-preview__wrapper {
    flex-direction: column;
    align-items: center;
  }
}
</style>
