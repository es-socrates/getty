<template>
  <section class="admin-tab active tip-goal-root" role="form">
    <div class="tip-goal-grid">
      <div class="tip-goal-box" aria-labelledby="tip-goal-basics-title">
        <div class="tip-goal-head">
          <HeaderIcon>
            <i class="pi pi-bullseye" aria-hidden="true"></i>
          </HeaderIcon>
          <h3 id="tip-goal-basics-title" class="tip-goal-title">{{ t('tipGoalBasicsTitle') }}</h3>
        </div>

        <div class="tip-setting-item is-vertical" aria-live="polite">
          <div class="tip-setting-text">
            <div class="tip-setting-title">{{ t('tipGoalCustomTitleLabel') }}</div>
            <div class="tip-setting-desc">{{ t('tipGoalCustomTitleHint') }}</div>
          </div>
          <div class="tip-setting-control full-width">
            <input
              class="input"
              :aria-invalid="!!errors.title"
              :class="{ 'input-error': errors.title }"
              id="tip-goal-title"
              v-model="form.title"
              type="text"
              maxlength="120"
              :placeholder="t('tipGoalCustomTitlePlaceholder')" />
            <div class="tip-field-foot">
              <span :class="errors.title ? 'error' : ''">{{
                errors.title || t('tipGoalCustomTitleHint')
              }}</span>
              <span aria-live="polite" aria-atomic="true">{{
                t('charsUsed', { used: form.title.length, max: 120 })
              }}</span>
            </div>
          </div>
        </div>

        <div class="tip-setting-item">
          <div class="tip-setting-text">
            <div class="tip-setting-title">{{ t('tipGoalThemeLabel') }}</div>
            <div class="tip-setting-desc">{{ t('tipWidgetThemeDesc') }}</div>
          </div>
          <div class="tip-setting-control">
            <select id="tip-goal-theme" v-model="form.theme" class="input select">
              <option value="classic">{{ t('tipGoalThemeClassic') }}</option>
              <option value="modern-list">{{ t('tipGoalThemeModern') }}</option>
            </select>
          </div>
        </div>

        <div class="tip-setting-item">
          <div class="tip-setting-text">
            <div class="tip-setting-title">{{ t('monthlyGoal') }}</div>
            <div class="tip-setting-desc">{{ t('tipGoalAmountHint') }}</div>
          </div>
          <div class="tip-setting-control">
            <input
              id="tip-goal-target"
              class="input"
              type="number"
              min="1"
              v-model.number="form.goalAmount"
              :aria-invalid="!!errors.goalAmount"
              :class="{ 'input-error': errors.goalAmount }" />
            <div class="tip-field-foot">
              <span :class="errors.goalAmount ? 'error' : ''">{{ errors.goalAmount }}</span>
            </div>
          </div>
        </div>

        <div class="tip-setting-item">
          <div class="tip-setting-text">
            <div class="tip-setting-title">{{ t('initialAmount') }}</div>
            <div class="tip-setting-desc">{{ t('tipGoalStartingHint') }}</div>
          </div>
          <div class="tip-setting-control">
            <input
              id="tip-goal-current"
              class="input"
              type="number"
              min="0"
              v-model.number="form.startingAmount"
              :aria-invalid="!!errors.startingAmount"
              :class="{ 'input-error': errors.startingAmount }" />
            <div class="tip-field-foot">
              <span :class="errors.startingAmount ? 'error' : ''">{{ errors.startingAmount }}</span>
            </div>
          </div>
        </div>

        <div class="tip-setting-item is-vertical">
          <div class="tip-setting-text">
            <div class="tip-setting-title">{{ t('arWalletAddress') }}</div>
            <div class="tip-setting-desc">{{ walletHint }}</div>
          </div>
          <div class="tip-setting-control full-width">
            <input
              id="tip-goal-wallet"
              class="input"
              type="text"
              v-model="form.walletAddress"
              :disabled="!walletEditable"
              :aria-invalid="!!errors.walletAddress"
              :class="{ 'input-error': errors.walletAddress }" />
            <div class="tip-field-foot">
              <span :class="errors.walletAddress ? 'error' : ''">{{
                errors.walletAddress || walletHint
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="tip-goal-box" aria-labelledby="tip-goal-colors-title">
        <div class="tip-goal-head">
          <HeaderIcon>
            <svg
              class="os-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M14.31 8l5.74 9.94" />
              <path d="M9.69 8h11.48" />
              <path d="M7.38 12l5.74-9.94" />
              <path d="M9.69 16L3.95 6.06" />
              <path d="M14.31 16H2.83" />
            </svg>
          </HeaderIcon>
          <h3 id="tip-goal-colors-title" class="tip-goal-title">
            {{ t('colorCustomizationTitle') }}
          </h3>
        </div>
        <div class="tip-setting-title mb-2">{{ t('colorCustomizationTitle') }}</div>
        <div class="tip-colors-grid">
          <ColorInput v-model="form.colors.bg" :label="t('colorBg')" />
          <ColorInput v-model="form.colors.font" :label="t('colorFont')" />
          <ColorInput v-model="form.colors.border" :label="t('colorBorder')" />
          <ColorInput v-model="form.colors.progress" :label="t('colorProgress')" />
        </div>
        <div class="tip-colors-actions">
          <button type="button" class="btn-secondary btn-compact-secondary" @click="resetColors">
            {{ t('resetColors') }}
          </button>
        </div>
        <div class="tip-preview-wrapper">
          <div class="tip-preview-card" :style="previewStyles">
            <div class="tp-title">{{ previewTitle }}</div>
            <div class="tp-amount-row">
              <span class="tp-amount">{{ formattedCurrent }} AR</span>
              <span class="tp-goal-label">/ {{ formattedGoal }} AR</span>
            </div>
            <div class="tp-remaining">{{ remainingLabel }}</div>
            <div class="tp-progress-track">
              <div class="tp-progress-fill" :style="{ width: `${progressPercent}%` }"></div>
            </div>
            <div class="tp-desc">{{ t('tipGoalPreviewHint') }}</div>
          </div>
        </div>
      </div>

      <div class="tip-goal-box" aria-labelledby="tip-goal-audio-title">
        <div class="tip-goal-head">
          <HeaderIcon>
            <svg
              class="os-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round">
              <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6l-5 4H4a1 1 0 0 0-1 1Z" />
              <path d="M16 12h2" />
              <path d="M16 8h2" />
              <path d="M16 16h2" />
            </svg>
          </HeaderIcon>
          <h3 id="tip-goal-audio-title" class="tip-goal-title">{{ t('customAudioTitle') }}</h3>
        </div>
        <div class="tip-setting-item is-vertical">
          <div class="tip-setting-text">
            <div class="tip-setting-title">{{ t('audioSourceLabel') }}</div>
            <div class="tip-setting-desc">{{ t('tipGoalAudioHint') }}</div>
          </div>
          <LegacyAudioControls
            compact
            force-stack
            :show-label="false"
            :enabled="audioCfg.enabled"
            :volume="audioCfg.volume"
            :audio-source="audio.audioSource"
            :has-custom-audio="audioState.hasCustomAudio"
            :audio-file-name="audioState.audioFileName"
            :audio-file-size="audioState.audioFileSize"
            :audio-library-id="audioState.audioLibraryId"
            :library-enabled="true"
            :storage-provider="selectedStorageProvider"
            :storage-providers="storageOptions"
            :storage-loading="storageLoading"
            save-endpoint="/api/goal-audio-settings"
            delete-endpoint="/api/goal-audio-settings"
            custom-audio-endpoint="/api/goal-custom-audio"
            @update:enabled="(val) => (audioCfg.enabled = val)"
            @update:volume="(val) => (audioCfg.volume = val)"
            @update:audio-source="(val) => (audio.audioSource = val)"
            @update:storage-provider="(val) => storage.setSelectedProvider(val)"
            @audio-saved="handleAudioSaved"
            @audio-deleted="handleAudioDeleted"
            @toast="handleAudioToast" />
        </div>
      </div>

      <div class="tip-goal-box" aria-labelledby="tip-goal-widget-title">
        <div class="tip-goal-head">
          <HeaderIcon>
            <svg
              class="os-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="12" y1="3" x2="12" y2="21" />
            </svg>
          </HeaderIcon>
          <h3 id="tip-goal-widget-title" class="tip-goal-title">{{ t('obsIntegration') }}</h3>
        </div>
        <div class="tip-setting-item is-vertical">
          <div class="tip-setting-text">
            <div class="tip-setting-title">{{ t('tipGoalWidgetUrl') }}</div>
            <div class="tip-setting-desc">{{ t('tipWidgetObsHint') }}</div>
          </div>
          <div class="copy-field-row">
            <CopyField :value="widgetUrl" :aria-label="t('tipGoalWidgetUrl')" />
          </div>
        </div>
      </div>
    </div>

    <div class="tip-actions">
      <button
        class="btn"
        type="button"
        :disabled="saving"
        @click="save"
        :aria-busy="saving ? 'true' : 'false'">
        {{ saving ? t('commonSaving') : t('saveSettings') }}
      </button>
    </div>
  </section>
</template>
<script setup>
import { reactive, computed, onMounted, watch, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { registerDirty } from '../composables/useDirtyRegistry';
import api from '../services/api';
import { pushToast } from '../services/toast';
import { MAX_TITLE_LEN, isArweaveAddress } from '../utils/validation';
import { useWalletSession } from '../composables/useWalletSession';
import { usePublicToken } from '../composables/usePublicToken';
import { useStorageProviders } from '../composables/useStorageProviders';
import CopyField from './shared/CopyField.vue';
import ColorInput from './shared/ColorInput.vue';
import LegacyAudioControls from './shared/LegacyAudioControls.vue';
import HeaderIcon from './shared/HeaderIcon.vue';

const { t } = useI18n();

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
    progress: '#00ff7f',
  },
});

