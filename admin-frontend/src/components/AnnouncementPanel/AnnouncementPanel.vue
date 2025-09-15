<template>
  <section class="announcement-admin" role="form">
    <nav class="ann-tabs" aria-label="Announcement tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="ann-tab"
        :class="{ active: activeTab === tab.id }"
        role="tab"
        :aria-selected="activeTab === tab.id ? 'true' : 'false'"
        @click="activeTab = tab.id">
        {{ tab.label }}
      </button>
    </nav>

    <div v-show="activeTab === 'settings'" class="ann-tab-panel" role="tabpanel">
      <div class="ann-card">
        <div class="ann-card-header">
          <h3 class="ann-card-title">{{ t('announcementSettings') }}</h3>
        </div>
        <div class="ann-grid">
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementCooldownSeconds') }}</label>
            <input class="ann-input" type="number" v-model.number="cooldownMinutes" min="1" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementTheme') }}</label>
            <select class="ann-select" v-model="settings.theme">
              <option value="vertical">{{ t('announcementThemeVertical') }}</option>
              <option value="horizontal">{{ t('announcementThemeHorizontal') }}</option>
            </select>
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementBgColor') }}</label>
            <input class="ann-input" type="color" v-model="settings.bgColor" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementTextColor') }}</label>
            <input class="ann-input" type="color" v-model="settings.textColor" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementAnimationMode') }}</label>
            <select class="ann-select" v-model="settings.animationMode">
              <option value="fade">{{ t('announcementAnimationFade') }}</option>
              <option value="slide-up">{{ t('announcementAnimationSlideUp') }}</option>
              <option value="slide-left">{{ t('announcementAnimationSlideLeft') }}</option>
              <option value="scale">{{ t('announcementAnimationScale') }}</option>
              <option value="random">{{ t('announcementAnimationRandom') }}</option>
            </select>
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementDefaultDuration') }}</label>
            <input
              class="ann-input"
              type="number"
              v-model.number="settings.defaultDurationSeconds" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label inline-flex items-center gap-2">{{
              t('announcementApplyAll')
            }}</label>
            <label class="ann-switch">
              <input type="checkbox" v-model="settings.applyAllDurations" />
              <span class="ann-slider"></span>
            </label>
          </div>
        </div>
        <div class="flex gap-2 mt-4 flex-wrap">
          <button class="btn" :disabled="savingSettings" @click="saveSettings">
            {{ savingSettings ? t('commonSaving') : t('announcementSaveSettings') }}
          </button>
          <button class="btn" @click="clearAll('all')">{{ t('announcementClearAll') }}</button>
          <button class="btn" @click="clearAll('test')">{{ t('announcementClearTest') }}</button>
        </div>
      </div>

      <div class="ann-card">
        <div class="ann-card-header">
          <h3 class="ann-card-title">{{ t('announcementFavicon') }}</h3>
        </div>
        <div class="ann-grid">
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementSiteUrl') }}</label>
            <input class="ann-input" v-model="faviconUrl" placeholder="https://example.com" />
          </div>
          <div class="ann-form-group flex items-end gap-2">
            <button class="btn" type="button" @click="fetchFavicon">
              {{ t('announcementFaviconFetch') }}
            </button>
            <div v-if="faviconData" class="flex items-center gap-2">
              <img :src="faviconData" class="h-8 w-8 object-contain" />
              <button class="btn" type="button" @click="clearFavicon">
                {{ t('announcementFaviconNone') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-show="activeTab === 'messages'" class="ann-tab-panel" role="tabpanel">
      <div class="ann-card">
        <div class="ann-card-header">
          <h3 class="ann-card-title">{{ t('announcementAddMessage') }}</h3>
        </div>
        <form @submit.prevent="addMessage">
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementText') }}</label>
            <textarea
              class="ann-textarea"
              :class="{ 'input-error': errors.text }"
              v-model="newMsg.text"
              maxlength="180"
              required />
            <div
              class="ann-char-count"
              :class="{
                warning: newMsg.text.length > 140 && newMsg.text.length <= 180,
                danger: newMsg.text.length > 180,
              }">
              {{ newMsg.text.length }}/180
            </div>
          </div>
          <div class="ann-grid">
            <div class="ann-form-group">
              <label class="ann-form-label">{{ t('announcementLinkUrl') }}</label>
              <input class="ann-input" v-model="newMsg.linkUrl" />
            </div>
            <div class="ann-form-group">
              <label class="ann-form-label">{{ t('announcementDurationSeconds') }}</label>
              <input class="ann-input" type="number" v-model.number="newMsg.durationSeconds" />
            </div>
            <div class="ann-form-group">
              <label class="ann-form-label">{{ t('announcementImage') }}</label>
              <div class="ann-file-wrapper">
                <button type="button" class="ann-file-btn" @click="$el.nextElementSibling.click()">
                  {{ t('announcementImage') }}
                </button>
                <input
                  class="ann-file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/gif"
                  @change="onNewImage" />
              </div>
              <div v-if="newMsg.imageFile" class="small opacity-80 mt-1">
                {{ newMsg.imageFile.name }}
              </div>
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button class="btn" type="submit" :disabled="adding">
              {{ adding ? t('commonAdding') : t('announcementAddMessage') }}
            </button>
          </div>
        </form>
      </div>

      <div class="ann-card">
        <div class="ann-card-header">
          <h3 class="ann-card-title">
            {{ t('announcementSettings') }} - {{ t('announcementAddMessage') }}
          </h3>
          <span class="ann-badge">{{ messages.length }}</span>
        </div>
        <div v-if="!messages.length" class="ann-alert info">
          <span>{{ t('announcementNoMessages') }}</span>
        </div>
        <div v-else>
          <div v-for="m in messages" :key="m.id" class="ann-message-item">
            <div class="ann-message-header">
              <div class="ann-message-text">{{ m.text }}</div>
              <label class="ann-action-btn">
                <input
                  type="checkbox"
                  v-model="m.enabled"
                  @change="toggleMessageEnabled(m)"
                  aria-label="t('announcementEnabled') + ' ' + m.text" />
                <span class="ann-enabled-label">{{ t('announcementEnabled') }}</span>
              </label>
            </div>
            <div class="ann-message-meta">
              <span v-if="m.linkUrl">{{ m.linkUrl }}</span>
              <span v-if="m.durationSeconds"
                >{{ t('announcementDurationSeconds') }}: {{ m.durationSeconds }}</span
              >
            </div>
            <div v-if="m.imageUrl" class="mt-2">
              <img :src="m.imageUrl" class="h-[50px] object-cover rounded" />
            </div>
            <div class="ann-message-actions">
              <button class="ann-action-btn" type="button" @click="(e) => openEdit(m, e)">
                {{ t('commonEdit') }}
              </button>
              <button class="ann-action-btn" type="button" @click="deleteMessage(m)">
                {{ t('commonDelete') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-show="activeTab === 'integration'" class="ann-tab-panel" role="tabpanel">
      <div class="ann-card">
        <div class="ann-card-header">
          <h3 class="ann-card-title">{{ t('obsIntegration') }}</h3>
        </div>
        <div class="ann-form-group">
          <label class="ann-form-label mb-1">{{ t('announcementWidgetUrlLabel') }}</label>
          <CopyField :value="widgetUrl" :aria-label="t('announcementWidgetUrlLabel')" />
        </div>
      </div>
    </div>

    <div
      v-if="editing"
      class="ann-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-edit-title">
      <div class="ann-modal" ref="modalRef">
        <h3 id="announcement-edit-title" class="ann-modal-title">{{ t('commonEdit') }}</h3>
        <div class="ann-form-group">
          <label class="ann-form-label">{{ t('announcementText') }}</label>
          <textarea class="ann-textarea" v-model="editForm.text" maxlength="180" />
          <div
            class="ann-char-count"
            :class="{
              warning: editForm.text.length > 140 && editForm.text.length <= 180,
              danger: editForm.text.length > 180,
            }">
            {{ editForm.text.length }}/180
          </div>
        </div>
        <div class="ann-form-group">
          <label class="ann-form-label">{{ t('announcementLinkUrl') }}</label>
          <input class="ann-input" v-model="editForm.linkUrl" />
        </div>
        <div class="ann-form-group">
          <label class="ann-form-label">{{ t('announcementDurationSeconds') }}</label>
          <input class="ann-input" type="number" v-model.number="editForm.durationSeconds" />
        </div>
        <div class="ann-form-group flex items-center gap-4">
          <label class="inline-flex items-center gap-2 text-xs opacity-80"
            ><input type="checkbox" v-model="editForm.enabled" />
            {{ t('announcementEnabled') }}</label
          >
          <label class="inline-flex items-center gap-2 text-xs opacity-80"
            ><input type="checkbox" v-model="editForm.removeImage" />
            {{ t('announcementRemoveImage') }}</label
          >
        </div>
        <div class="flex gap-2 mt-4">
          <button class="btn" :disabled="updating" @click="submitEdit">
            {{ updating ? t('commonUpdating') : t('commonSave') }}
          </button>
          <button class="btn" @click="closeEdit">{{ t('commonClose') }}</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import CopyField from '../shared/CopyField.vue';
import { useAnnouncementPanel } from './AnnouncementPanel.js';
import './AnnouncementPanel.css';

const { t } = useI18n();
const state = useAnnouncementPanel(t);
const {
  settings,
  cooldownMinutes,
  messages,
  newMsg,
  errors,
  editing,
  editForm,
  faviconUrl,
  faviconData,
  savingSettings,
  adding,
  updating,
  modalRef,
  widgetUrl,
  activeTab,
  saveSettings,
  clearAll,
  fetchFavicon,
  clearFavicon,
  addMessage,
  onNewImage,
  toggleMessageEnabled,
  openEdit,
  deleteMessage,
  submitEdit,
  closeEdit,
} = state;

const tabs = [
  { id: 'settings', label: t('settings') || t('announcementSettings') },
  { id: 'messages', label: t('announcementAddMessage') },
  { id: 'integration', label: t('obsIntegration') },
];
</script>

<style scoped>
.input-error {
  border-color: #b91c1c !important;
}
</style>
