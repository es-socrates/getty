<template>
  <section class="admin-tab active" role="form">
    <OsCard :title="t('monthlyGoalTitle')" class="mb-4" aria-describedby="tip-goal-desc">
      <p id="tip-goal-desc" class="sr-only">Configuration for tip goal title, wallet, amounts and colors.</p>
      <div class="form-group" aria-live="polite">
        <label class="label" for="tip-goal-title">{{ t('tipGoalCustomTitleLabel') }}</label>
        <input class="input" :aria-invalid="!!errors.title" :class="{'input-error': errors.title}" id="tip-goal-title" v-model="form.title" type="text" maxlength="120" :placeholder="t('tipGoalCustomTitlePlaceholder')" />
        <div class="flex gap-2 small" style="justify-content:space-between;">
          <small>{{ errors.title || t('tipGoalCustomTitleHint') }}</small>
          <small aria-live="polite" aria-atomic="true">{{ t('charsUsed', { used: form.title.length, max: 120 }) }}</small>
        </div>
      </div>
      <div class="form-group mt-2">
        <label class="label" for="tip-goal-theme">{{ t('tipGoalThemeLabel') }}</label>
        <select id="tip-goal-theme" v-model="form.theme" class="input">
          <option value="classic">{{ t('tipGoalThemeClassic') }}</option>
          <option value="modern-list">{{ t('tipGoalThemeModern') }}</option>
        </select>
      </div>
      <div class="form-group mt-2">
        <label class="label" for="tip-goal-wallet-address">{{ t('arWalletAddress') }}</label>
        <input class="input" :aria-invalid="!!errors.walletAddress" :class="{'input-error': errors.walletAddress}" id="tip-goal-wallet-address" v-model="form.walletAddress" type="text" />
        <small v-if="errors.walletAddress" class="small" style="color:#b91c1c">{{ errors.walletAddress }}</small>
      </div>
      <div class="form-group mt-2">
        <label class="label" for="goal-amount">{{ t('monthlyGoal') }}</label>
        <input class="input" :aria-invalid="!!errors.goalAmount" :class="{'input-error': errors.goalAmount}" id="goal-amount" v-model.number="form.goalAmount" type="number" min="1" />
  <small v-if="errors.goalAmount" class="small" style="color:#b91c1c">{{ errors.goalAmount }}</small>
      </div>
      <div class="form-group mt-2">
        <label class="label" for="starting-amount">{{ t('initialAmount') }}</label>
        <input class="input" :aria-invalid="!!errors.startingAmount" :class="{'input-error': errors.startingAmount}" id="starting-amount" v-model.number="form.startingAmount" type="number" min="0" />
        <small v-if="errors.startingAmount" class="small" style="color:#b91c1c">{{ errors.startingAmount }}</small>
      </div>
      <div class="mt-3">
        <div class="flex justify-between items-center mb-2">
          <h3 class="os-card-title mb-0">{{ t('colorCustomizationTitle') }}</h3>
          <button type="button" class="btn" @click="resetColors" :aria-label="t('resetColors')">{{ t('resetColors') }}</button>
        </div>
        <div class="flex flex-wrap gap-2">
          <ColorInput v-for="c in colorFields" :key="c.key" v-model="form.colors[c.key]" :label="t(c.label)" />
        </div>
      </div>
      <div class="mt-3">
  <h3 class="os-card-title mb-2">{{ t('audioSettingsTitle') }}</h3>
        <div class="form-group">
          <label class="label" for="audio-source">{{ t('audioSourceLabel') }}</label>
          <select id="audio-source" v-model="form.audioSource" class="input">
            <option value="remote">{{ t('audioSourceRemote') }}</option>
            <option value="custom">{{ t('audioSourceCustom') }}</option>
          </select>
        </div>
        <div v-if="form.audioSource === 'custom'" class="form-group mt-2">
          <label class="label" for="custom-audio-upload">{{ t('customAudioUploadLabel') }}</label>
          <input id="custom-audio-upload" type="file" accept="audio/*" @change="onAudioFileChange" :disabled="saving" />
          <div v-if="audioState.hasCustomAudio" class="mt-2">
            <div class="flex gap-2 items-center">
              <span>{{ t('customAudioFileName') }}: <b>{{ audioState.audioFileName }}</b></span>
              <span>{{ t('customAudioFileSize') }}: <b>{{ formatSize(audioState.audioFileSize) }}</b></span>
              <button class="btn btn-danger" @click="deleteCustomAudio" :disabled="saving">{{ t('deleteCustomAudio') }}</button>
            </div>
          </div>
        </div>
        <button class="btn mt-3" :disabled="saving" @click="save" :aria-busy="saving ? 'true':'false'">{{ saving ? t('commonSaving') : t('saveSettings') }}</button>
      </div>
  </OsCard>
  <OsCard class="mt-4" :title="t('obsIntegration')">
      <div class="form-group">
        <div class="flex flex-wrap items-center gap-3">
          <span class="label mb-0">{{ t('tipGoalWidgetUrl') }}</span>
          <CopyField :value="widgetUrl" :aria-label="t('tipGoalWidgetUrl')" />
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
import { MAX_TITLE_LEN, isLikelyWallet } from '../utils/validation';
import OsCard from './os/OsCard.vue'

