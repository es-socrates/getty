<template>
  <transition name="gif-library-fade">
    <div
      v-if="open"
      class="gif-library-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="t('gifLibraryTitle')"
      @click.self="emitClose">
      <div class="gif-library-panel">
        <header class="gif-library-header">
          <div class="gif-library-header-text">
            <h2 class="gif-library-title">{{ t('gifLibraryTitle') }}</h2>
            <p class="gif-library-subtitle">{{ t('gifLibrarySubtitle') }}</p>
          </div>
          <div class="gif-library-header-actions">
            <button class="btn-secondary btn-compact-secondary" type="button" @click="emitRefresh">
              {{ t('commonRefresh') }}
            </button>
            <button class="btn-secondary btn-compact-secondary" type="button" @click="emitClose">
              {{ t('commonClose') }}
            </button>
          </div>
        </header>
        <section class="gif-library-body" aria-live="polite">
          <div v-if="loading" class="gif-library-status">{{ t('commonLoading') }}</div>
          <div v-else-if="error" class="gif-library-status is-error">
            <span>{{ error }}</span>
            <button class="btn-secondary btn-compact-secondary" type="button" @click="emitRefresh">
              {{ t('commonRefresh') }}
            </button>
          </div>
          <div v-else-if="!items.length" class="gif-library-empty">
            <p>{{ t('gifLibraryEmpty') }}</p>
            <p class="gif-library-empty-hint">{{ t('gifLibraryEmptyHint') }}</p>
          </div>
          <ul v-else class="gif-library-grid">
            <li v-for="item in items" :key="item.id" class="gif-library-item">
              <div class="gif-thumb" aria-hidden="true">
                <img
                  :src="item.url"
                  :alt="item.originalName || item.id"
                  loading="lazy"
                  decoding="async" />
              </div>
              <div class="gif-meta">
                <div class="gif-meta-primary">
                  <span class="gif-file-name">{{
                    item.originalName || fallbackName(item.id)
                  }}</span>
                  <span v-if="itemSize(item)" class="gif-file-size">{{ itemSize(item) }}</span>
                </div>
                <div class="gif-meta-secondary">
                  <span v-if="itemDimensions(item)">{{ itemDimensions(item) }}</span>
                  <span v-if="itemUploaded(item)">{{ itemUploaded(item) }}</span>
                </div>
              </div>
              <div class="gif-actions">
                <button class="btn" type="button" @click="emitSelect(item)">
                  {{ t('gifLibraryUseGif') }}
                </button>
                <button
                  v-if="canDelete(item)"
                  class="btn-secondary btn-compact-secondary gif-delete-btn"
                  type="button"
                  :disabled="isDeleting(item)"
                  :aria-busy="isDeleting(item) ? 'true' : 'false'"
                  @click="emitDelete(item)">
                  {{ t('commonDelete') }}
                </button>
              </div>
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
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [size]
 * @property {string} [originalName]
 * @property {string} [uploadedAt]
 */

const props = defineProps({
  open: { type: Boolean, required: true },
  items: { type: Array, required: true },
  loading: { type: Boolean, required: true },
  error: { type: String, default: '' },
  deletingId: { type: String, default: '' },
});

const emit = defineEmits(['close', 'select', 'refresh', 'delete']);

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

function emitDelete(item) {
  emit('delete', item);
}

function canDelete(item) {
  if (!item) return false;
  const provider = (item.provider || '').toString().trim().toLowerCase();
  return !provider || provider === 'supabase';
}

function isDeleting(item) {
  if (!item || !item.id) return false;
  return props.deletingId === item.id;
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
function itemDimensions(item) {
  if (!item.width || !item.height) return '';
  return `${item.width}×${item.height}`;
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
 * @param {string} id
 */
function fallbackName(id) {
  if (!id) return t('gifLibraryUnknown');
  return id.length > 24 ? `${id.slice(0, 24)}…` : id;
}
</script>

<style scoped>
.gif-library-fade-enter-active,
.gif-library-fade-leave-active {
  transition: opacity 0.2s ease;
}
.gif-library-fade-enter-from,
.gif-library-fade-leave-to {
  opacity: 0;
}

.gif-library-overlay {
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

:global([data-theme='light']) .gif-library-overlay {
  background: color-mix(in srgb, rgba(244, 247, 255, 0.84) 86%, transparent);
}

.gif-library-panel {
  width: min(820px, 92vw);
  max-height: min(640px, 90vh);
  background: var(--card, #0f1214);
  color: var(--text-strong, #f4f7ff);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(16px);
}

:global([data-theme='light']) .gif-library-panel {
  background: var(--card, #ffffff);
  color: var(--text-strong, #0f172a);
  border-color: rgba(15, 23, 42, 0.08);
  box-shadow: 0 24px 55px rgba(15, 23, 42, 0.12);
}

.gif-library-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 22px 26px 18px;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.14));
}

:global([data-theme='light']) .gif-library-header {
  border-bottom-color: rgba(15, 23, 42, 0.08);
}

.gif-library-header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gif-library-title {
  font-size: 20px;
  font-weight: 600;
  color: inherit;
}

.gif-library-subtitle {
  font-size: 13px;
  opacity: 0.78;
  max-width: 500px;
}

.gif-library-header-actions {
  display: flex;
  gap: 8px;
}

.gif-library-body {
  padding: 18px 26px 26px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.gif-library-status {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  opacity: 0.9;
  color: inherit;
}

.gif-library-status.is-error {
  color: #f88;
}

.gif-library-empty {
  text-align: center;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  opacity: 0.82;
  color: inherit;
}

.gif-library-empty-hint {
  font-size: 12px;
}

.gif-library-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 18px;
}

.gif-library-item {
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

.gif-library-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 36px rgba(2, 6, 14, 0.38);
}

:global([data-theme='light']) .gif-library-item {
  background: color-mix(in srgb, var(--card, #ffffff) 96%, transparent);
  border-color: rgba(15, 23, 42, 0.08);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
}

:global([data-theme='light']) .gif-library-item:hover {
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.16);
}

.gif-thumb {
  border-radius: 10px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  backdrop-filter: blur(4px);
}

:global([data-theme='light']) .gif-thumb {
  background: rgba(248, 250, 255, 0.92);
  border-color: rgba(15, 23, 42, 0.08);
}

.gif-meta-primary,
.gif-meta-secondary {
  color: inherit;
}

.gif-thumb img {
  max-width: 100%;
  max-height: 180px;
  object-fit: contain;
  display: block;
}

.gif-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gif-meta-primary {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-weight: 600;
  font-size: 13px;
}

.gif-meta-secondary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  opacity: 0.78;
}

.gif-file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gif-file-size {
  opacity: 0.78;
}

.gif-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.gif-delete-btn {
  white-space: nowrap;
}

@media (max-width: 720px) {
  .gif-library-overlay {
    padding: 16px;
  }
  .gif-library-panel {
    width: 100%;
    max-height: 92vh;
  }
  .gif-library-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .gif-library-header-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
