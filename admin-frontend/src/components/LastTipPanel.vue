<template>
  <section class="admin-tab active" role="form">
    <OsCard class="mb-4">
      <div class="form-group">
        <label class="label" for="last-tip-title">{{ t('lastTipCustomTitleLabel') }}</label>
        <input
          class="input"
          :class="{ 'input-error': errors.title }"
          id="last-tip-title"
          v-model="form.title"
          type="text"
          maxlength="120"
          :placeholder="t('lastTipCustomTitlePlaceholder')" />
        <div class="flex gap-2 small justify-between">
          <small>{{ errors.title || t('lastTipCustomTitleHint') }}</small>
          <small aria-live="polite" aria-atomic="true">{{
            t('charsUsed', { used: form.title.length, max: 120 })
          }}</small>
        </div>
      </div>
      <div class="form-group mt-2">
        <label class="label" for="wallet-address">{{ t('arWalletAddress') }}</label>
        <input
          class="input"
          :class="{ 'input-error': errors.walletAddress }"
          id="wallet-address"
          v-model="form.walletAddress"
          :disabled="!walletEditable"
          type="text" />
        <small v-if="errors.walletAddress" class="small text-red-700">{{
          errors.walletAddress
        }}</small>
        <small v-else class="small opacity-70">{{ t('walletClearHint') }}</small>
        <small v-if="walletHiddenMsg" class="small opacity-70">{{ walletHiddenMsg }}</small>
      </div>
      <div class="mt-3">
        <div class="flex justify-between items-center mb-2">
          <h3 class="os-card-title mb-0">{{ t('colorCustomizationTitle') }}</h3>
        </div>
        <div class="flex flex-wrap gap-2">
          <ColorInput
            v-for="c in colorFields"
            :key="c.key"
            v-model="form.colors[c.key]"
            :label="t(c.label)" />
        </div>
      </div>
      <div class="mt-3">
        <button class="btn" :disabled="saving" @click="save" :aria-busy="saving ? 'true' : 'false'">
          {{ saving ? t('commonSaving') : t('saveSettings') }}
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-compact-secondary ml-2"
          @click="resetColors"
          :aria-label="t('resetColors')">
          {{ t('resetColors') }}
        </button>
      </div>
    </OsCard>
    <OsCard class="mt-4" :title="t('obsIntegration')">
      <div class="form-group">
        <div class="flex flex-wrap items-center gap-3">
          <span class="label mb-0">{{ t('lastTipWidgetUrl') }}</span>
          <CopyField :value="widgetUrl" :aria-label="t('lastTipWidgetUrl')" />
        </div>
      </div>
    </OsCard>
  </section>
</template>
<script setup>
import { reactive, computed, onMounted, watch, ref } from 'vue';
import { registerDirty } from '../composables/useDirtyRegistry';
import { useI18n } from 'vue-i18n';
import api from '../services/api';
import ColorInput from './shared/ColorInput.vue';
import CopyField from './shared/CopyField.vue';
import { pushToast } from '../services/toast';
import { MAX_TITLE_LEN, isArweaveAddress } from '../utils/validation';
import { usePublicToken } from '../composables/usePublicToken';
import OsCard from './os/OsCard.vue';

const original = reactive({ snapshot: null });

const { t } = useI18n();
const form = reactive({
  title: '',
  walletAddress: '',
  colors: {
    bg: '#080c10',
    font: '#ffffff',
    border: '#00ff7f',
    amount: '#00ff7f',
    iconBg: '#4f36ff',
    from: '#817ec8',
  },
});
const errors = reactive({ title: '', walletAddress: '' });
const saving = ref(false);
const hostedSupported = ref(false);
const sessionActive = ref(false);
const walletHiddenMsg = ref('');
const walletEditable = ref(true);
const colorFields = [
  { key: 'bg', label: 'colorBg' },
  { key: 'font', label: 'colorFont' },
  { key: 'border', label: 'colorBorder' },
  { key: 'amount', label: 'colorAmount' },
  { key: 'iconBg', label: 'colorIconBg' },
  { key: 'from', label: 'colorFrom' },
];
const pt = usePublicToken();
const widgetUrl = computed(() => pt.withToken(`${location.origin}/widgets/last-tip`));