const audio = reactive({ audioSource: 'remote' });
const audioCfg = reactive({ enabled: true, volume: 0.8 });

const audioState = reactive({
  hasCustomAudio: false,
  audioFileName: '',
  audioFileSize: 0,
  audioLibraryId: '',
  storageProvider: '',
});

const errors = reactive({
  title: '',
  walletAddress: '',
  goalAmount: '',
  startingAmount: '',
});

const saving = ref(false);
const hostedSupported = ref(false);
const sessionActive = ref(false);
const walletHiddenMsg = ref('');
const walletEditable = ref(true);

const originalSnapshot = ref('');

const wallet = useWalletSession();
const { withToken, refresh } = usePublicToken();
const widgetUrl = computed(() => withToken(`${location.origin}/widgets/tip-goal`));

const storage = useStorageProviders();
const selectedStorageProvider = computed({
  get: () => storage.selectedProvider.value,
  set: (val) => storage.setSelectedProvider(val),
});
const storageOptions = computed(() => storage.providerOptions.value);
const storageLoading = computed(() => storage.loading.value);

function resolveStorageSelection(preferred = '') {
  const candidates = [];
  if (preferred) candidates.push(preferred);
  if (audioState.storageProvider) candidates.push(audioState.storageProvider);
  storage.ensureSelection(candidates);
}

