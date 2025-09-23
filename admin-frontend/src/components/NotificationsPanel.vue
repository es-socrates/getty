<template>
  <section class="admin-tab active relative notif-root" role="form">
    <div
      v-if="masked"
      class="absolute inset-0 z-10 flex items-center justify-center backdrop-blur bg-black/35">
      <div
        class="p-5 rounded-os bg-[var(--bg-card)] border border-[var(--card-border)] shadow-lg max-w-md text-center">
        <div class="mb-2 text-lg font-semibold">{{ t('externalSessionRequiredTitle') }}</div>
        <p class="mb-4 text-sm">{{ t('externalSessionRequiredBody') }}</p>
        <a href="/" class="btn" aria-label="wallet-login-redirect">{{ t('createSession') }}</a>
      </div>
    </div>
    <div class="notif-groups-grid">
      <div class="notif-group-box" aria-labelledby="notif-gif-title">
        <div class="notif-group-head">
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
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </HeaderIcon>
          <h3 id="notif-gif-title" class="notif-group-title">{{ t('notificationGifTitle') }}</h3>
        </div>
        <div class="notif-setting-item">
          <div class="notif-setting-text">
            <div class="notif-setting-title">{{ t('notificationGifPositionLabel') }}</div>
            <div class="notif-setting-desc">{{ t('notificationGifHint') }}</div>
          </div>
          <div class="notif-setting-control">
            <select class="input select" v-model="gif.position" aria-label="GIF position">
              <option value="right">{{ t('positionRight') }}</option>
              <option value="left">{{ t('positionLeft') }}</option>
              <option value="top">{{ t('positionTop') }}</option>
              <option value="bottom">{{ t('positionBottom') }}</option>
            </select>
          </div>
        </div>
        <div class="notif-setting-item is-vertical" aria-label="GIF file controls">
          <input
            ref="gifInput"
            type="file"
            accept="image/gif"
            class="hidden"
            @change="onGifChange"
            aria-hidden="true" />
          <div
            class="gif-preview-box"
            :class="[`pos-${gif.position}`, { 'is-empty': !gif.gifPath, 'pos-pulse': posPulse }]"
            aria-live="off">
            <span class="gif-pos-label" aria-hidden="true">{{ t(posKeyMap[gif.position]) }}</span>
            <div class="gif-media" v-if="gif.gifPath">
              <img :src="gif.gifPath" :alt="gif.fileName" />
            </div>
            <div class="gif-media placeholder" v-else>
              <span class="placeholder-text">{{ t('notificationGifUnifiedHint') }}</span>
            </div>

            <div class="notif-demo" aria-hidden="true">
              <div class="nd-left" v-if="gif.position === 'left' || gif.position === 'top'"></div>
              <div class="nd-body">
                <div class="nd-line nd-amount">+ 0.25 AR</div>
                <div
                  class="nd-line nd-user"
                  :class="{ inline: gif.position === 'top' || gif.position === 'bottom' }">
                  Spaceman
                </div>
                <div
                  class="nd-line nd-msg"
                  :class="{ centered: gif.position === 'top' || gif.position === 'bottom' }">
                  Thanks for the stream!
                </div>
              </div>
            </div>
          </div>
          <div class="notif-actions-row">
            <button
              class="btn-secondary btn-compact-secondary"
              type="button"
              @click="triggerGif"
              :disabled="!sessionActive && hostedSupported"
              :aria-busy="savingGif ? 'true' : 'false'">
              {{ t('notificationGifChooseBtn') }}
            </button>
            <button
              v-if="gif.gifPath"
              class="btn-danger"
              type="button"
              @click="removeGif"
              :disabled="!sessionActive && hostedSupported"
              :aria-label="t('notificationGifRemoveBtn')">
              {{ t('notificationGifRemoveBtn') }}
            </button>
            <button
              class="btn-save"
              type="button"
              :disabled="savingGif || (!sessionActive && hostedSupported)"
              @click="saveGif"
              :aria-busy="savingGif ? 'true' : 'false'">
              {{ savingGif ? t('commonSaving') : t('saveSettings') }}
            </button>
          </div>
          <div v-if="gif.fileName" class="small mt-1 opacity-80">{{ gif.fileName }}</div>
          <div v-if="errors.gif" class="small mt-2 text-red-700">{{ errors.gif }}</div>
        </div>
      </div>

      <div class="notif-group-box" aria-labelledby="notif-tts-title">
        <div class="notif-group-head">
          <HeaderIcon>
            <svg
              class="os-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round">
              <path
                d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8.5 8.5Z" />
            </svg>
          </HeaderIcon>
          <h3 id="notif-tts-title" class="notif-group-title">{{ t('ttsSectionTitle') }}</h3>
        </div>
        <div class="notif-setting-item">
          <div class="notif-setting-text">
            <div class="notif-setting-title">{{ t('enableTextToSpeech') }}</div>
            <div class="notif-setting-desc">{{ t('ttsHint') }}</div>
          </div>
          <div class="notif-setting-control">
            <button
              type="button"
              class="switch"
              :aria-pressed="String(tts.enabled)"
              @click="tts.enabled = !tts.enabled">
              <span class="knob"></span>
            </button>
          </div>
        </div>
        <div class="notif-setting-item">
          <div class="notif-setting-text">
            <div class="notif-setting-title">{{ t('enableTtsAllChat') }}</div>
            <div class="notif-setting-desc">{{ t('enableTtsAllChat') }}</div>
          </div>
          <div class="notif-setting-control">
            <button
              type="button"
              class="switch"
              :disabled="!tts.enabled"
              :aria-disabled="(!tts.enabled).toString()"
              :aria-pressed="String(tts.allChat)"
              @click="tts.enabled && (tts.allChat = !tts.allChat)">
              <span class="knob"></span>
            </button>
          </div>
        </div>
        <div class="notif-setting-item">
          <div class="notif-setting-text">
            <div class="notif-setting-title">{{ t('ttsLanguage') }}</div>
            <div class="notif-setting-desc">{{ t('ttsLanguage') }}</div>
          </div>
          <div class="notif-setting-control">
            <select class="input select" v-model="tts.language">
              <option value="en">{{ t('english') }}</option>
              <option value="es">{{ t('spanish') }}</option>
            </select>
          </div>
        </div>
        <div class="notif-actions-row">
          <button
            class="btn-save"
            type="button"
            :disabled="savingTts || (!sessionActive && hostedSupported)"
            @click="saveTts"
            :aria-busy="savingTts ? 'true' : 'false'">
            {{ savingTts ? t('commonSaving') : t('saveSettings') }}
          </button>
        </div>
      </div>

      <div class="notif-group-box" aria-labelledby="notif-audio-title">
        <div class="notif-group-head">
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
          <h3 id="notif-audio-title" class="notif-group-title">{{ t('customAudioTitle') }}</h3>
        </div>
        <div class="notif-setting-item is-vertical">
          <LegacyAudioControls
            :enabled="audioCfg.enabled"
            :volume="audioCfg.volume"
            :audio-source="audio.audioSource"
            :has-custom-audio="audioState.hasCustomAudio"
            :audio-file-name="audioState.audioFileName"
            :audio-file-size="audioState.audioFileSize"
            force-stack
            compact
            @update:enabled="(v) => (audioCfg.enabled = v)"
            @update:volume="(v) => (audioCfg.volume = v)"
            @update:audio-source="(v) => (audio.audioSource = v)"
            @audio-saved="onAudioSaved"
            @audio-deleted="onAudioDeleted" />
          <div class="notif-actions-row mt-3">
            <button
              class="btn-save"
              type="button"
              :disabled="savingAudio || (!sessionActive && hostedSupported)"
              @click="persistAudioCfg">
              {{ savingAudio ? t('commonSaving') : t('saveSettings') }}
            </button>
            <button
              class="btn-secondary btn-compact-secondary"
              type="button"
              @click="testRandomNotification"
              :disabled="!sessionActive && hostedSupported">
              {{ t('achievementsTestNotificationBtn') }}
            </button>
          </div>
        </div>
      </div>

      <div class="notif-group-box" aria-labelledby="notif-colors-title">
        <div class="notif-group-head">
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
          <h3 id="notif-colors-title" class="notif-group-title">
            {{ t('colorCustomizationTitle') }}
          </h3>
        </div>
        <div class="notif-setting-item is-vertical">
          <div class="flex flex-wrap gap-2 colors-section">
            <ColorInput v-model="colors.bg" :label="t('colorBg')" />
            <ColorInput v-model="colors.font" :label="t('colorFont')" />
            <ColorInput v-model="colors.border" :label="t('colorBorder')" />
            <ColorInput v-model="colors.amount" :label="t('colorAmount')" />
            <ColorInput v-model="colors.from" :label="t('colorFrom')" />
          </div>
          <div class="notif-actions-row mt-3">
            <button
              class="btn"
              type="button"
              :disabled="savingColors || (!sessionActive && hostedSupported)"
              @click="saveColors">
              {{ savingColors ? t('commonSaving') : t('saveSettings') }}
            </button>
            <button
              class="btn-secondary btn-compact-secondary ml-2"
              type="button"
              @click="resetColors">
              {{ t('resetColors') }}
            </button>
          </div>
        </div>
      </div>

      <div class="notif-group-box" aria-labelledby="notif-preview-title">
        <div class="notif-group-head">
          <HeaderIcon>
            <svg
              class="os-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </HeaderIcon>
          <h3 id="notif-preview-title" class="notif-group-title">{{ t('commonPreview') }}</h3>
        </div>
        <div class="notif-setting-item is-vertical">
          <div class="tip-preview-wrapper">
            <div
              class="tip-preview-box"
              :style="previewVarsStyle"
              role="img"
              aria-label="Tip notification preview">
              <div class="tp-content">
                <div class="tp-title">🎉 Tip Received. Woohoo!</div>
                <div class="tp-amount">
                  <span class="tp-ar-amount">0.50 AR</span>
                  <span class="tp-usd">($2.50 USD)</span>
                </div>
                <div class="tp-from">📦 From: Spaceman… <span class="tp-thanks">👏</span></div>
                <div class="tp-msg">This is a fake notification. Thanks for the stream!</div>
              </div>
            </div>
          </div>
          <div class="preview-footer">
            <div class="small opacity-80">
              {{ t('colorCustomizationTitle') }} → {{ t('saveSettings') }} →
              {{ t('commonPreview') }}
            </div>
            <button
              class="btn-secondary btn-compact-secondary preview-refresh-btn"
              type="button"
              @click="refreshPreview">
              {{ t('refresh') }}
            </button>
          </div>
        </div>
      </div>

      <div class="notif-group-box" aria-labelledby="notif-obs-title">
        <div class="notif-group-head">
          <HeaderIcon>
            <svg
              class="os-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </HeaderIcon>
          <h3 id="notif-obs-title" class="notif-group-title">{{ t('obsIntegration') }}</h3>
        </div>
        <div class="notif-setting-item is-vertical">
          <div class="notif-setting-text">
            <div class="notif-setting-title">{{ t('notificationWidgetUrl') }}</div>
          </div>
          <div class="copy-field-row">
            <CopyField :value="widgetUrl" :aria-label="t('notificationWidgetUrl')" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../services/api';