function resetColors() {
  form.colors = {
    bg: '#080c10',
    font: '#ffffff',
    border: '#00ff7f',
    amount: '#00ff7f',
    iconBg: '#4f36ff',
    from: '#817ec8',
  };
}
async function load() {
  try {
    const statusRes = await api.get('/api/session/status').catch(() => ({ data: {} }));
    hostedSupported.value = !!statusRes?.data?.supported;
    sessionActive.value = !!statusRes?.data?.active;

    const { data } = await api.get('/api/last-tip');
    if (data && data.success) {
      const hasWalletField = Object.prototype.hasOwnProperty.call(data, 'walletAddress');
      if (hasWalletField) {
        form.walletAddress = data.walletAddress || '';
        walletHiddenMsg.value = '';
        walletEditable.value = true;
      } else {
        if (hostedSupported.value && !sessionActive.value) {
          walletHiddenMsg.value = t('walletHiddenHostedNotice');
        } else if (!hostedSupported.value) {
          walletHiddenMsg.value = t('walletHiddenLocalNotice');
        } else {
          walletHiddenMsg.value = '';
        }
        form.walletAddress = '';
        walletEditable.value = false;
      }

      const walletEmpty = !form.walletAddress || form.walletAddress.trim() === '';
      const incomingTitle = typeof data.title === 'string' ? data.title.trim() : '';
      const demoTitles = new Set(['Last tip received 👏', 'Configure tip goal 💸']);
      const isSeed = walletEmpty && (!incomingTitle || demoTitles.has(incomingTitle));
      form.title = isSeed ? '' : incomingTitle || '';
      form.colors.bg = data.bgColor || form.colors.bg;
      form.colors.font = data.fontColor || form.colors.font;
      form.colors.border = data.borderColor || form.colors.border;
      form.colors.amount = data.amountColor || form.colors.amount;
      form.colors.iconBg = data.iconBgColor || form.colors.iconBg;
      form.colors.from = data.fromColor || form.colors.from;
      original.snapshot = JSON.stringify(form);
    }
  } catch (e) {
    if (!(e.response && e.response.status === 404)) {
      pushToast({ type: 'error', message: t('loadFailedLastTip') });
    }
  }
}
async function save() {
  if (hostedSupported.value && !sessionActive.value) {
    pushToast({ type: 'info', message: t('sessionRequiredToast') });
    return;
  }
  if (!validate()) return;
  try {
    saving.value = true;
    const payload = {
      bgColor: form.colors.bg,
      fontColor: form.colors.font,
      borderColor: form.colors.border,
      amountColor: form.colors.amount,
      iconBgColor: form.colors.iconBg,
      fromColor: form.colors.from,
      title: form.title,
    };
    if (walletEditable.value) {
      payload.walletAddress = form.walletAddress;
    }
    await api.post('/api/last-tip', payload);
    original.snapshot = JSON.stringify(form);
    pushToast({ type: 'success', message: t('savedLastTip') });
  } catch {
    pushToast({ type: 'error', message: t('saveFailedLastTip') });
  } finally {
    saving.value = false;
  }
}
function validate() {
  errors.title = form.title.length > MAX_TITLE_LEN ? t('valMax120') : '';
  if (form.walletAddress && !isArweaveAddress(form.walletAddress)) {
    errors.walletAddress = t('valArweaveOnly');
  } else {
    errors.walletAddress = '';
  }
  return !errors.title && !errors.walletAddress;
}

function isLastTipDirty() {
  return original.snapshot && original.snapshot !== JSON.stringify(form);
}
registerDirty(isLastTipDirty);
watch(form, () => {}, { deep: true });

onMounted(async () => {
  await pt.refresh();
  await load();
});
</script>