const { t } = useI18n();

const original = reactive({ snapshot: null });

const form = reactive({
  title: '',
  walletAddress: '',
  goalAmount: 10,
  startingAmount: 0,
  theme: 'classic',
  colors: {
    bg: '#080c10',
    font: '#ffffff',
    border: '#00ff7f',
    progress: '#00ff7f'
  },
  audioSource: 'remote'
});

const audioState = reactive({
  hasCustomAudio: false,
  audioFileName: '',
  audioFileSize: 0
});

const audioFile = ref(null);

const errors = reactive({
  title: '',
  walletAddress: '',
  goalAmount: '',
  startingAmount: ''
});

const saving = ref(false);

const colorFields = [
  { key: 'bg', label: 'colorBg' },
  { key: 'font', label: 'colorFont' },
  { key: 'border', label: 'colorBorder' },
  { key: 'progress', label: 'colorProgress' }
];

const widgetUrl = computed(() => `${location.origin}/widgets/tip-goal`);

function resetColors() {
  form.colors = { bg: '#080c10', font: '#ffffff', border: '#00ff7f', progress: '#00ff7f' };
}

async function load() {
  try {
    const { data } = await api.get('/api/tip-goal');
    if (data && data.success) {
      form.walletAddress = data.walletAddress || '';
      form.goalAmount = data.monthlyGoal || data.goalAmount || form.goalAmount;
      form.startingAmount = data.currentAmount ?? form.startingAmount;
      form.title = data.title || '';
      form.theme = data.theme || 'classic';
      form.colors.bg = data.bgColor || form.colors.bg;
      form.colors.font = data.fontColor || form.colors.font;
      form.colors.border = data.borderColor || form.colors.border;
      form.colors.progress = data.progressColor || form.colors.progress;
      form.audioSource = data.audioSource || 'remote';
      original.snapshot = JSON.stringify(form);
    }

    const audioRes = await api.get('/api/goal-audio-settings');
    if (audioRes && audioRes.data) {
      audioState.hasCustomAudio = !!audioRes.data.hasCustomAudio;
      audioState.audioFileName = audioRes.data.audioFileName || '';
      audioState.audioFileSize = audioRes.data.audioFileSize || 0;
    }
  } catch (e) {
    if (!(e.response && e.response.status === 404)) {
      pushToast({ type: 'error', message: t('loadFailedTipGoal') });
    }
  }
}

async function save() {
  if (!validate()) return;
  try {
    saving.value = true;
    const payload = {
      walletAddress: form.walletAddress,
      goalAmount: form.goalAmount,
      startingAmount: form.startingAmount,
      currentAmount: form.startingAmount,
      theme: form.theme,
      bgColor: form.colors.bg,
      fontColor: form.colors.font,
      borderColor: form.colors.border,
      progressColor: form.colors.progress,
      title: form.title,
      audioSource: form.audioSource
    };
    let res;
    if (form.audioSource === 'custom' && audioFile.value) {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
      fd.append('audioFile', audioFile.value);
      res = await api.post('/api/tip-goal', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    } else {
      res = await api.post('/api/tip-goal', payload);
    }
    if (res && res.data && res.data.success) {
      original.snapshot = JSON.stringify(form);
      pushToast({ type: 'success', message: t('savedTipGoal') });
      await load();
      audioFile.value = null;
    } else {
      pushToast({ type: 'error', message: t('saveFailedTipGoal') });
    }
  } catch {
    pushToast({ type: 'error', message: t('saveFailedTipGoal') });
  } finally {
    saving.value = false;
  }
}

function onAudioFileChange(e) {
  const file = e.target.files[0];
  if (file && file.type.startsWith('audio/')) {
    audioFile.value = file;
  } else {
    pushToast({ type: 'error', message: t('invalidAudioFile') });
    audioFile.value = null;
  }
}

async function deleteCustomAudio() {
  if (!audioState.hasCustomAudio) return;
  try {
    saving.value = true;
    await api.delete('/api/goal-audio-settings');
    pushToast({ type: 'success', message: t('deletedCustomAudio') });
    await load();
    audioFile.value = null;
  } catch {
    pushToast({ type: 'error', message: t('deleteFailedCustomAudio') });
  } finally {
    saving.value = false;
  }
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function validate() {
  errors.title = form.title.length > MAX_TITLE_LEN ? t('valMax120') : '';
  errors.walletAddress = form.walletAddress && !isLikelyWallet(form.walletAddress) ? t('valTooShort') : '';
  errors.goalAmount = (form.goalAmount || 0) < 1 ? t('valMin1') : '';
  errors.startingAmount = (form.startingAmount || 0) < 0 ? t('valInvalid') : '';
  return !errors.title && !errors.walletAddress && !errors.goalAmount && !errors.startingAmount;
}

function isTipGoalDirty() {
  return original.snapshot && original.snapshot !== JSON.stringify(form);
}
registerDirty(isTipGoalDirty);
watch(form, () => {}, { deep: true });

onMounted(load);

</script>
