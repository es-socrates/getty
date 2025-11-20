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
            <div v-if="storageProviderOptions.length" class="storage-provider-field mb-3">
              <label class="label mb-1 flex items-center gap-2" for="legacy-audio-storage-provider">
                <span>{{ t('storageProviderLabel') }}</span>
                <i
                  v-if="hasTurboOption"
                  class="pi pi-info-circle text-[13px] text-emerald-400 cursor-help"
                  :title="t('storageProviderArweaveTooltip')"
                  :aria-label="t('storageProviderArweaveTooltip')"
                  role="note"
                  tabindex="0"></i>
              </label>
              <select
                id="legacy-audio-storage-provider"
                class="input select w-full"
                v-model="providerSelection"
                :disabled="storageLoading">
                <option
                  v-for="opt in storageProviderOptions"
                  :key="opt.id"
                  :value="opt.id"
                  :disabled="!opt.available && opt.id !== providerSelection">
                  {{ opt.label }}
                </option>
              </select>
              <div
                v-if="providerStatus && !providerStatus.available"
                class="small text-amber-500 mt-1">
                {{ t('storageProviderUnavailable') }}
              </div>
            </div>
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
              </div>
              <div v-if="libraryEnabled" class="library-col">
                <button
                  class="btn-secondary w-full"
                  type="button"
                  :disabled="savingAudio || libraryLoading"
                  @click="openLibrary">
                  {{ libraryLoading ? t('commonLoading') : t('audioLibraryChoose') }}
                </button>
                <button
                  v-if="pendingLibraryItem"
                  type="button"
                  class="btn-secondary"
                  @click="clearLibrarySelection">
                  {{ t('audioLibraryClearSelection') }}
                </button>
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
            <div
              v-if="selectionSummary && selectionSummary.name"
              class="small mt-4 text-green-700 flex items-center gap-2"
              aria-live="polite">
              <svg width="16" height="16" fill="none" class="shrink-0">
                <circle cx="8" cy="8" r="8" fill="#22c55e" />
                <path
                  d="M6.5 8.5l1.5 1.5L10.5 7"
                  stroke="#ffffff"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
              <span>
                <span class="file-label">{{ selectionSummary.label }}: </span>
                <span class="file-name">{{ selectionSummary.name }}</span>
                <span v-if="selectionSummary.size" class="file-size"
                  >({{ selectionSummary.size }})</span
                >
              </span>
            </div>
            <div v-if="errorMsg" class="small text-red-700 mt-2 flex items-center gap-2">
              <svg width="16" height="16" fill="none" class="shrink-0">
                <circle cx="8" cy="8" r="8" fill="#ef4444" />
                <path
                  d="M8 4v4m0 4h.01"
                  stroke="#ffffff"
                  stroke-width="1.5"
                  stroke-linecap="round" />
              </svg>
              {{ errorMsg }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <AudioLibraryDrawer
      v-if="libraryEnabled"
      :open="libraryDrawerOpen"
      :items="libraryItems"
      :loading="libraryLoading"
      :error="libraryError"
      @close="closeLibrary"
      @refresh="fetchLibrary(true)"
      @select="onLibrarySelect"
      @delete="onLibraryDelete" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';
import { confirmDialog } from '../../services/confirm';
import AudioLibraryDrawer from './AudioLibraryDrawer.vue';

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
  saveEndpoint: { type: String, default: '/api/audio-settings' },
  deleteEndpoint: { type: String, default: '/api/audio-settings' },
  customAudioEndpoint: { type: String, default: '/api/custom-audio' },
  audioLibraryId: { type: String, default: '' },
  libraryEnabled: { type: Boolean, default: false },
  storageProvider: { type: String, default: '' },
  storageProviders: { type: Array, default: () => [] },
  storageLoading: { type: Boolean, default: false },
});
const emit = defineEmits([
  'update:enabled',
  'update:volume',
  'update:audioSource',
  'audio-saved',
  'audio-deleted',
  'toast',
  'update:storageProvider',
]);

const { t } = useI18n();
const audioInput = ref(null);
const savingAudio = ref(false);
const fileRef = ref(null);
const errorMsg = ref('');
const deleteArmed = ref(false);
const libraryDrawerOpen = ref(false);
const libraryLoading = ref(false);
const libraryError = ref('');
const libraryItems = ref([]);
const pendingLibraryItem = ref(null);
const selectedLibraryId = ref('');
let deleteTimer = null;

const volPercent = computed(() =>
  Math.round(Math.max(0, Math.min(1, Number(props.volume) || 0)) * 100)
);

