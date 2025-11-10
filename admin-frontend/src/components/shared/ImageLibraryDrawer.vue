<template>
  <transition name="img-library-fade">
    <div
      v-if="open"
      class="img-library-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="title || t('imageLibraryTitle')"
      @click.self="emitClose">
      <div class="img-library-panel">
        <header class="img-library-header">
          <div class="img-library-header-text">
            <h2 class="img-library-title">{{ title || t('imageLibraryTitle') }}</h2>
            <p class="img-library-subtitle">
              {{ subtitle || t('imageLibrarySubtitle') }}
            </p>
          </div>
          <div class="img-library-header-actions">
            <button class="btn-secondary btn-compact-secondary" type="button" @click="emitRefresh">
              {{ t('commonRefresh') }}
            </button>
            <button class="btn-secondary btn-compact-secondary" type="button" @click="emitClose">
              {{ t('commonClose') }}
            </button>
          </div>
        </header>
        <section class="img-library-body" aria-live="polite">
          <div v-if="loading" class="img-library-status">{{ t('commonLoading') }}</div>
          <div v-else-if="error" class="img-library-status is-error">
            <span>{{ error || t('imageLibraryLoadFailed') }}</span>
            <button class="btn-secondary btn-compact-secondary" type="button" @click="emitRefresh">
              {{ t('commonRefresh') }}
            </button>
          </div>
          <div v-else-if="!items.length" class="img-library-empty">
            <p>{{ t('imageLibraryEmpty') }}</p>
            <p class="img-library-empty-hint">{{ t('imageLibraryEmptyHint') }}</p>
          </div>
          <ul v-else class="img-library-grid">
            <li v-for="item in items" :key="item.id" class="img-library-item">
              <div class="img-thumb" aria-hidden="true">
                <img
                  :src="item.url"
                  :alt="item.originalName || fallbackName(item.id)"
                  loading="lazy"
                  decoding="async" />
              </div>
              <div class="img-meta">
                <div class="img-meta-primary">
                  <span class="img-file-name">{{
                    item.originalName || fallbackName(item.id)
                  }}</span>
                  <span v-if="itemSize(item)" class="img-file-size">{{ itemSize(item) }}</span>
                </div>
                <div class="img-meta-secondary">
                  <span v-if="itemDimensions(item)">{{ itemDimensions(item) }}</span>
                  <span v-if="itemUploaded(item)">{{ itemUploaded(item) }}</span>
                </div>
              </div>
              <button class="btn" type="button" @click="emitSelect(item)">
                {{ t('imageLibraryUseImage') }}
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
 * @property {number} [width]
 * @property {number} [height]
 */

defineProps({
  open: { type: Boolean, required: true },
  items: { type: Array, required: true },
  loading: { type: Boolean, required: true },
  error: { type: String, default: '' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
});

const emit = defineEmits(['close', 'select', 'refresh']);
const { t } = useI18n();

const dateFormatter = computed(
  () => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
);

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
  const size = Number(item?.size);
  if (!Number.isFinite(size) || size <= 0) return '';
  const kb = size / 1024;
  if (kb >= 1024) {
    const mb = kb / 1024;
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
  }
  return `${kb >= 10 ? Math.round(kb) : kb.toFixed(1)} KB`;
}

/**
 * @param {LibraryItem} item
 */
function itemDimensions(item) {
  if (!item?.width || !item?.height) return '';
  return `${item.width}×${item.height}`;
}

/**
 * @param {LibraryItem} item
 */
function itemUploaded(item) {
  const ts = item?.uploadedAt;
  if (!ts) return '';
  const parsed = new Date(ts);
  if (Number.isNaN(parsed.getTime())) return '';
  return dateFormatter.value.format(parsed);
}

function fallbackName(id) {
  if (!id) return t('imageLibraryUnknown');
  return id.length > 24 ? `${id.slice(0, 24)}…` : id;
}
</script>

<style scoped>
.img-library-fade-enter-active,
.img-library-fade-leave-active {
  transition: opacity 0.2s ease;
}
.img-library-fade-enter-from,
.img-library-fade-leave-to {
  opacity: 0;
}

.img-library-overlay {
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

:global([data-theme='light']) .img-library-overlay {
  background: color-mix(in srgb, rgba(244, 247, 255, 0.84) 86%, transparent);
}

.img-library-panel {
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

:global([data-theme='light']) .img-library-panel {
  background: var(--card, #ffffff);
  color: var(--text-strong, #0f172a);
  border-color: rgba(15, 23, 42, 0.08);
  box-shadow: 0 24px 55px rgba(15, 23, 42, 0.12);
}

.img-library-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 22px 26px 18px;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.14));
}

:global([data-theme='light']) .img-library-header {
  border-bottom-color: rgba(15, 23, 42, 0.08);
}

.img-library-header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.img-library-title {
  font-size: 20px;
  font-weight: 600;
}

.img-library-subtitle {
  font-size: 13px;
  opacity: 0.78;
  max-width: 500px;
}

.img-library-header-actions {
  display: flex;
  gap: 8px;
}

.img-library-body {
  padding: 18px 26px 26px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.img-library-status {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  opacity: 0.9;
}

.img-library-status.is-error {
  color: #f88;
}

.img-library-empty {
  text-align: center;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  opacity: 0.82;
}

.img-library-empty-hint {
  font-size: 12px;
}

.img-library-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 18px;
}

.img-library-item {
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

.img-library-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 36px rgba(2, 6, 14, 0.38);
}

:global([data-theme='light']) .img-library-item {
  background: color-mix(in srgb, var(--card, #ffffff) 96%, transparent);
  border-color: rgba(15, 23, 42, 0.08);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
}

:global([data-theme='light']) .img-library-item:hover {
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.16);
}

.img-thumb {
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

:global([data-theme='light']) .img-thumb {
  background: rgba(248, 250, 255, 0.92);
  border-color: rgba(15, 23, 42, 0.08);
}

.img-thumb img {
  max-width: 100%;
  max-height: 180px;
  object-fit: contain;
  display: block;
}

.img-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.img-meta-primary {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-weight: 600;
  font-size: 13px;
}

.img-meta-secondary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  opacity: 0.78;
}

.img-file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.img-file-size {
  opacity: 0.78;
}

@media (max-width: 720px) {
  .img-library-overlay {
    padding: 16px;
  }
  .img-library-panel {
    width: 100%;
    max-height: 92vh;
  }
  .img-library-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .img-library-header-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
