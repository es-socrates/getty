<template>
  <section class="admin-tab active relative" role="form">
    <div
      v-if="masked"
      class="absolute inset-0 z-10 flex items-center justify-center backdrop-blur bg-black/35">
      <div
        class="p-5 rounded-os bg-[var(--bg-card)] border border-[var(--card-border)] shadow-lg max-w-md text-center">
        <div class="mb-2 text-lg font-semibold">{{ t('raffleSessionRequiredTitle') }}</div>
        <p class="mb-4 text-sm">{{ t('raffleSessionRequiredBody') }}</p>
        <a href="/new-session" class="btn">{{ t('createSession') }}</a>
      </div>
    </div>
    <div v-if="warning" class="os-subtle mt-3 p-4 rounded-os" role="status" aria-live="polite">
      <div class="flex items-center gap-2">
        <svg width="24" height="24" fill="none" class="shrink-0">
          <circle cx="12" cy="12" r="12" fill="#ffe066" />
          <path d="M12 8v4m0 4h.01" stroke="#b58900" stroke-width="2" stroke-linecap="round" />
        </svg>
        <div>
          <strong class="mr-1">{{ t('raffleWarningTitle') }}</strong>
          <span>{{ t('raffleWarningChat') }}</span>
        </div>
      </div>
    </div>
    <OsCard
      class="mt-3"
      aria-describedby="raffle-settings-desc"
      :title="t('raffleSettings') || 'Raffle settings'">
      <p id="raffle-settings-desc" class="sr-only">
        Configure raffle command, prize, image, max winners and actions.
      </p>
      <div class="form-group">
        <label class="label" for="raffle-command">{{ t('raffleCommandLabel') }}</label>
        <input
          class="input"
          id="raffle-command"
          v-model="form.command"
          type="text"
          :placeholder="t('raffleCommandPlaceholder')"
          aria-describedby="raffle-command-hint" />
        <small id="raffle-command-hint" class="small">{{ t('raffleCommandHint') }}</small>
      </div>
      <div class="form-group">
        <label class="label" for="raffle-prize">{{ t('rafflePrizeLabel') }}</label>
        <input
          class="input"
          id="raffle-prize"
          v-model="form.prize"
          type="text"
          maxlength="15"
          :placeholder="t('rafflePrizePlaceholder')" />
        <div class="flex gap-2 small mt-1 justify-between">
          <small :class="{ 'text-red-500': form.prize.length >= 15 }">
            {{ form.prize.length >= 15 ? t('valMaxChars') : '\u00A0' }}
          </small>
          <small aria-live="polite" aria-atomic="true">{{
            t('charsUsed', { used: form.prize.length, max: 15 })
          }}</small>
        </div>
      </div>
      <div class="form-group">
        <label class="label" for="raffle-image">{{ t('rafflePrizeImageLabel') }}</label>
        <div class="flex items-center gap-2">
          <input
            ref="imageInput"
            id="raffle-image"
            type="file"
            accept="image/png,image/jpeg,image/gif"
            class="sr-only"
            @change="onImageFileChange" />
          <button type="button" class="upload-btn" @click="openImageDialog">
            <i class="pi pi-upload mr-2" aria-hidden="true"></i>
            {{ t('imageChoose') || t('rafflePrizeImageLabel') }}
          </button>
          <span
            v-if="selectedPrizeFilename"
            class="file-name-label"
            :title="selectedPrizeFilename"
            >{{ selectedPrizeFilename }}</span
          >
          <button
            v-if="displayImageUrl"
            type="button"
            class="icon-btn"
            :aria-label="t('remove')"
            :title="t('remove')"
            @click="clearPrizeImage">
            <i class="pi pi-trash"></i>
          </button>
        </div>
        <div v-if="displayImageUrl" class="mt-2">
          <img :src="displayImageUrl" alt="raffle" class="max-h-20 object-contain rounded" />
        </div>
      </div>
      <div class="flex flex-wrap gap-2 form-group mt-4" role="group" aria-label="Raffle actions">
        <button
          class="btn"
          @click="start"
          :disabled="(state.active && !state.paused) || savingAction"
          :aria-busy="savingAction && action === 'start' ? 'true' : 'false'">
          {{ savingAction && action === 'start' ? t('commonSaving') : t('raffleStart') }}
        </button>
        <button
          class="btn"
          @click="pause"
          :disabled="!state.active || state.paused || savingAction"
          :aria-busy="savingAction && action === 'pause' ? 'true' : 'false'">
          {{ savingAction && action === 'pause' ? t('commonSaving') : t('rafflePause') }}
        </button>
        <button
          class="btn"
          @click="resume"
          :disabled="!state.active || !state.paused || savingAction"
          :aria-busy="savingAction && action === 'resume' ? 'true' : 'false'">
          {{ savingAction && action === 'resume' ? t('commonSaving') : t('raffleResume') }}
        </button>
        <button
          class="btn"
          @click="stop"
          :disabled="!state.active || savingAction"
          :aria-busy="savingAction && action === 'stop' ? 'true' : 'false'">
          {{ savingAction && action === 'stop' ? t('commonSaving') : t('raffleStop') }}
        </button>
        <button
          class="btn"
          @click="draw"
          :disabled="!participants.length || savingAction"
          :aria-busy="savingAction && action === 'draw' ? 'true' : 'false'">
          {{ savingAction && action === 'draw' ? t('commonSaving') : t('raffleDrawWinner') }}
        </button>
        <button
          class="btn danger"
          @click="reset"
          :disabled="savingAction"
          :aria-busy="savingAction && action === 'reset' ? 'true' : 'false'">
          {{ savingAction && action === 'reset' ? t('commonSaving') : t('raffleResetWinners') }}
        </button>
      </div>
      <div class="form-group">
        <label class="label" for="raffle-max-winners">{{ t('raffleMaxWinnersLabel') }}</label>
        <input
          class="input"
          id="raffle-max-winners"
          v-model.number="form.maxWinners"
          type="number"
          min="1" />
        <label
          class="flex items-center gap-1.5 mt-2"
          @mouseenter="hoverEnabled = true"
          @mouseleave="hoverEnabled = false">
          <input type="checkbox" class="checkbox" v-model="form.enabled" /> {{ t('raffleEnabled') }}
        </label>
        <button class="btn mt-3" @click="saveSettings" :disabled="savingSettings">
          {{ savingSettings ? t('commonSaving') : t('saveSettings') }}
        </button>
      </div>
    </OsCard>
    <OsCard class="mt-3" :title="t('obsIntegration')">
      <div class="form-group">
        <div class="flex flex-wrap items-center gap-3">
          <span class="label mb-0">{{ t('raffleAdminSectionWidgetLink') }}</span>
          <CopyField :value="widgetUrl" :aria-label="t('raffleAdminSectionWidgetLink')" />
        </div>
      </div>
    </OsCard>
  </section>