const storageProviderOptions = computed(() =>
  Array.isArray(props.storageProviders) ? props.storageProviders : []
);
const providerSelection = computed({
  get: () => props.storageProvider || '',
  set: (val) => emit('update:storageProvider', val),
});
const providerStatus = computed(
  () => storageProviderOptions.value.find((entry) => entry.id === providerSelection.value) || null
);
const hasTurboOption = computed(() =>
  storageProviderOptions.value.some((opt) => opt.id === 'turbo')
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
        const response = await api.get(props.customAudioEndpoint);
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
async function onAudioChange(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  if (f.size > 1024 * 1024) {
    errorMsg.value = t('valMax1MB');
    fileRef.value = null;
    pendingLibraryItem.value = null;
    selectedLibraryId.value = '';
    return;
  }
  errorMsg.value = '';
  fileRef.value = f;
  pendingLibraryItem.value = null;
  selectedLibraryId.value = '';
  if (props.libraryEnabled) {
    await maybeHandleDuplicate(f);
  }
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
    const selectedProvider = providerSelection.value;
    if (selectedProvider) {
      fd.append('storageProvider', selectedProvider);
    }
    if (props.audioSource === 'custom' && fileRef.value) {
      fd.append('audioFile', fileRef.value);
    } else if (
      props.libraryEnabled &&
      props.audioSource === 'custom' &&
      selectedLibraryId.value &&
      !fileRef.value
    ) {
      fd.append('selectedAudioId', selectedLibraryId.value);
    }
    const response = await api.post(props.saveEndpoint, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const nextLibrary = response?.data?.libraryItem || null;
    if (nextLibrary && nextLibrary.id) {
      selectedLibraryId.value = nextLibrary.id;
      pendingLibraryItem.value = null;
      libraryItems.value = [
        nextLibrary,
        ...libraryItems.value.filter((entry) => entry && entry.id !== nextLibrary.id),
      ].slice(0, 50);
    }
    fileRef.value = null;
    if (audioInput.value) {
      audioInput.value.value = '';
    }
    emit('audio-saved');
    emit('toast', { type: 'success', messageKey: 'toastAudioSaved' });
  } catch {
  } finally {
    savingAudio.value = false;
  }
}

async function ensureLibraryLoadedIfNeeded() {
  if (!props.libraryEnabled) return;
  if (libraryItems.value.length) return;
  await fetchLibrary(true);
}

function buildFingerprintForFile(file) {
  const name = (file?.name || '').toLowerCase();
  const size = Number(file?.size) || 0;
  return `${name}::${size}`;
}

async function computeFileHash(file) {
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const buffer = await file.arrayBuffer();
      const digest = await window.crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(digest));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (error) {
    console.warn('[audio] failed to hash file', error);
  }
  return '';
}

function matchesDuplicateCandidate(item, file, hash, fallbackKey) {
  if (!item) return false;
  if (hash && typeof item.sha256 === 'string' && item.sha256 === hash) {
    return true;
  }
  if (
    fallbackKey &&
    typeof item.fingerprint === 'string' &&
    item.fingerprint &&
    item.fingerprint === fallbackKey
  ) {
    return true;
  }
  const itemSize = Number(item.size) || 0;
  if (itemSize && file.size && itemSize !== file.size) return false;
  const itemName = (item.originalName || item.id || '').trim().toLowerCase();
  const fileName = (file.name || '').trim().toLowerCase();
  if (itemName && fileName && itemName === fileName) {
    if (!itemSize || !file.size || itemSize === file.size) {
      return true;
    }
  }
  return false;
}

async function maybeHandleDuplicate(file) {
  try {
    await ensureLibraryLoadedIfNeeded();
    if (!libraryItems.value.length) return;
    const fallbackKey = buildFingerprintForFile(file);
    const hash = await computeFileHash(file);
    const duplicate = libraryItems.value.find((item) =>
      matchesDuplicateCandidate(item, file, hash, fallbackKey)
    );
    if (!duplicate) return;

    const displayName =
      duplicate.originalName || duplicate.id || file.name || t('duplicateUploadFallbackName');
    const proceed = await confirmDialog({
      title: t('duplicateUploadTitle'),
      description: t('duplicateUploadBody', { fileName: displayName }),
      confirmText: t('duplicateUploadReplace'),
      cancelText: t('duplicateUploadUseExisting'),
      danger: true,
    });

    if (!proceed) {
      pendingLibraryItem.value = duplicate;
      selectedLibraryId.value = duplicate.id;
      fileRef.value = null;
      if (audioInput.value) {
        audioInput.value.value = '';
      }
      emit('toast', { type: 'info', messageKey: 'toastDuplicateUploadUsingExisting' });
    }
  } catch (error) {
    console.warn('[audio] duplicate detection failed', error);
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
    await api.delete(props.deleteEndpoint);
    emit('audio-deleted');
    emit('toast', { type: 'success', messageKey: 'toastAudioRemoved' });

    if (props.libraryEnabled) {
      await fetchLibrary(true);
    }
  } catch {
  } finally {
    savingAudio.value = false;
    deleteArmed.value = false;
    if (deleteTimer) clearTimeout(deleteTimer);
  }
}

function fallbackLibraryName(item) {
  if (!item) return '';
  const source = item.originalName || item.id || '';
  return source.length > 48 ? `${source.slice(0, 48)}…` : source;
}

