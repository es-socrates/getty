<template>
  <section class="admin-tab active" role="form">
    <OsCard :title="t('socialMediaTitle')">
      <template #actions>
        <div class="flex gap-2" role="group" :aria-label="t('socialMediaTitle') + ' actions'">
          <button class="btn" @click="addItem" :aria-label="t('socialMediaAddItem')">{{ t('socialMediaAddItem') }}</button>
          <button class="btn" :disabled="!dirty || saving" @click="save" :aria-busy="saving ? 'true':'false'">{{ saving ? t('commonSaving') : t('socialMediaSave') }}</button>
        </div>
      </template>

      <div class="os-table social-media" :aria-label="t('socialMediaTitle') + ' table'">
        <div class="os-tr py-2">
          <div class="os-th num">#</div>
          <div class="os-th">{{ t('socialMediaName') }}</div>
          <div class="os-th">{{ t('socialMediaLink') }}</div>
          <div class="os-th">{{ t('socialMediaIcon') }}</div>
          <div class="os-th">{{ t('socialMediaCustomIcon') }}</div>
          <div class="os-th"></div>
        </div>

        <div v-for="(item, idx) in items" :key="idx" class="os-tr py-2">
          <div class="os-td num">{{ idx+1 }}</div>
          <div class="os-td">
            <input class="input w-full" :aria-label="t('socialMediaName') + ' ' + (idx+1)" :class="{'input-error': fieldError(idx,'name')}" v-model="item.name" @input="validateRow(idx)" :aria-invalid="!!fieldError(idx,'name')" />
            <div v-if="fieldError(idx,'name')" class="small" style="color:#b91c1c">{{ fieldError(idx,'name') }}</div>
          </div>
          <div class="os-td">
            <input class="input w-full" :aria-label="t('socialMediaLink') + ' ' + (idx+1)" :class="{'input-error': fieldError(idx,'link')}" v-model="item.link" @input="validateRow(idx)" :aria-invalid="!!fieldError(idx,'link')" />
            <div v-if="fieldError(idx,'link')" class="small" style="color:#b91c1c">{{ fieldError(idx,'link') }}</div>
          </div>
          <div class="os-td">
            <select class="input w-full" v-model="item.icon" @change="onIconChange(item, idx)" :aria-label="t('socialMediaIcon') + ' ' + (idx+1)">
              <option value="x">{{ t('socialMediaIconX') }}</option>
              <option value="instagram">{{ t('socialMediaIconInstagram') }}</option>
              <option value="youtube">{{ t('socialMediaIconYoutube') }}</option>
              <option value="telegram">{{ t('socialMediaIconTelegram') }}</option>
              <option value="discord">{{ t('socialMediaIconDiscord') }}</option>
              <option value="odysee">{{ t('socialMediaIconOdysee') }}</option>
              <option value="rumble">{{ t('socialMediaIconRumble') }}</option>
              <option value="custom">{{ t('socialMediaIconCustom') }}</option>
            </select>
          </div>
          <div class="os-td">
            <div v-if="item.icon==='custom'">
              <input type="file" accept="image/*" @change="e=>selectCustomIcon(e, item)" :aria-label="t('socialMediaCustomIcon')" />
              <div v-if="item.customIcon" class="mt-1">
                <img :src="item.customIcon" alt="custom" style="max-height:40px;object-fit:contain;" />
              </div>
            </div>
          </div>
          <div class="os-td actions">
            <button class="btn danger" @click="remove(idx)" :aria-label="t('socialMediaDelete') + ' ' + (idx+1)">{{ t('socialMediaDelete') }}</button>
          </div>
        </div>
      </div>

      <div class="mt-3">
        <label class="label">{{ t('socialMediaWidgetUrl') }}</label>
        <CopyField :value="widgetUrl" />
      </div>
    </OsCard>
  </section>
</template>
<script setup>

import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import { pushToast } from '../services/toast';
import { registerDirty } from '../composables/useDirtyRegistry';
import CopyField from './shared/CopyField.vue';
import OsCard from './os/OsCard.vue'
import { isHttpUrl, MAX_CUSTOM_ICON_SIZE } from '../utils/validation';

