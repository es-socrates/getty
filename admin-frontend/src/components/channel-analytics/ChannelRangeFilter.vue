<template>
  <div class="range-filter" role="radiogroup" :aria-label="t('channelRangeLabel')">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="range-btn"
      :class="{ active: option.value === modelValue }"
      :aria-pressed="option.value === modelValue"
      @click="select(option.value)">
      {{ option.label }}
    </button>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ChannelAnalyticsRange } from '../../services/channelAnalytics';

interface Props {
  modelValue: ChannelAnalyticsRange;
}

const props = defineProps<Props>();
const emit = defineEmits<{ 'update:modelValue': [ChannelAnalyticsRange] }>();
const { t } = useI18n();

const options = computed(() => [
  { value: 'day' as ChannelAnalyticsRange, label: t('channelRangeDay') },
  { value: 'week' as ChannelAnalyticsRange, label: t('channelRangeWeek') },
  { value: 'month' as ChannelAnalyticsRange, label: t('channelRangeMonth') },
  { value: 'halfyear' as ChannelAnalyticsRange, label: t('channelRangeHalfYear') },
  { value: 'year' as ChannelAnalyticsRange, label: t('channelRangeYear') },
]);

function select(value: ChannelAnalyticsRange) {
  if (value === props.modelValue) return;
  emit('update:modelValue', value);
}
</script>
<style scoped>
.range-filter {
  display: inline-flex;
  border: 1px solid var(--card-border, rgba(148, 163, 184, 0.3));
  border-radius: 999px;
  padding: 0.15rem;
  gap: 0.15rem;
  background: rgba(148, 163, 184, 0.12);
}
.range-btn {
  border: none;
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  font-weight: 600;
  background: transparent;
  color: var(--text-secondary, #475569);
  transition: background 0.2s ease, color 0.2s ease;
}
.range-btn:hover {
  background: rgba(148, 163, 184, 0.25);
}
.range-btn.active {
  background: #553fee;
  color: #fff;
}
</style>