</template>
<script setup>
import { computed, ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import { pushToast } from '../services/toast';
import CopyField from './shared/CopyField.vue';
import { MAX_RAFFLE_IMAGE } from '../utils/validation';
import OsCard from './os/OsCard.vue';
import { usePublicToken } from '../composables/usePublicToken';

const { t } = useI18n();
const masked = ref(false);

const form = reactive({
  command: '!giveaway',
  prize: '',
  imageUrl: '',
  maxWinners: 1,
  enabled: true,
});

const state = reactive({
  active: false,
  paused: false,
});

const participants = ref([]);
const winner = ref(null);

const hoverEnabled = ref(false);
const warning = ref({
  title: 'Reminder',
  body: 'The chat command must match the configured command.',
});

let ws;

const savingSettings = ref(false);
const savingAction = ref(false);
const action = ref('');
const fileUploadKey = ref(0);
const selectedPrizeFilename = ref('');
const imageInput = ref(null);
const displayImageUrl = ref('');
const locallyClearedImage = ref(false);

const pt = usePublicToken();
const widgetUrl = computed(() => pt.withToken(`${location.origin}/widgets/giveaway`));

function connectWs() {
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  ws = new WebSocket(url);
  ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'raffle_state') {
        applyState(msg);
      } else if (msg.type === 'raffle_winner') {
        winner.value = msg;
      }
    } catch {}
  });
}

function applyState(s) {
  state.active = !!s.active;
  state.paused = !!s.paused;
  form.command = s.command;
  form.prize = s.prize;
  form.imageUrl = s.imageUrl;
  form.maxWinners = s.maxWinners;
  form.enabled = s.enabled;
  participants.value = Array.isArray(s.participants) ? s.participants : [];
  if (!locallyClearedImage.value) {
    displayImageUrl.value = form.imageUrl || '';
  }
}

async function load() {
  const [modulesRes, settingsRes, stateRes] = await Promise.all([
    axios.get('/api/modules').catch(() => ({ data: {} })),
    axios.get('/api/raffle/settings').catch(() => ({ data: {} })),
    axios.get('/api/raffle/state').catch(() => ({ data: {} })),
  ]);
  masked.value = !!modulesRes?.data?.masked;
  Object.assign(form, settingsRes.data);
  applyState(stateRes.data);
  if (!locallyClearedImage.value) {
    displayImageUrl.value = form.imageUrl || '';
  }
}

