<template>
  <section class="admin-tab active" role="form">

  <div class="panel-surface mb-4" aria-describedby="announce-settings-desc">
      <p id="announce-settings-desc" class="sr-only">
        Configure announcement rotation timing, theme, colors and animation.
      </p>
      <h3 class="widget-title mb-2">{{ t('announcementSettings') }}</h3>
      <div
        class="grid"
        style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;"
      >
        <div class="form-group">
          <label class="label">{{ t('announcementCooldownSeconds') }}</label>
          <input class="input" type="number" v-model.number="settings.cooldownSeconds" />
        </div>
        <div class="form-group">
          <label class="label">{{ t('announcementTheme') }}</label>
          <select class="input" v-model="settings.theme">
            <option value="vertical">{{ t('announcementThemeVertical') }}</option>
            <option value="horizontal">{{ t('announcementThemeHorizontal') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">{{ t('announcementBgColor') }}</label>
          <input class="input" type="color" v-model="settings.bgColor" />
        </div>
        <div class="form-group">
          <label class="label">{{ t('announcementTextColor') }}</label>
          <input class="input" type="color" v-model="settings.textColor" />
        </div>
        <div class="form-group">
          <label class="label">{{ t('announcementAnimationMode') }}</label>
          <select class="input" v-model="settings.animationMode">
            <option value="fade">{{ t('announcementAnimationFade') }}</option>
            <option value="slide-up">{{ t('announcementAnimationSlideUp') }}</option>
            <option value="slide-left">{{ t('announcementAnimationSlideLeft') }}</option>
            <option value="scale">{{ t('announcementAnimationScale') }}</option>
            <option value="random">{{ t('announcementAnimationRandom') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">{{ t('announcementDefaultDuration') }}</label>
          <input
            class="input"
            type="number"
            v-model.number="settings.defaultDurationSeconds"
          />
        </div>
        <div class="form-group">
          <label class="label">{{ t('announcementApplyAll') }}</label>
          <input type="checkbox" v-model="settings.applyAllDurations" />
        </div>
      </div>
      <div class="mt-3 flex gap-2">
        <button
          class="btn"
          :disabled="savingSettings"
          @click="saveSettings"
        >
          {{ savingSettings ? t('commonSaving') : t('announcementSaveSettings') }}
        </button>
        <button class="btn" @click="clearAll('all')">
          {{ t('announcementClearAll') }}
        </button>
        <button class="btn" @click="clearAll('test')">
          {{ t('announcementClearTest') }}
        </button>
      </div>
    </div>

  <div class="panel-surface">
      <div class="flex justify-between items-center mb-3">
        <h3 class="widget-title mb-0">{{ t('announcementAddMessage') }}</h3>
      </div>
      <form
        @submit.prevent="addMessage"
        class="grid"
        aria-describedby="add-message-desc"
        style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;"
      >
        <p id="add-message-desc" class="sr-only">Add a new announcement with optional link, duration and image.</p>
        <div class="form-group" style="grid-column:1/-1;">
          <label class="label">{{ t('announcementText') }}</label>
          <input
            class="input"
            :class="{ 'input-error': errors.text }"
            v-model="newMsg.text"
            maxlength="120"
            required
          />
          <div class="flex gap-2 small" style="justify-content:space-between;">
            <small :style="errors.text ? 'color:#ef4444':''">
              {{ errors.text || ' ' }}
            </small>
            <small aria-live="polite" aria-atomic="true">
              {{ t('charsUsed', { used: newMsg.text.length, max: 120 }) }}
            </small>
          </div>
          <small
            v-if="errors.text"
            class="small"
            style="color:#ef4444"
          >
            {{ errors.text }}
          </small>
        </div>
        <div class="form-group">
          <label class="label">{{ t('announcementLinkUrl') }}</label>
          <input
            class="input"
            :class="{ 'input-error': errors.linkUrl }"
            v-model="newMsg.linkUrl"
          />
          <small
            v-if="errors.linkUrl"
            class="small"
            style="color:#ef4444"
          >
            {{ errors.linkUrl }}
          </small>
        </div>
        <div class="form-group">
          <label class="label">{{ t('announcementDurationSeconds') }}</label>
          <input
            class="input"
            type="number"
            :class="{ 'input-error': errors.durationSeconds }"
            v-model.number="newMsg.durationSeconds"
          />
          <small
            v-if="errors.durationSeconds"
            class="small"
            style="color:#ef4444"
          >
            {{ errors.durationSeconds }}
          </small>
        </div>
        <div class="form-group">
          <label class="label">{{ t('announcementImage') }}</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif"
            @change="onNewImage"
          />
          <div v-if="newMsg.imageFile" class="mt-1 small">
            {{ newMsg.imageFile.name }}
          </div>
        </div>
        <div style="grid-column:1/-1;" class="flex gap-2">
          <button
            class="btn"
            :disabled="adding"
            type="submit"
            :aria-busy="adding ? 'true' : 'false'"
          >
            {{ adding ? t('commonAdding') : t('announcementAddMessage') }}
          </button>
        </div>
      </form>

      <div class="mt-4" v-if="messages.length">
        <div v-for="m in messages" :key="m.id" class="announcement-item">
          <div class="flex gap-3 items-start">
            <div class="flex-1 min-w-0">
              <div class="font-semibold leading-snug" style="font-size:14px;">{{ m.text }}</div>
              <div class="small break-all" v-if="m.linkUrl">{{ m.linkUrl }}</div>
              <div class="small" v-if="m.durationSeconds">
                {{ t('announcementDurationSeconds') }}: {{ m.durationSeconds }}
              </div>
            </div>
            <div v-if="m.imageUrl" class="shrink-0">
              <img :src="m.imageUrl" style="height:50px;object-fit:cover;border-radius:4px;" />
            </div>
            <div class="flex flex-col gap-2 items-end shrink-0" style="min-width:140px;">
              <label class="small flex items-center gap-1">
                <input
                  type="checkbox"
                  v-model="m.enabled"
                  @change="toggleMessageEnabled(m)"
                  :aria-label="t('announcementEnabled') + ' ' + m.text"
                />
                {{ t('announcementEnabled') }}
              </label>
              <div class="flex gap-2">
                <button
                  class="btn"
                  @click="openEdit(m)"
                  :aria-label="t('commonEdit') + ' ' + m.text"
                >
                  {{ t('commonEdit') }}
                </button>
                <button
                  class="btn danger"
                  @click="deleteMessage(m)"
                  :aria-label="t('commonDelete') + ' ' + m.text"
                >
                  {{ t('commonDelete') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="editing"
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-edit-title"
        @keydown.esc.prevent="closeEdit"
      >
  <div class="modal panel-surface" style="max-width:480px;width:100%;" ref="modalRef">
          <h3 id="announcement-edit-title" class="widget-title mb-2">
            {{ t('commonEdit') }}
          </h3>
          <div class="form-group">
            <label class="label">{{ t('announcementText') }}</label>
            <input class="input" v-model="editForm.text" maxlength="120" />
            <div class="flex gap-2 small" style="justify-content:space-between;">
              <small>&nbsp;</small>
              <small aria-live="polite" aria-atomic="true">
                {{ t('charsUsed', { used: editForm.text.length, max: 120 }) }}
              </small>
            </div>
          </div>
          <div class="form-group">
            <label class="label">{{ t('announcementLinkUrl') }}</label>
            <input class="input" v-model="editForm.linkUrl" />
          </div>
            <div class="form-group">
            <label class="label">{{ t('announcementDurationSeconds') }}</label>
            <input
              class="input"
              type="number"
              v-model.number="editForm.durationSeconds"
            />
          </div>
          <div class="form-group flex gap-2 items-center">
            <label>
              <input type="checkbox" v-model="editForm.enabled" />
              {{ t('announcementEnabled') }}
            </label>
            <label>
              <input type="checkbox" v-model="editForm.removeImage" />
              {{ t('announcementRemoveImage') }}
            </label>
          </div>
          <div class="flex gap-2 mt-3">
            <button class="btn" :disabled="updating" @click="submitEdit">
              {{ updating ? t('commonUpdating') : t('commonSave') }}
            </button>
            <button class="btn" @click="closeEdit">{{ t('commonClose') }}</button>
          </div>
        </div>
      </div>

      <div class="mt-6">
        <h3 class="widget-title mb-2">{{ t('announcementFavicon') }}</h3>
        <div class="flex gap-2 items-end">
          <div class="form-group" style="flex:1;">
            <label class="label">{{ t('announcementSiteUrl') }}</label>
            <input
              class="input"
              v-model="faviconUrl"
              placeholder="https://example.com"
            />
          </div>
          <button class="btn" @click="fetchFavicon">
            {{ t('announcementFaviconFetch') }}
          </button>
          <div v-if="faviconData" class="flex items-center gap-2">
            <img
              :src="faviconData"
              style="height:32px;width:32px;object-fit:contain;"
            />
            <button class="btn" @click="clearFavicon">
              {{ t('announcementFaviconNone') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  <!-- OBS Integration panel -->
  <div class="panel-surface mt-4">
      <h3 class="widget-title mb-2">{{ t('obsIntegration') }}</h3>
      <div class="form-group">
        <label class="label">{{ t('announcementWidgetUrl') }}</label>
        <CopyField :value="widgetUrl" />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import { pushToast } from '../services/toast';
import { isHttpUrl, withinRange, MAX_TITLE_LEN, MAX_ANNOUNCEMENT_IMAGE } from '../utils/validation';
import CopyField from './shared/CopyField.vue';

const { t } = useI18n();

const settings = ref({
  cooldownSeconds: 30,
  theme: 'vertical',
  bgColor: '#111111',
  textColor: '#ffffff',
  animationMode: 'fade',
  defaultDurationSeconds: 10,
  applyAllDurations: false,
});
const messages = ref([]);
const newMsg = ref({ text: '', linkUrl: '', durationSeconds: 10, imageFile: null });
const errors = ref({ text: '', linkUrl: '', durationSeconds: '' });
const editing = ref(false);
const editForm = ref({
  id: null,
  text: '',
  linkUrl: '',
  durationSeconds: 10,
  enabled: true,
  removeImage: false,
});
const faviconUrl = ref('');
const faviconData = ref(null);
const savingSettings = ref(false);
const adding = ref(false);
const updating = ref(false);
const modalRef = ref(null);
// Widget URL for OBS integration
const widgetUrl = computed(() => `${location.origin}/widgets/announcement.html`);

async function load() {
  try {
    const r = await axios.get('/api/announcement');
    if (r.data.success) {
      Object.assign(settings.value, r.data.config.settings);
      messages.value = r.data.config.messages;
    }
  } catch {}
}

async function saveSettings() {
  try {
    savingSettings.value = true;
    const r = await axios.post('/api/announcement', settings.value);
    if (r.data.success) {
      pushToast({ type: 'success', message: t('announcementSavedSettings') });
      load();
    } else {
      pushToast({ type: 'error', message: t('announcementSaveSettingsFailed') });
    }
  } catch {
    pushToast({ type: 'error', message: t('announcementSaveSettingsFailed') });
  } finally {
    savingSettings.value = false;
  }
}

function onNewImage(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  if (f.size > MAX_ANNOUNCEMENT_IMAGE) {
    pushToast({ type: 'error', message: t('announcementImageTooLarge') });
    return;
  }
  newMsg.value.imageFile = f;
}

function validateNew() {
  errors.value = { text: '', linkUrl: '', durationSeconds: '' };
  if (!newMsg.value.text.trim()) errors.value.text = t('requiredField');
  if (newMsg.value.linkUrl && !isHttpUrl(newMsg.value.linkUrl)) errors.value.linkUrl = t('invalidUrl');
  if (!withinRange(newMsg.value.durationSeconds, 1, 60)) errors.value.durationSeconds = t('valRange1to60');
  return !errors.value.text && !errors.value.linkUrl && !errors.value.durationSeconds;
}

async function addMessage() {
  if (!validateNew()) return;
  try {
    adding.value = true;
    const fd = new FormData();
    fd.append('text', newMsg.value.text);
    if (newMsg.value.linkUrl) fd.append('linkUrl', newMsg.value.linkUrl);
    if (newMsg.value.durationSeconds) fd.append('durationSeconds', newMsg.value.durationSeconds);
    if (newMsg.value.imageFile) fd.append('image', newMsg.value.imageFile);
    const r = await fetch('/api/announcement/message', { method: 'POST', body: fd });
    const data = await r.json();
    if (data.success) {
      pushToast({ type: 'success', message: t('announcementMsgAdded') });
      newMsg.value = { text: '', linkUrl: '', durationSeconds: 10, imageFile: null };
      load();
    } else {
      pushToast({ type: 'error', message: data.error || t('announcementSaveSettingsFailed') });
    }
  } catch {
    pushToast({ type: 'error', message: t('announcementSaveSettingsFailed') });
  } finally {
    adding.value = false;
  }
}

async function toggleMessageEnabled(m) {
  m.enabled = !!m.enabled;
  await updateMessage(m);
}

async function updateMessage(m) {
  try {
    const payload = {
      enabled: m.enabled,
      text: m.text,
      linkUrl: m.linkUrl || '',
      durationSeconds: m.durationSeconds,
    };
    const r = await axios.put(`/api/announcement/message/${m.id}`, payload);
    if (r.data.success) {
      pushToast({ type: 'success', message: t('announcementMsgUpdated') });
    } else {
      pushToast({ type: 'error', message: r.data.error });
    }
  } catch {
    pushToast({ type: 'error', message: t('announcementSaveSettingsFailed') });
  }
}

function openEdit(m) {
  editing.value = true;
  editForm.value = {
    id: m.id,
    text: m.text,
    linkUrl: m.linkUrl || '',
    durationSeconds: m.durationSeconds || 10,
    enabled: !!m.enabled,
    removeImage: false,
  };
  nextTick(() => {
    const first = modalRef.value?.querySelector('input,button,select,textarea');
    first && first.focus();
  });
}

function closeEdit() {
  editing.value = false;
}

async function submitEdit() {
  try {
    updating.value = true;
    const payload = {
      text: editForm.value.text,
      linkUrl: editForm.value.linkUrl,
      enabled: editForm.value.enabled,
      durationSeconds: editForm.value.durationSeconds,
      removeImage: editForm.value.removeImage,
    };
    const r = await axios.put(`/api/announcement/message/${editForm.value.id}`, payload);
    if (r.data.success) {
      pushToast({ type: 'success', message: t('announcementMsgUpdated') });
      editing.value = false;
      load();
    } else {
      pushToast({ type: 'error', message: r.data.error });
    }
  } catch {
    pushToast({ type: 'error', message: t('announcementSaveSettingsFailed') });
  } finally {
    updating.value = false;
  }
}

async function deleteMessage(m) {
  if (!confirm('Delete message?')) return;
  try {
    const r = await axios.delete(`/api/announcement/message/${m.id}`);
    if (r.data.success) {
      pushToast({ type: 'success', message: t('announcementMsgDeleted') });
      load();
    } else {
      pushToast({ type: 'error', message: r.data.error || t('announcementMsgDeleteFailed') });
    }
  } catch {
    pushToast({ type: 'error', message: t('announcementMsgDeleteFailed') });
  }
}

async function clearAll(mode) {
  try {
    const r = await axios.delete(`/api/announcement/messages?mode=${mode}`);
    if (r.data.success) {
      pushToast({ type: 'success', message: t('announcementCleared') });
      load();
    } else {
      pushToast({ type: 'error', message: t('announcementClearFailed') });
    }
  } catch {
    pushToast({ type: 'error', message: t('announcementClearFailed') });
  }
}

async function fetchFavicon() {
  if (!faviconUrl.value) return;
  try {
    const r = await axios.get('/api/announcement/favicon', { params: { url: faviconUrl.value } });
    faviconData.value = r.data.favicon;
  } catch {
    faviconData.value = null;
  }
}

function clearFavicon() {
  faviconData.value = null;
}

function trapFocus(e) {
  if (!editing.value) return;
  const focusable = modalRef.value?.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable || !focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.key === 'Tab') {
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  if (e.key === 'Escape') {
    closeEdit();
  }
}

onMounted(() => {
  load();
  document.addEventListener('keydown', trapFocus);
});
onBeforeUnmount(() => document.removeEventListener('keydown', trapFocus));
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.input-error {
  border-color: #b91c1c !important;
}
.announcement-item {
  padding: 0.75rem 0.75rem 0.85rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--card-border);
  border-radius: 0.65rem;
  background: color-mix(in srgb, var(--card-bg) 55%, transparent);
  backdrop-filter: blur(4px);
  transition: background .25s, border-color .25s;
}
.announcement-item:hover {
  background: color-mix(in srgb, var(--card-bg) 70%, transparent);
  border-color: color-mix(in srgb, var(--card-border) 60%, transparent);
}
.announcement-item:last-child { margin-bottom: 0; }
</style>