import { pushToast } from '../services/toast';
import { registerDirty } from '../composables/useDirtyRegistry';
import { MAX_GIF_SIZE } from '../utils/validation';
import CopyField from './shared/CopyField.vue';
import { useWalletSession } from '../composables/useWalletSession';
import { usePublicToken } from '../composables/usePublicToken';
import LegacyAudioControls from './shared/LegacyAudioControls.vue';
import HeaderIcon from './shared/HeaderIcon.vue';
import ColorInput from './shared/ColorInput.vue';

const { t } = useI18n();

const gifInput = ref(null);

const gif = reactive({
  position: 'right',
  gifPath: '',
  file: null,
  fileName: '',
  original: '',
});

const posKeyMap = {
  left: 'positionLeft',
  right: 'positionRight',
  top: 'positionTop',
  bottom: 'positionBottom',
};

const tts = reactive({
  enabled: true,
  allChat: false,
  language: 'en',
  original: '',
});

const audio = reactive({
  audioSource: 'remote',
  file: null,
  fileName: '',
  original: '',
});

const audioCfg = reactive({ enabled: true, volume: 0.5 });

let lastSavedAudio = { enabled: true, volume: 0.5, audioSource: 'remote' };

const errors = reactive({
  gif: '',
  audio: '',
});

const savingGif = ref(false);
const savingTts = ref(false);
const savingAudio = ref(false);
const savingColors = ref(false);
const wallet = useWalletSession();
const { withToken, refresh } = usePublicToken();
const widgetUrl = computed(() => withToken(`${location.origin}/widgets/tip-notification`));
const hostedSupported = ref(false);
const sessionActive = ref(false);
const masked = computed(() => hostedSupported.value && !sessionActive.value);