async function saveSettings() {
  try {
    if (masked.value) {
      pushToast({ type: 'info', message: t('raffleSessionRequiredToast') });
      return;
    }
    savingSettings.value = true;
    await axios.post('/api/raffle/settings', form);
    await load();
    pushToast({ type: 'success', message: t('savedRaffleSettings') });
  } catch {
    pushToast({ type: 'error', message: t('saveFailedRaffleSettings') });
  } finally {
    savingSettings.value = false;
  }
}

async function clearPrizeImage() {
  form.imageUrl = '';
  displayImageUrl.value = '';
  selectedPrizeFilename.value = '';
  locallyClearedImage.value = true;
  if (imageInput.value) imageInput.value.value = '';
  fileUploadKey.value++;
  try {
    const r = await fetch('/api/raffle/clear-image', { method: 'POST' });
    const data = await r.json().catch(() => ({}));
    if (data && data.success) {
      pushToast({ type: 'success', message: t('raffleImageUploaded') });
      locallyClearedImage.value = false;
      await load();
    } else {
      pushToast({ type: 'error', message: t('raffleImageUploadFailed') });
    }
  } catch {
    pushToast({ type: 'error', message: t('raffleImageUploadFailed') });
  }
}

async function start() {
  action.value = 'start';
  await doAction('/api/raffle/start', 'raffleStarted');
}
async function stop() {
  action.value = 'stop';
  await doAction('/api/raffle/stop', 'raffleStopped');
}
async function pause() {
  action.value = 'pause';
  await doAction('/api/raffle/pause', 'rafflePaused');
}
async function resume() {
  action.value = 'resume';
  await doAction('/api/raffle/resume', 'raffleResumed');
}
async function draw() {
  action.value = 'draw';
  try {
    savingAction.value = true;
    const r = await axios.post('/api/raffle/draw');
    winner.value = r.data.winner || r.data;
    pushToast({ type: 'success', message: t('raffleWinnerDrawn') });
    await load();
  } catch {
    pushToast({ type: 'error', message: t('raffleActionFailed') });
  } finally {
    savingAction.value = false;
  }
}
async function reset() {
  action.value = 'reset';
  await doAction('/api/raffle/reset', 'raffleReset', () => {
    winner.value = null;
  });
}

async function doAction(endpoint, successKey, after) {
  try {
    if (masked.value) {
      pushToast({ type: 'info', message: t('raffleSessionRequiredToast') });
      return;
    }
    savingAction.value = true;
    await axios.post(endpoint);
    await load();
    if (after) after();
    pushToast({ type: 'success', message: t(successKey) });
  } catch {
    pushToast({ type: 'error', message: t('raffleActionFailed') });
  } finally {
    savingAction.value = false;
  }
}

async function onImageFileChange(e) {
  const file = e?.target?.files?.[0];
  if (!file) return;
  selectedPrizeFilename.value = file.name || '';
  if (file.size > MAX_RAFFLE_IMAGE) {
    return pushToast({ type: 'error', message: t('raffleImageTooLarge') });
  }
  const fd = new FormData();
  fd.append('image', file);
  try {
    const res = await fetch('/api/raffle/upload-image', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.imageUrl) {
      form.imageUrl = data.imageUrl;
      displayImageUrl.value = data.imageUrl;
      locallyClearedImage.value = false;

      if (form.prize && form.prize.trim().length > 0) {
        await saveSettings();
      }
      pushToast({ type: 'success', message: t('raffleImageUploaded') });
      fileUploadKey.value++;

      if (imageInput.value) imageInput.value.value = '';
    } else {
      pushToast({ type: 'error', message: t('raffleImageUploadFailed') });
    }
  } catch {
    pushToast({ type: 'error', message: t('raffleImageUploadFailed') });
  }
}

function openImageDialog() {
  if (imageInput.value) {
    imageInput.value.value = '';
    imageInput.value.click();
  }
}

onMounted(async () => {
  await pt.refresh();
  load();
  connectWs();
});
</script>

<style scoped>
.upload-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.6rem;
  border: 2px solid var(--accent);
  color: var(--accent);
  background: transparent;
  border-radius: 4px;
  line-height: 1;
  box-shadow: none;
  cursor: pointer;
}
.upload-btn:hover {
  background: rgba(79, 54, 255, 0.08);
}
.upload-btn:focus-visible {
  outline: 2px solid rgba(79, 54, 255, 0.35);
  outline-offset: 1px;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: #ff0149;
  background: transparent;
  border-radius: 2px;
}
.icon-btn:hover {
  background: rgba(100, 116, 139, 0.08);
}
.icon-btn .pi {
  font-size: 0.9rem;
}

.file-name-label {
  font-size: 0.85rem;
  color: #64748b;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
