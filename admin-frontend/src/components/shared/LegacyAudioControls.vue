<template>
  <div
    class="legacy-audio"
    :class="{ 'is-disabled': !enabled, compact, 'force-stack': forceStack }">
    <label v-if="showLabel" class="label block mb-2">{{ t('achievementsSoundLabel') }}</label>
    <div
      class="legacy-audio-grid"
      :class="{
        'is-remote-mode': audioSource === 'remote',
        'stack-mode': forceStack,
      }">
      <div class="legacy-audio-left">
        <div class="audio-header-line">
          <div class="toggle-sub">
            <button
              type="button"
              class="switch"
              :aria-pressed="String(enabled)"
              :aria-label="t('achievementsSoundToggleLabel')"
              @click="toggleEnabled">
              <span class="knob"></span>
            </button>
            <span class="toggle-label">{{ t('achievementsSoundToggleLabel') }}</span>
          </div>
          <span
            v-if="audioSource === 'remote'"
            class="remote-hint small opacity-70 remote-inline"
            >{{ t('audioSourceRemote') }}</span
          >
          <button
            type="button"
            class="btn-secondary test-audio-btn"
            :disabled="!enabled"
            @click="testPlayback"
            :title="t('achievementsTestNotificationBtn')"
            aria-label="Test sound">
            ▶
          </button>
        </div>
        <div
          class="volume-row"
          role="group"
          :aria-label="t('achievementsSoundVolumeLabel')"
          :aria-disabled="(!enabled).toString()">
          <button
            type="button"
            class="btn-secondary vol-btn"
            @click="stepVol(-0.05)"
            :disabled="volume <= 0 || !enabled">
            −
          </button>
          <span class="vol-badge" :class="{ 'opacity-50': !enabled }" aria-live="polite"
            >{{ volPercent }}%</span
          >
          <button
            type="button"
            class="btn-secondary vol-btn"
            @click="stepVol(0.05)"
            :disabled="volume >= 1 || !enabled">
            +
          </button>
        </div>
        <div class="source-row">
          <label class="label block mb-1" for="legacy-audio-source">{{
            t('audioSourceLabel')
          }}</label>
          <select
            id="legacy-audio-source"
            class="input select max-w-[220px]"
            :value="audioSource"
            @change="onChangeSource($event.target.value)"
            aria-label="Audio source">
            <option value="remote">{{ t('audioSourceRemote') }}</option>
            <option value="custom">{{ t('audioSourceCustom') }}</option>
          </select>
        </div>

        <div v-if="audioSource === 'custom' && forceStack" class="custom-stack-wrapper">
          <div class="custom-audio-box">
            <input
              ref="audioInput"
              type="file"
              accept="audio/*"
              class="hidden"
              @change="onAudioChange" />
            <div class="custom-audio-row">
              <div class="upload-col">
                <button class="btn-secondary w-full" type="button" @click="triggerAudio">
                  {{ t('customAudioUploadLabel') }}
                </button>
                <span class="file-info" v-if="audioFileName"
                  >{{ audioFileName }} ({{ formatSize(audioFileSize) }})</span
                >
              </div>
              <div class="actions-col">
                <button class="btn-save" type="button" :disabled="savingAudio" @click="saveAudio">
                  {{ savingAudio ? t('commonSaving') : t('achievementsSaveAudioBtn') }}
                </button>
                <div v-if="hasCustomAudio" class="remove-wrap">
                  <button
                    class="remove-audio-btn"
                    :class="{ armed: deleteArmed }"
                    type="button"
                    :aria-label="deleteArmed ? t('confirm') : t('remove')"
                    :title="deleteArmed ? t('confirm') : t('remove')"
                    @click="deleteCustomAudio"
                    :disabled="savingAudio">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true">
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
                    </svg>
                  </button>
                  <transition name="fade-fast">
                    <div
                      v-if="deleteArmed"
                      class="confirm-pop"
                      role="status"
                      :aria-label="t('confirm')"
                      @click="deleteCustomAudio">
                      {{ t('confirm') }}
                    </div>
                  </transition>
                </div>
              </div>
            </div>
            <div v-if="errorMsg" class="small text-red-700 mt-2">{{ errorMsg }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';

const props = defineProps({
  enabled: { type: Boolean, required: true },
  volume: { type: Number, required: true },
  audioSource: { type: String, required: true },
  hasCustomAudio: { type: Boolean, required: true },
  audioFileName: { type: String, default: '' },
  audioFileSize: { type: Number, default: 0 },
  showLabel: { type: Boolean, default: true },
  compact: { type: Boolean, default: false },
  forceStack: { type: Boolean, default: false },
  remoteUrl: { type: String, default: '' },
});
const emit = defineEmits([
  'update:enabled',
  'update:volume',
  'update:audioSource',
  'audio-saved',
  'audio-deleted',
  'toast',
]);

const { t } = useI18n();
const audioInput = ref(null);
const savingAudio = ref(false);
const fileRef = ref(null);
const errorMsg = ref('');
const deleteArmed = ref(false);
let deleteTimer = null;

const volPercent = computed(() =>
  Math.round(Math.max(0, Math.min(1, Number(props.volume) || 0)) * 100)
);

function perceptual(vol) {
  const v = Math.max(0, Math.min(1, vol || 0));
  return Math.pow(v, 2);
}

async function testPlayback() {
  try {
    if (!props.enabled) return;
    const linear = Math.max(0, Math.min(1, Number(props.volume) || 0));
    const eff = perceptual(linear);
    const useCustom = props.audioSource === 'custom' && props.hasCustomAudio;
    const fallbackRemote =
      'https://52agquhrbhkx3u72ikhun7oxngtan55uvxqbp4pzmhslirqys6wq.arweave.net/7oBoUPEJ1X3T-kKPRv3XaaYG97St4Bfx-WHktEYYl60';

    let url = props.remoteUrl || fallbackRemote;
    if (useCustom) {
      try {
        const response = await api.get('/api/custom-audio');
        url = response.data.url;
      } catch (error) {
        console.error('Error fetching custom audio URL:', error);
        return;
      }
    }

    const a = new Audio(url);
    a.volume = eff;
    a.play().catch(() => {});
  } catch {}
}

function toggleEnabled() {
  emit('update:enabled', !props.enabled);
}
function stepVol(delta) {
  if (!props.enabled) return;
  const v = Math.max(0, Math.min(1, (Number(props.volume) || 0) + delta));
  emit('update:volume', Math.round(v * 100) / 100);
}
function onChangeSource(val) {
  emit('update:audioSource', val);
}
function triggerAudio() {
  audioInput.value?.click();
}
function onAudioChange(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  if (f.size > 1024 * 1024) {
    errorMsg.value = t('valMax1MB');
    return;
  }
  errorMsg.value = '';
  fileRef.value = f;
}
function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
async function saveAudio() {
  try {
    savingAudio.value = true;
    const fd = new FormData();
    fd.append('audioSource', props.audioSource);
    fd.append('enabled', String(props.enabled));
    fd.append('volume', String(props.volume));
    if (props.audioSource === 'custom' && fileRef.value) {
      fd.append('audioFile', fileRef.value);
    }
    await api.post('/api/audio-settings', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    emit('audio-saved');
    emit('toast', { type: 'success', messageKey: 'toastAudioSaved' });
  } catch {
  } finally {
    savingAudio.value = false;
  }
}
async function deleteCustomAudio() {
  if (!deleteArmed.value) {
    deleteArmed.value = true;
    emit('toast', { type: 'info', messageKey: 'toastClickAgain' });
    if (deleteTimer) clearTimeout(deleteTimer);
    deleteTimer = setTimeout(() => (deleteArmed.value = false), 2000);
    return;
  }
  try {
    savingAudio.value = true;
    await api.delete('/api/audio-settings');
    emit('audio-deleted');
    emit('toast', { type: 'success', messageKey: 'toastAudioRemoved' });
  } catch {
  } finally {
    savingAudio.value = false;
    deleteArmed.value = false;
    if (deleteTimer) clearTimeout(deleteTimer);
  }
}
</script>

<style scoped>
.legacy-audio-grid {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) auto;
  gap: 1rem;
  align-items: start;
}
.legacy-audio-grid.is-remote-mode {
  grid-template-columns: 1fr;
}
.legacy-audio.force-stack .legacy-audio-grid {
  grid-template-columns: 1fr;
}
.legacy-audio.force-stack .legacy-audio-right {
  display: none;
}
.legacy-audio.force-stack .custom-stack-wrapper {
  margin-top: 4px;
}
.legacy-audio.force-stack .custom-audio-box {
  margin-top: 4px;
}
@media (max-width: 768px) {
  .legacy-audio-grid {
    grid-template-columns: 1fr;
  }
}
.vol-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  font-weight: 500;
  border: 1px solid rgba(0, 0, 0, 0.1);
  min-width: 42px;
}
@media (prefers-color-scheme: dark) {
  .vol-badge {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.1);
  }
}
.legacy-audio.is-disabled {
  opacity: 0.85;
}