const audioState = reactive({
  hasCustomAudio: false,
  audioFileName: '',
  audioFileSize: 0,
});

const posPulse = ref(false);

const colors = reactive({
  bg: '#080c10',
  font: '#ffffff',
  border: '#00ff7f',
  amount: '#00ff7f',
  from: '#ffffff',
});
let originalColors = '';

const previewColors = reactive({
  bg: '#080c10',
  font: '#ffffff',
  border: '#00ff7f',
  amount: '#00ff7f',
  from: '#ffffff',
});

const previewVarsStyle = computed(() => ({
  '--tn-bg': previewColors.bg,
  '--tn-text': previewColors.font,
  '--tn-border': previewColors.border,
  '--tn-amount': previewColors.amount,
  '--tn-from': previewColors.from,
}));

function isDirty() {
  return (
    JSON.stringify({ p: gif.position, g: !!gif.gifPath }) !== gif.original ||
    JSON.stringify({ e: tts.enabled, a: tts.allChat, l: tts.language }) !== tts.original ||
    JSON.stringify({ s: audio.audioSource, f: !!audio.fileName }) !== audio.original ||
    (originalColors && originalColors !== JSON.stringify(colors))
  );
}
registerDirty(isDirty);

function triggerGif() {
  gifInput.value.click();
}

