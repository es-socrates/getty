<template>
  <div class="input-group" role="group">
    <input
      class="grouped-input"
      :value="value"
      readonly
      @focus="$event.target.select()"
      :aria-label="ariaLabel || t('chatWidgetUrl')"
    />
    <button
      class="grouped-btn"
      type="button"
      @click="copy"
      :aria-label="t('copy')"
    >
      {{ t('copy') }}
    </button>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { pushToast } from '../../services/toast';

const { t } = useI18n();
const props = defineProps({
  value: { type: String, required: true },
  toast: { type: String, default: 'urlCopied' },
  ariaLabel: { type: String, default: '' },
});

function copy() {
  navigator.clipboard.writeText(props.value);
  pushToast({ type: 'success', message: t(props.toast) });
}
</script>