.test-audio-btn {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.toggle-label {
  font-size: 12px;
  opacity: 0.8;
}
.volume-row {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
}
.vol-btn {
  min-width: 34px;
}
.source-row {
  margin-top: 12px;
  margin-bottom: 0;
}
.custom-audio-box {
  border: 1px solid var(--border, var(--border-color));
  background: var(--card);
  border-radius: 12px;
  padding: 12px 14px;
}
.custom-audio-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: stretch;
}
.upload-col {
  flex: 1 1 200px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.actions-col {
  flex: 0 0 auto;
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: stretch;
  align-self: flex-start;
}
.actions-col .btn-save {
  width: auto;
  min-width: 120px;
}
.file-info {
  font-size: 12px;
  opacity: 0.75;
  word-break: break-all;
}
.remote-hint {
  padding: 0 4px;
}
.audio-header-line {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.audio-header-line .toggle-sub {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.remote-inline {
  margin-left: auto;
  align-self: center;
}
.switch {
  width: 38px;
  height: 22px;
  background: var(--bg-chat, #f3f3f3);
  border: 1px solid var(--border, var(--border-color, #d0d0d0));
  border-radius: 9999px;
  position: relative;
  transition: background 0.2s ease, border-color 0.2s ease;
  display: inline-flex;
  align-items: center;
}
.switch .knob {
  position: absolute;
  left: 2px;
  top: 1px;
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 9999px;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.switch[aria-pressed='true'] {
  background: var(--accent, #553fee);
  border-color: var(--accent, #553fee);
}
.switch[aria-pressed='true'] .knob {
  transform: translateX(16px);
}
.switch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #553fee) 35%, transparent);
}

:host(.compact) .legacy-audio-grid,
.legacy-audio.compact .legacy-audio-grid {
  gap: 0.75rem;
}
.legacy-audio.compact .btn-secondary {
  padding: 8px 12px;
  line-height: 1;
}
.legacy-audio.compact .vol-badge {
  padding: 5px 6px;
  font-size: 12px;
}
.legacy-audio.compact .custom-audio-box {
  padding: 10px 12px;
}
.legacy-audio.compact .vol-btn {
  min-width: 30px;
}
.legacy-audio.force-stack.compact .custom-audio-row {
  gap: 12px;
}
.legacy-audio.compact .actions-col {
  gap: 6px;
  flex-direction: row;
}
.legacy-audio.compact .actions-col .btn-save,
.legacy-audio.compact .actions-col .btn,
.legacy-audio.compact .actions-col .btn-danger {
  padding: 4px 10px;
  line-height: 1.1;
  font-size: 12px;
  min-height: 30px;
  border-radius: 6px;
  width: auto;
  min-width: 90px;
}
.remove-audio-btn {
  background: var(--danger, var(--btn-danger));
  color: #fff;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  width: 34px;
  min-width: 34px;
  padding: 0;
  position: relative;
  transition: background 0.15s ease, opacity 0.15s ease;
}
.remove-audio-btn svg {
  width: 16px;
  height: 16px;
  pointer-events: none;
}
.remove-audio-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.remove-audio-btn:not(:disabled):hover {
  background: color-mix(in srgb, var(--danger, var(--btn-danger)) 85%, #000);
}
.remove-audio-btn.armed {
  background: #f59e0b;
}
.remove-audio-btn.armed:not(:disabled):hover {
  background: color-mix(in srgb, #f59e0b 85%, #000);
}
.remove-audio-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger, var(--btn-danger)) 45%, transparent);
}
.legacy-audio.compact .remove-audio-btn {
  min-height: 30px;
  height: 30px;
}

.remove-wrap {
  position: relative;
  display: inline-flex;
}
.confirm-pop {
  position: absolute;
  top: -6px;
  right: 100%;
  transform: translate(8px, -100%);
  background: #f59e0b;
  color: #111;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  white-space: nowrap;
  z-index: 20;
}
html.dark .confirm-pop {
  color: #111;
}
.fade-fast-enter-active,
.fade-fast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.fade-fast-enter-from,
.fade-fast-leave-to {
  opacity: 0;
  transform: translate(8px, -100%) scale(0.95);
}

.legacy-audio.compact .upload-col .btn-secondary {
  padding: 4px 10px;
  line-height: 1.1;
  min-height: 30px;
  font-size: 12px;
  border-radius: 6px;
}
</style>