function onGifChange(e) {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > MAX_GIF_SIZE) {
    errors.gif = t('valMax1MB');
    return;
  }
  errors.gif = '';
  gif.file = f;
  gif.fileName = f.name;
}

async function loadGif() {
  try {
    const { data } = await api.get('/api/tip-notification-gif');
    gif.position = data.position || 'right';
    gif.gifPath = data.gifPath || '';
    gif.original = JSON.stringify({ p: gif.position, g: !!gif.gifPath });
  } catch {}
}

async function loadColors() {
  try {
    const { data } = await api.get('/api/tip-notification');
    if (data && data.success) {
      colors.bg = data.bgColor || colors.bg;
      colors.font = data.fontColor || colors.font;
      colors.border = data.borderColor || colors.border;
      colors.amount = data.amountColor || colors.amount;
      colors.from = data.fromColor || colors.from;
      originalColors = JSON.stringify(colors);
      previewColors.bg = colors.bg;
      previewColors.font = colors.font;
      previewColors.border = colors.border;
      previewColors.amount = colors.amount;
      previewColors.from = colors.from;
    }
  } catch {}
}

function resetColors() {
  colors.bg = '#080c10';
  colors.font = '#ffffff';
  colors.border = '#00ff7f';
  colors.amount = '#00ff7f';
  colors.from = '#ffffff';
}

async function saveColors() {
  try {
    savingColors.value = true;
    if (hostedSupported.value && !sessionActive.value) {
      pushToast({ type: 'info', message: t('sessionRequiredToast') });
      return;
    }
    const payload = {
      bgColor: colors.bg,
      fontColor: colors.font,
      borderColor: colors.border,
      amountColor: colors.amount,
      fromColor: colors.from,
    };
    await api.post('/api/tip-notification', payload);
    originalColors = JSON.stringify(colors);
    previewColors.bg = colors.bg;
    previewColors.font = colors.font;
    previewColors.border = colors.border;
    previewColors.amount = colors.amount;
    previewColors.from = colors.from;
    pushToast({ type: 'success', message: t('savedNotifications') });
  } catch {
    pushToast({ type: 'error', message: t('saveFailedNotifications') });
  } finally {
    savingColors.value = false;
  }
}

async function refreshPreview() {
  try {
    const { data } = await api.get('/api/tip-notification');
    if (data && data.success) {
      previewColors.bg = data.bgColor || previewColors.bg;
      previewColors.font = data.fontColor || previewColors.font;
      previewColors.border = data.borderColor || previewColors.border;
      previewColors.amount = data.amountColor || previewColors.amount;
      previewColors.from = data.fromColor || previewColors.from;
    }
  } catch {}
}