function selectionDetails() {
  if (fileRef.value) {
    return {
      label: t('audioLibraryPendingUpload'),
      name: fileRef.value.name,
      size: formatSize(fileRef.value.size || 0),
    };
  }
  if (pendingLibraryItem.value) {
    const item = pendingLibraryItem.value;
    return {
      label: t('audioLibraryPendingLabel'),
      name: fallbackLibraryName(item),
      size: item.size ? formatSize(item.size) : '',
    };
  }
  if (props.audioLibraryId) {
    const name = props.audioFileName || props.audioLibraryId;
    return {
      label: t('audioLibrarySelectedLabel'),
      name,
      size: props.audioFileSize ? formatSize(props.audioFileSize) : '',
    };
  }
  if (props.audioFileName) {
    return {
      label: t('customAudioFileName'),
      name: props.audioFileName,
      size: props.audioFileSize ? formatSize(props.audioFileSize) : '',
    };
  }
  return { label: '', name: '', size: '' };
}

const selectionSummary = computed(() => selectionDetails());

function clearLibrarySelection() {
  pendingLibraryItem.value = null;
  selectedLibraryId.value = '';
}

async function fetchLibrary(force = false) {
  if (!props.libraryEnabled) return;
  if (libraryLoading.value) return;
  if (!force && libraryItems.value.length) return;
  try {
    libraryLoading.value = true;
    libraryError.value = '';
    const { data } = await api.get('/api/audio-settings/library');
    if (data && Array.isArray(data.items)) {
      libraryItems.value = data.items;
    } else {
      libraryItems.value = [];
    }
  } catch (error) {
    console.error('Error loading audio library:', error);
    libraryError.value = t('audioLibraryLoadFailed');
  } finally {
    libraryLoading.value = false;
  }
}

function openLibrary() {
  libraryDrawerOpen.value = true;
  fetchLibrary(true);
}

function closeLibrary() {
  libraryDrawerOpen.value = false;
  libraryError.value = '';
}

function onLibrarySelect(item) {
  if (!item || !item.id) return;
  pendingLibraryItem.value = item;
  selectedLibraryId.value = item.id;
  fileRef.value = null;
  if (audioInput.value) audioInput.value.value = '';
  errorMsg.value = '';
  closeLibrary();
}

async function onLibraryDelete(item) {
  if (!item || !item.id) return;
  const normalizedProvider = (item.provider || '').toString().trim().toLowerCase();
  const deletable = !normalizedProvider || normalizedProvider === 'supabase';
  if (!deletable) {
    emit('toast', { type: 'info', messageKey: 'audioLibraryDeleteNotAllowed' });
    return;
  }

  const confirmed = await confirmDialog({
    title: t('audioLibraryDeleteTitle'),
    description: t('audioLibraryDeleteDesc'),
    confirmText: t('audioLibraryDeleteConfirm'),
    cancelText: t('commonCancel'),
    danger: true,
  });
  if (!confirmed) return;

  try {
    await api.delete(`/api/audio-settings/library/${encodeURIComponent(item.id)}`);
    if (pendingLibraryItem.value && pendingLibraryItem.value.id === item.id) {
      pendingLibraryItem.value = null;
    }
    if (selectedLibraryId.value === item.id) {
      selectedLibraryId.value = '';
    }
    await fetchLibrary(true);
    emit('toast', { type: 'success', messageKey: 'toastAudioLibraryDeleted' });
    if (props.audioLibraryId === item.id) {
      emit('audio-deleted', { reason: 'library-deleted', silent: true });
    }
  } catch (error) {
    const code = error?.response?.data?.error;
    if (code === 'audio_library_delete_unsupported') {
      emit('toast', { type: 'info', messageKey: 'audioLibraryDeleteNotAllowed' });
    } else {
      console.error('[audio-library] delete failed', error);
      emit('toast', { type: 'error', messageKey: 'toastAudioLibraryDeleteFailed' });
    }
  }
}

watch(
  () => props.audioLibraryId,
  (next) => {
    if (!next) {
      if (!pendingLibraryItem.value) {
        selectedLibraryId.value = '';
      }
      return;
    }
    if (pendingLibraryItem.value && pendingLibraryItem.value.id === next) {
      pendingLibraryItem.value = null;
    }
    selectedLibraryId.value = next;
  },
  { immediate: true }
);

watch(
  () => props.audioFileName,
  () => {
    if (!pendingLibraryItem.value && !fileRef.value) {
      // keep current summary derived from props
      return;
    }
    if (pendingLibraryItem.value) {
      pendingLibraryItem.value = null;
    }
    fileRef.value = null;
    if (audioInput.value) audioInput.value.value = '';
  }
);
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
.library-col {
  flex: 1 1 180px;
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  .file-label {
    font-weight: 600;
    margin-right: 6px;
  }
  .file-name {
    font-weight: 500;
  }
  .selection-summary {
    margin-top: 1rem;
  }
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 6px;
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
  background: var(--switch-color, #553fee);
  border-color: var(--switch-color, #553fee);
}
.switch[aria-pressed='true'] .knob {
  transform: translateX(16px);
}
.switch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--switch-color, #553fee) 35%, transparent);
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
