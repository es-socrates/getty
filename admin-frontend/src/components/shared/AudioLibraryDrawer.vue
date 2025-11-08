<template>
  <transition name="audio-library-fade">
    <div
      v-if="open"
      class="audio-library-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="t('audioLibraryTitle')"
      @click.self="emitClose">
      <div class="audio-library-panel">
        <header class="audio-library-header">
          <div class="audio-library-header-text">
            <h2 class="audio-library-title">{{ t('audioLibraryTitle') }}</h2>
            <p class="audio-library-subtitle">{{ t('audioLibrarySubtitle') }}</p>
          </div>
          <div class="audio-library-header-actions">
            <button
              class="btn-secondary btn-compact-secondary"
              type="button"
              :disabled="loading"
              @click="emitRefresh">
              {{ t('commonRefresh') }}
            </button>
            <button class="btn-secondary btn-compact-secondary" type="button" @click="emitClose">
              {{ t('commonClose') }}
            </button>
          </div>
        </header>
        <section class="audio-library-body" aria-live="polite">
          <div v-if="loading" class="audio-library-status">{{ t('commonLoading') }}</div>
          <div v-else-if="error" class="audio-library-status is-error">
            <span>{{ error }}</span>
            <button class="btn-secondary btn-compact-secondary" type="button" @click="emitRefresh">
              {{ t('commonRefresh') }}
            </button>
          </div>
          <div v-else-if="!items.length" class="audio-library-empty">
            <p>{{ t('audioLibraryEmpty') }}</p>
            <p class="audio-library-empty-hint">{{ t('audioLibraryEmptyHint') }}</p>
          </div>
          <ul v-else class="audio-library-grid">
            <li v-for="item in items" :key="item.id" class="audio-library-item">
              <div class="audio-meta">
                <div class="audio-meta-primary">
                  <span class="audio-name">{{ item.originalName || fallbackName(item.id) }}</span>
                  <span v-if="itemSize(item)" class="audio-size">{{ itemSize(item) }}</span>
                </div>
                <div class="audio-meta-secondary">
                  <span v-if="itemUploaded(item)">{{ itemUploaded(item) }}</span>
                </div>
              </div>
              <audio
                v-if="item.url"
                class="audio-preview"
                :src="item.url"
                controls
                preload="none"
                :aria-label="t('audioLibraryPreviewLabel')"></audio>
              <button class="btn" type="button" @click="emitSelect(item)">
                {{ t('audioLibraryUseAudio') }}
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * @typedef {Object} LibraryItem
 * @property {string} id
 * @property {string} url
 * @property {number} [size]
 * @property {string} [originalName]
 * @property {string} [uploadedAt]
 */

defineProps({
  open: { type: Boolean, required: true },
  items: { type: Array, required: true },
  loading: { type: Boolean, required: true },
  error: { type: String, default: '' },
});

const emit = defineEmits(['close', 'select', 'refresh']);

const { t } = useI18n();

const dateFormatter = computed(() => {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
});

function emitClose() {
  emit('close');
}

/**
 * @param {LibraryItem} item
 */
function emitSelect(item) {
  emit('select', item);
}

function emitRefresh() {
  emit('refresh');
}

/**
 * @param {LibraryItem} item
 */
function itemSize(item) {
  if (!item.size || item.size <= 0) return '';
  const kiloBytes = item.size / 1024;
  if (!Number.isFinite(kiloBytes)) return '';
  if (kiloBytes >= 1024) {
    const megaBytes = kiloBytes / 1024;
    const precision = megaBytes >= 10 ? 0 : 1;
    return `${megaBytes.toFixed(precision)} MB`;
  }
  const precision = kiloBytes >= 10 ? 0 : 1;
  return `${kiloBytes.toFixed(precision)} KB`;
}

/**
 * @param {LibraryItem} item
 */
function itemUploaded(item) {
  if (!item.uploadedAt) return '';
  const parsed = new Date(item.uploadedAt);
  if (Number.isNaN(parsed.getTime())) return '';
  return dateFormatter.value.format(parsed);
}

/**
 * @param {string | undefined} id
 */
function fallbackName(id) {
  if (!id) return t('audioLibraryUnknown');
  return id.length > 32 ? `${id.slice(0, 32)}…` : id;
}
</script>

<style scoped>
.audio-library-fade-enter-active,
.audio-library-fade-leave-active {
  transition: opacity 0.2s ease;
}
.audio-library-fade-enter-from,
.audio-library-fade-leave-to {
  opacity: 0;
}

.audio-library-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--bg-overlay, rgba(7, 11, 18, 0.92)) 78%, transparent);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
  padding: 30px;
}

:global([data-theme='light']) .audio-library-overlay {
  background: color-mix(in srgb, rgba(244, 247, 255, 0.84) 86%, transparent);
}

.audio-library-panel {
  width: min(720px, 92vw);
  max-height: min(600px, 90vh);
  background: var(--card, #0f1214);
  color: var(--text-strong, #f4f7ff);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(16px);
}

:global([data-theme='light']) .audio-library-panel {
  background: var(--card, #ffffff);
  color: var(--text-strong, #0f172a);
  border-color: rgba(15, 23, 42, 0.08);
  box-shadow: 0 24px 55px rgba(15, 23, 42, 0.12);
}

.audio-library-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 22px 26px 18px;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.14));
}

:global([data-theme='light']) .audio-library-header {
  border-bottom-color: rgba(15, 23, 42, 0.08);
}

.audio-library-header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.audio-library-title {
  font-size: 20px;
  font-weight: 600;
  color: inherit;
}

.audio-library-subtitle {
  font-size: 13px;
  opacity: 0.78;
  max-width: 420px;
}

.audio-library-header-actions {
  display: flex;
  gap: 8px;
}

.audio-library-body {
  padding: 18px 26px 26px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.audio-library-status {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  opacity: 0.9;
  color: inherit;
}

.audio-library-status.is-error {
  color: #f88;
}

.audio-library-empty {
  text-align: center;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  opacity: 0.82;
  color: inherit;
}

.audio-library-empty-hint {
  font-size: 12px;
}

.audio-library-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 18px;
}

.audio-library-item {
  background: color-mix(in srgb, var(--card, rgba(23, 28, 40, 0.94)) 86%, transparent);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 14px 32px rgba(2, 6, 14, 0.32);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.audio-library-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 36px rgba(2, 6, 14, 0.38);
}

:global([data-theme='light']) .audio-library-item {
  background: color-mix(in srgb, var(--card, #ffffff) 96%, transparent);
  border-color: rgba(15, 23, 42, 0.08);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
}

:global([data-theme='light']) .audio-library-item:hover {
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.16);
}

.audio-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.audio-meta-primary {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-weight: 600;
  font-size: 13px;
}

.audio-meta-secondary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  opacity: 0.78;
}

.audio-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audio-size {
  opacity: 0.78;
}

.audio-preview {
  width: 100%;
}

@media (max-width: 720px) {
  .audio-library-overlay {
    padding: 16px;
  }
  .audio-library-panel {
    width: 100%;
    max-height: 92vh;
  }
  .audio-library-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .audio-library-header-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