async function saveGif() {
  if (errors.gif) return;
  try {
    savingGif.value = true;
    if (hostedSupported.value && !sessionActive.value) {
      pushToast({ type: 'info', message: t('sessionRequiredToast') });
      return;
    }
    const fd = new FormData();
    fd.append('position', gif.position);
    if (gif.file) fd.append('gifFile', gif.file);
    const { data } = await api.post('/api/tip-notification-gif', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    gif.gifPath = data.gifPath || '';
    gif.file = null;
    gif.fileName = '';
    gif.original = JSON.stringify({ p: gif.position, g: !!gif.gifPath });
    pushToast({ type: 'success', message: t('savedNotifications') });
  } catch {
    pushToast({ type: 'error', message: t('saveFailedNotifications') });
  } finally {
    savingGif.value = false;
  }
}

async function removeGif() {
  try {
    if (hostedSupported.value && !sessionActive.value) {
      pushToast({ type: 'info', message: t('sessionRequiredToast') });
      return;
    }
    await api.delete('/api/tip-notification-gif');
    gif.gifPath = '';
    gif.file = null;
    gif.fileName = '';
    gif.original = JSON.stringify({ p: gif.position, g: false });
    pushToast({ type: 'success', message: t('removedGif') });
  } catch {
    pushToast({ type: 'error', message: t('removeGifFailed') });
  }
}

async function loadTts() {
  try {
    const se = await api.get('/api/tts-setting');
    const la = await api.get('/api/tts-language');
    tts.enabled = !!se.data.ttsEnabled;
    tts.allChat = !!se.data.ttsAllChat;
    tts.language = la.data.ttsLanguage || 'en';
    tts.original = JSON.stringify({ e: tts.enabled, a: tts.allChat, l: tts.language });
  } catch {}
}

async function saveTts() {
  try {
    savingTts.value = true;
    if (hostedSupported.value && !sessionActive.value) {
      pushToast({ type: 'info', message: t('sessionRequiredToast') });
      return;
    }
    await api.post('/api/tts-setting', { ttsEnabled: tts.enabled, ttsAllChat: tts.allChat });
    await api.post('/api/tts-language', { ttsLanguage: tts.language });
    tts.original = JSON.stringify({ e: tts.enabled, a: tts.allChat, l: tts.language });
    pushToast({ type: 'success', message: t('savedNotifications') });
  } catch {
    pushToast({ type: 'error', message: t('saveFailedNotifications') });
  } finally {
    savingTts.value = false;
  }
}

async function loadAudio() {
  try {
    const { data } = await api.get('/api/audio-settings');
    audio.audioSource = data.audioSource || 'remote';
    audio.fileName = data.audioFileName || '';
    audio.original = JSON.stringify({ s: audio.audioSource, f: !!audio.fileName });
    audioState.hasCustomAudio = !!data.hasCustomAudio;
    audioState.audioFileName = data.audioFileName || '';
    audioState.audioFileSize = data.audioFileSize || 0;
    if (typeof data.enabled === 'boolean') audioCfg.enabled = data.enabled;
    if (typeof data.volume === 'number') audioCfg.volume = Math.max(0, Math.min(1, data.volume));
    lastSavedAudio = {
      enabled: audioCfg.enabled,
      volume: audioCfg.volume,
      audioSource: audio.audioSource,
    };
  } catch {}
}

function onAudioSaved() {
  loadAudio();
  pushToast({ type: 'success', message: t('savedNotifications') });
}
function onAudioDeleted() {
  loadAudio();
  pushToast({ type: 'success', message: t('deletedCustomAudio') });
}

async function persistAudioCfg(silent = false) {
  try {
    savingAudio.value = true;
    if (hostedSupported.value && !sessionActive.value) {
      if (!silent) pushToast({ type: 'info', message: t('sessionRequiredToast') });
      return;
    }
    const fd = new FormData();
    fd.append('audioSource', audio.audioSource);
    fd.append('enabled', String(audioCfg.enabled));
    fd.append('volume', String(audioCfg.volume));
    await api.post('/api/audio-settings', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    lastSavedAudio = {
      enabled: audioCfg.enabled,
      volume: audioCfg.volume,
      audioSource: audio.audioSource,
    };
    if (!silent) pushToast({ type: 'success', message: t('savedNotifications') });
  } catch {
    if (!silent) pushToast({ type: 'error', message: t('saveFailedNotifications') });
  } finally {
    savingAudio.value = false;
  }
}

async function testRandomNotification() {
  try {
    if (hostedSupported.value && !sessionActive.value) {
      pushToast({ type: 'info', message: t('sessionRequiredToast') });
      return;
    }
    const dirty =
      lastSavedAudio.enabled !== audioCfg.enabled ||
      Math.abs(lastSavedAudio.volume - audioCfg.volume) > 0.0001 ||
      lastSavedAudio.audioSource !== audio.audioSource;
    if (dirty) {
      await persistAudioCfg(true);
    }
    await api.post('/api/test-donation', { amount: (Math.random() * 2 + 0.1).toFixed(3) });
  } catch {}
}

onMounted(async () => {
  try {
    await wallet.refresh();
    await refresh();
  } catch {}

  hostedSupported.value = true;
  sessionActive.value = true;
  loadGif();
  loadTts();
  loadAudio();
  loadColors();
});

watch(
  () => gif.position,
  () => {
    posPulse.value = false;
    requestAnimationFrame(() => {
      posPulse.value = true;
      setTimeout(() => (posPulse.value = false), 700);
    });
  }
);
</script>

<style scoped src="./NotificationsPanel/NotificationsPanel.css"></style>
