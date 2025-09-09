<template>
  <section class="admin-tab active" role="form">
    <OsCard class="mb-4" aria-describedby="gif-section-desc">
      <p id="gif-section-desc" class="sr-only">{{ t('gifSectionDesc') }}</p>
      <h3 class="os-card-title">{{ t('gifSectionTitle') }}</h3>
      <div class="form-group">
        <label class="label">{{ t('notificationGifPositionLabel') }}</label>
        <select class="input" v-model="gif.position">
          <option value="right">{{ t('positionRight') }}</option>
          <option value="left">{{ t('positionLeft') }}</option>
          <option value="top">{{ t('positionTop') }}</option>
          <option value="bottom">{{ t('positionBottom') }}</option>
        </select>
      </div>
      <div
        class="form-group mt-4 flex flex-col gap-3 md:flex-row md:items-end md:gap-4"
        aria-label="GIF controls">
        <div class="flex items-center gap-2">
          <input
            ref="gifInput"
            type="file"
            accept="image/gif"
            class="hidden"
            @change="onGifChange"
            aria-hidden="true" />
          <button
            class="btn-secondary"
            type="button"
            @click="triggerGif"
            :aria-busy="savingGif ? 'true' : 'false'">
            {{ t('notificationGifChooseBtn') }}
          </button>
          <button
            v-if="gif.gifPath"
            class="btn-danger"
            type="button"
            @click="removeGif"
            :aria-label="t('notificationGifRemoveBtn')">
            {{ t('notificationGifRemoveBtn') }}
          </button>
          <span v-if="gif.fileName" class="small">{{ gif.fileName }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="btn-save"
            :disabled="savingGif"
            type="button"
            @click="saveGif"
            :aria-busy="savingGif ? 'true' : 'false'">
            {{ savingGif ? t('commonSaving') : t('saveSettings') }}
          </button>
        </div>
      </div>
      <div v-if="errors.gif" class="small mt-2 text-red-700">{{ errors.gif }}</div>
      <div v-if="gif.gifPath" class="mt-3">
        <img :src="gif.gifPath" :alt="gif.fileName" class="max-h-[120px] rounded-md" />
      </div>
    </OsCard>
    <OsCard class="mb-4" aria-describedby="tts-section-desc">
      <p id="tts-section-desc" class="sr-only">{{ t('ttsSectionDesc') }}</p>
      <h3 class="os-card-title">{{ t('ttsSectionTitle') }}</h3>
      <div class="form-group">
        <label class="label"
          ><input type="checkbox" class="checkbox" v-model="tts.enabled" />
          {{ t('enableTextToSpeech') }}</label
        >
      </div>
      <div class="form-group">
        <label class="label"
          ><input type="checkbox" class="checkbox" v-model="tts.allChat" />
          {{ t('enableTtsAllChat') }}</label
        >
      </div>
      <div class="form-group">
        <label class="label">{{ t('ttsLanguage') }}</label>
        <select class="input" v-model="tts.language">
          <option value="en">{{ t('english') }}</option>
          <option value="es">{{ t('spanish') }}</option>
        </select>
      </div>
      <div class="mt-2">
        <button
          class="btn"
          :disabled="savingTts"
          type="button"
          @click="saveTts"
          :aria-busy="savingTts ? 'true' : 'false'">
          {{ savingTts ? t('commonSaving') : t('saveSettings') }}
        </button>
      </div>
    </OsCard>
    <OsCard class="mb-4" aria-describedby="audio-section-desc">
      <p id="audio-section-desc" class="sr-only">{{ t('audioSectionDesc') }}</p>
      <h3 class="os-card-title">{{ t('customAudioTitle') }}</h3>
      <div class="form-group">
        <label class="label" for="audio-source">{{ t('audioSourceLabel') }}</label>
        <select id="audio-source" v-model="audio.audioSource" class="input">
          <option value="remote">{{ t('audioSourceRemote') }}</option>
          <option value="custom">{{ t('audioSourceCustom') }}</option>
        </select>
      </div>
      <div v-if="audio.audioSource === 'custom'" class="form-group mt-2">
        <label class="label" for="custom-audio-upload">{{ t('customAudioUploadLabel') }}</label>
        <input
          id="custom-audio-upload"
          ref="audioInput"
          type="file"
          accept="audio/*"
          class="hidden"
          @change="onAudioChange" />
        <button class="btn" type="button" @click="triggerAudio">
          {{ t('customAudioUploadLabel') }}
        </button>
        <div v-if="audioState.hasCustomAudio" class="mt-2">
          <div class="flex gap-2 items-center">
            <span
              >{{ t('customAudioFileName') }}: <b>{{ audioState.audioFileName }}</b></span
            >
            <span
              >{{ t('customAudioFileSize') }}:
              <b>{{ formatSize(audioState.audioFileSize) }}</b></span
            >
            <button class="btn btn-danger" @click="deleteCustomAudio" :disabled="savingAudio">
              {{ t('deleteCustomAudio') }}
            </button>
          </div>
        </div>
      </div>
      <div v-if="errors.audio" class="small text-red-700">{{ errors.audio }}</div>
      <button
        class="btn mt-3"
        :disabled="savingAudio"
        type="button"
        @click="saveAudio"
        :aria-busy="savingAudio ? 'true' : 'false'">
        {{ savingAudio ? t('commonSaving') : t('saveSettings') }}
      </button>
    </OsCard>
    <OsCard class="mt-4" :title="t('obsIntegration')">
      <div class="form-group">
        <div class="flex flex-wrap items-center gap-3">
          <span class="label mb-0">{{ t('notificationWidgetUrl') }}</span>
          <CopyField :value="widgetUrl" :aria-label="t('notificationWidgetUrl')" />
        </div>
      </div>
    </OsCard>
  </section>
</template>
<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../services/api';
import { pushToast } from '../services/toast';
import { registerDirty } from '../composables/useDirtyRegistry';
import { MAX_GIF_SIZE, MAX_AUDIO_SIZE } from '../utils/validation';
import CopyField from './shared/CopyField.vue';
import { usePublicToken } from '../composables/usePublicToken';
import OsCard from './os/OsCard.vue';

const { t } = useI18n();

const gifInput = ref(null);
const audioInput = ref(null);

const gif = reactive({
  position: 'right',
  gifPath: '',
  file: null,
  fileName: '',
  original: '',
});

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

const errors = reactive({
  gif: '',
  audio: '',
});

const savingGif = ref(false);
const savingTts = ref(false);
const savingAudio = ref(false);
const pt = usePublicToken();
const widgetUrl = computed(() => pt.withToken(`${location.origin}/widgets/tip-notification`));

const audioState = reactive({
  hasCustomAudio: false,
  audioFileName: '',
  audioFileSize: 0,
});

function isDirty() {
  return (
    JSON.stringify({ p: gif.position, g: !!gif.gifPath }) !== gif.original ||
    JSON.stringify({ e: tts.enabled, a: tts.allChat, l: tts.language }) !== tts.original ||
    JSON.stringify({ s: audio.audioSource, f: !!audio.fileName }) !== audio.original
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

async function saveGif() {
  if (errors.gif) return;
  try {
    savingGif.value = true;
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

function triggerAudio() {
  audioInput.value.click();
}

function onAudioChange(e) {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > MAX_AUDIO_SIZE) {
    errors.audio = t('valMax1MB');
    return;
  }
  errors.audio = '';
  audio.file = f;
  audio.fileName = f.name;
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
  } catch {}
}

async function saveAudio() {
  if (errors.audio) return;
  try {
    savingAudio.value = true;
    const fd = new FormData();
    fd.append('audioSource', audio.audioSource);
    if (audio.audioSource === 'custom' && audio.file) {
      fd.append('audioFile', audio.file);
    }
    await api.post('/api/audio-settings', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    audio.file = null;
    audio.original = JSON.stringify({ s: audio.audioSource, f: !!audio.fileName });
    pushToast({ type: 'success', message: t('savedNotifications') });
  } catch {
    pushToast({ type: 'error', message: t('saveFailedNotifications') });
  } finally {
    savingAudio.value = false;
  }
}

async function deleteCustomAudio() {
  if (!audioState.hasCustomAudio) return;
  try {
    savingAudio.value = true;
    await api.delete('/api/audio-settings');
    pushToast({ type: 'success', message: t('deletedCustomAudio') });
    await loadAudio();
    audio.file = null;
  } catch {
    pushToast({ type: 'error', message: t('deleteFailedCustomAudio') });
  } finally {
    savingAudio.value = false;
  }
}

onMounted(async () => {
  await pt.refresh();
  loadGif();
  loadTts();
  loadAudio();
});
</script>