const previewStyles = computed(() => ({
  '--tg-bg': form.colors.bg || '#080c10',
  '--tg-font': form.colors.font || '#ffffff',
  '--tg-border': form.colors.border || '#00ff7f',
  '--tg-progress': form.colors.progress || '#00ff7f',
}));

const progressPercent = computed(() => {
  const goal = Number(form.goalAmount) || 0;
  if (goal <= 0) return 0;
  const current = Math.max(0, Number(form.startingAmount) || 0);
  return Math.min(100, Math.max(0, (current / goal) * 100));
});

function formatAr(amount) {
  const value = Number(amount || 0);
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const formattedGoal = computed(() => formatAr(form.goalAmount));
const formattedCurrent = computed(() => formatAr(form.startingAmount));
const remainingLabel = computed(() => {
  const goal = Number(form.goalAmount) || 0;
  const current = Number(form.startingAmount) || 0;
  const remaining = Math.max(0, goal - current);
  return t('tipGoalRemaining', { amount: formatAr(remaining) });
});
const previewTitle = computed(() => (form.title && form.title.trim()) || t('monthlyGoalTitle'));

const walletHint = computed(() => walletHiddenMsg.value || t('walletClearHint'));

function resetColors() {
  form.colors = { bg: '#080c10', font: '#ffffff', border: '#00ff7f', progress: '#00ff7f' };
}

function serializeSnapshot() {
  return JSON.stringify({
    title: form.title,
    walletAddress: form.walletAddress,
    goalAmount: form.goalAmount,
    startingAmount: form.startingAmount,
    theme: form.theme,
    colors: { ...form.colors },
    audioSource: audio.audioSource,
  });
}

async function loadTipGoal() {
  try {
    hostedSupported.value = true;
    sessionActive.value = true;

    const { data } = await api.get('/api/tip-goal');
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

      const incomingTitle = typeof data.title === 'string' ? data.title.trim() : undefined;
      if (incomingTitle) form.title = incomingTitle;

      const incomingGoal =
        typeof data.monthlyGoal === 'number'
          ? data.monthlyGoal
          : typeof data.goalAmount === 'number'
          ? data.goalAmount
          : undefined;
      if (typeof incomingGoal === 'number') form.goalAmount = incomingGoal;

      const incomingCurrent =
        typeof data.currentAmount === 'number'
          ? data.currentAmount
          : typeof data.startingAmount === 'number'
          ? data.startingAmount
          : typeof data.currentTips === 'number'
          ? data.currentTips
          : undefined;
      if (typeof incomingCurrent === 'number') form.startingAmount = incomingCurrent;

      if (typeof data.theme === 'string') form.theme = data.theme;
      if (typeof data.bgColor === 'string') form.colors.bg = data.bgColor;
      if (typeof data.fontColor === 'string') form.colors.font = data.fontColor;
      if (typeof data.borderColor === 'string') form.colors.border = data.borderColor;
      if (typeof data.progressColor === 'string') form.colors.progress = data.progressColor;
      if (typeof data.audioSource === 'string') audio.audioSource = data.audioSource;
      if (typeof data.storageProvider === 'string') {
        audioState.storageProvider = data.storageProvider;
        if (data.storageProvider) storage.registerProvider(data.storageProvider);
      }
    }
  } catch (e) {
    if (!(e?.response?.status === 404)) {
      pushToast({ type: 'error', message: t('loadFailedTipGoal') });
    }
  }
}