const { t } = useI18n();

const items = ref([]);
const rowErrors = ref({});
const dirty = ref(false);
const saving = ref(false);

const widgetUrl = computed(() => `${location.origin}/widgets/socialmedia.html`);

function markDirty() { dirty.value = true; }
registerDirty(() => dirty.value);

async function load() {
  try {
    const r = await axios.get('/api/socialmedia-config');
    if (r.data.success) {
      items.value = r.data.config.map(c => ({ ...c }));
      dirty.value = false;
    } else {
      pushToast({ type: 'error', message: t('socialMediaLoadFailed') });
    }
  } catch {
    pushToast({ type: 'error', message: t('socialMediaLoadFailed') });
  }
}

function addItem() {
  items.value.push({ name: '', icon: 'x', link: '', customIcon: undefined });
  validateRow(items.value.length - 1);
  markDirty();
}
function remove(i) {
  items.value.splice(i, 1);
  markDirty();
}
function onIconChange(item) {
  if (item.icon !== 'custom') {
    delete item.customIcon;
  }
  markDirty();
}
function selectCustomIcon(e, item) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > MAX_CUSTOM_ICON_SIZE) {
    return pushToast({ type: 'error', message: t('socialMediaCustomIconTooLarge') });
  }
  const reader = new FileReader();
  reader.onload = ev => {
    item.customIcon = ev.target.result;
    markDirty();
  };
  reader.readAsDataURL(file);
}

function validateRow(i) {
  const it = items.value[i];
  if (!it) return;
  if (!rowErrors.value[i]) rowErrors.value[i] = {};
  rowErrors.value[i].name = it.name.trim() ? '' : t('socialMediaNameRequired');
  rowErrors.value[i].link = it.link.trim() ? '' : t('socialMediaLinkRequired');
  if (it.link && !isHttpUrl(it.link)) rowErrors.value[i].link = t('socialMediaInvalidUrl');
  markDirty();
}
function fieldError(i, field) { return rowErrors.value[i]?.[field] || ''; }

function mapBackendError(msg) {
  if (!msg) return t('socialMediaValidationError');
  if (/Too many items/i.test(msg)) return t('socialMediaTooMany');
  if (/name is required/i.test(msg)) return t('socialMediaNameRequired');
  if (/name is too long/i.test(msg)) return t('socialMediaNameTooLong');
  if (/link is required/i.test(msg)) return t('socialMediaLinkRequired');
  if (/link is too long/i.test(msg)) return t('socialMediaLinkTooLong');
  if (/valid HTTPS/i.test(msg)) return t('socialMediaInvalidHttps');
  if (/valid URL/i.test(msg)) return t('socialMediaInvalidUrl');
  if (/customIcon must be a data:image/i.test(msg)) return t('socialMediaCustomIconInvalid');
  if (/customIcon is too large/i.test(msg)) return t('socialMediaCustomIconTooLarge');
  return t('socialMediaValidationError');
}

async function save() {
  items.value.forEach((_, i) => validateRow(i));
  const hasErr = Object.values(rowErrors.value).some(r => (r.name || r.link));
  if (hasErr) {
    pushToast({ type: 'error', message: t('socialMediaValidationError') });
    return;
  }
  try {
    saving.value = true;
    const payload = {
      config: items.value.map(i => ({
        name: i.name,
        icon: i.icon,
        link: i.link,
        ...(i.icon === 'custom' && i.customIcon ? { customIcon: i.customIcon } : {})
      }))
    };
    const r = await axios.post('/api/socialmedia-config', payload);
    if (r.data.success) {
      pushToast({ type: 'success', message: t('socialMediaSaved') });
      dirty.value = false;
      await load();
    } else {
      pushToast({ type: 'error', message: mapBackendError(r.data.error) });
    }
  } catch (e) {
    const msg = e.response?.data?.error;
    pushToast({ type: 'error', message: mapBackendError(msg) });
  } finally {
    saving.value = false;
  }
}

onMounted(load);

</script>