async function loadAudioState() {
  try {
    const { data } = await api.get('/api/goal-audio-settings');
    if (!data) return;
    audioState.hasCustomAudio = !!data.hasCustomAudio;
    audioState.audioFileName = data.audioFileName || '';
    audioState.audioFileSize = data.audioFileSize || 0;
    audioState.audioLibraryId = data.audioLibraryId || '';
    audioState.storageProvider =
      typeof data.storageProvider === 'string' ? data.storageProvider : audioState.storageProvider;
    if (typeof data.audioSource === 'string') audio.audioSource = data.audioSource;
    if (Object.prototype.hasOwnProperty.call(data, 'enabled')) {
      audioCfg.enabled = !!data.enabled;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'volume')) {
      const vol = Number(data.volume);
      if (!Number.isNaN(vol)) {
        audioCfg.volume = Math.min(Math.max(vol, 0), 1);
      }
    }
    if (audioState.storageProvider) storage.registerProvider(audioState.storageProvider);
  } catch (e) {
    if (!(e?.response?.status === 404)) {
      console.warn('[tip-goal] failed to load audio settings', e);
    }
  }
}

async function loadAll() {
  await loadTipGoal();
  await loadAudioState();
  resolveStorageSelection();
  originalSnapshot.value = serializeSnapshot();
}

async function save() {
  if (hostedSupported.value && !sessionActive.value) {
    pushToast({ type: 'info', message: t('sessionRequiredToast') });
    return;
  }
  if (!validate()) return;
  try {
    saving.value = true;
    const providerSelection = selectedStorageProvider.value;
    const payload = {
      goalAmount: form.goalAmount,
      startingAmount: form.startingAmount,
      currentAmount: form.startingAmount,
      theme: form.theme,
      bgColor: form.colors.bg,
      fontColor: form.colors.font,
      borderColor: form.colors.border,
      progressColor: form.colors.progress,
      title: form.title,
      audioSource: audio.audioSource,
      storageProvider: audio.audioSource === 'custom' ? providerSelection : '',
      audioEnabled: audioCfg.enabled,
      audioVolume: audioCfg.volume,
    };
    if (walletEditable.value) payload.walletAddress = form.walletAddress;

    const res = await api.post('/api/tip-goal', payload);
    if (res?.data?.success) {
      pushToast({ type: 'success', message: t('savedTipGoal') });
      await loadAll();
    } else {
      pushToast({ type: 'error', message: t('saveFailedTipGoal') });
    }
  } catch {
    pushToast({ type: 'error', message: t('saveFailedTipGoal') });
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
  errors.goalAmount = (form.goalAmount || 0) < 1 ? t('valMin1') : '';
  errors.startingAmount = (form.startingAmount || 0) < 0 ? t('valInvalid') : '';
  return !errors.title && !errors.walletAddress && !errors.goalAmount && !errors.startingAmount;
}

async function handleAudioSaved() {
  await loadAudioState();
  resolveStorageSelection();
}

async function handleAudioDeleted(_payload) {
  audio.audioSource = 'remote';
  await loadAudioState();
  resolveStorageSelection();
}

function handleAudioToast(payload) {
  if (!payload || !payload.messageKey) return;
  const message = t(payload.messageKey);
  if (!message) return;
  pushToast({ type: payload.type || 'info', message });
}

registerDirty(() => originalSnapshot.value !== serializeSnapshot());

watch(storageOptions, () => resolveStorageSelection());

onMounted(async () => {
  try {
    await wallet.refresh();
    await refresh();
  } catch {}
  await storage.fetchProviders();
  await loadAll();
});
</script>

<style scoped src="./TipGoalPanel/TipGoalPanel.css"></style>
