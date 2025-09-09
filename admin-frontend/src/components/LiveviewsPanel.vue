<template>
  <section class="admin-tab active" role="form">
    <OsCard>
      <div class="grid [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))] gap-3">
        <div class="form-group [grid-column:1/-1]">
          <label class="label">{{ t('liveviewsClaimId') }}</label>
          <input
            class="input"
            :class="{ 'input-error': errors.claimid }"
            v-model="form.claimid"
            @input="validate" />
          <small v-if="errors.claimid" class="small text-red-700">{{ errors.claimid }}</small>
        </div>
        <div class="form-group">
          <label class="label">{{ t('liveviewsViewersLabel') }}</label>
          <input class="input" v-model="form.viewersLabel" />
        </div>
        <div class="form-group">
          <label class="label">{{ t('liveviewsFont') }}</label>
          <select class="input" v-model="form.font">
            <option value="Inter">Inter</option>
            <option value="Arial">Arial</option>
            <option value="Roboto">Roboto</option>
            <option value="'Open Sans'">Open Sans</option>
            <option value="'Source Sans Pro'">Source Sans Pro</option>
            <option value="'Fira Sans'">Fira Sans</option>
            <option value="'Nunito'">Nunito</option>
            <option value="'Poppins'">Poppins</option>
            <option value="'Montserrat'">Montserrat</option>
            <option value="'JetBrains Mono'">JetBrains Mono</option>
            <option value="system-ui">System UI</option>
            <option value="custom">Custom…</option>
          </select>
        </div>
        <div class="form-group" v-if="form.font === 'custom'">
          <label class="label">Custom Font Family</label>
          <input
            class="input"
            v-model="customFont"
            @input="applyCustomFont"
            placeholder="e.g. 'My Font', sans-serif" />
        </div>
        <div class="form-group">
          <label class="label">{{ t('liveviewsSize') }}</label>
          <input class="input" v-model="form.size" />
        </div>
      </div>

      <div class="grid mt-4 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))] gap-3">
        <div class="form-group">
          <label class="label">{{ t('liveviewsBg') }}</label
          ><input class="input" type="color" v-model="form.bg" />
        </div>
        <div class="form-group">
          <label class="label">{{ t('liveviewsColor') }}</label
          ><input class="input" type="color" v-model="form.color" />
        </div>
      </div>
      <div class="form-group mt-3">
        <label class="label">{{ t('liveviewsIcon') }}</label>
        <div class="flex gap-2 items-center">
          <input type="file" accept="image/*" @change="selectIcon" />
          <button v-if="form.icon" class="btn danger" @click="removeIcon">
            {{ t('liveviewsRemoveIcon') }}
          </button>
          <div v-if="form.icon" class="ml-3">
            <img :src="form.icon" class="h-10 object-contain" />
          </div>
        </div>
      </div>
      <div class="mt-4 flex gap-2" role="group" aria-label="Liveviews actions">
        <button
          class="btn"
          :disabled="!dirty || saving"
          @click="save"
          :aria-busy="saving ? 'true' : 'false'">
          {{ saving ? t('commonSaving') : t('liveviewsSave') }}
        </button>
      </div>
      <div class="mt-4">
        <label class="label">Widget URL</label>
        <CopyField :value="widgetUrl" />
      </div>
    </OsCard>
  </section>
</template>
<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import { pushToast } from '../services/toast';
import { registerDirty } from '../composables/useDirtyRegistry';
import CopyField from './shared/CopyField.vue';
import OsCard from './os/OsCard.vue';
import { usePublicToken } from '../composables/usePublicToken';

const { t } = useI18n();

const form = ref({
  bg: '#fff',
  color: '#222',
  font: 'Inter',
  size: '32',
  icon: '',
  claimid: '',
  viewersLabel: 'viewers',
});

const customFont = ref('');
const errors = ref({ claimid: '' });
const pt = usePublicToken();
const widgetUrl = computed(() => pt.withToken(`${location.origin}/widgets/liveviews`));
const initial = ref('');
const dirty = ref(false);
const saving = ref(false);
const removingIcon = ref(false);

registerDirty(() => dirty.value);
watch(
  form,
  () => {
    dirty.value = JSON.stringify(form.value) !== initial.value;
  },
  { deep: true }
);

function applyCustomFont() {
  if (form.value.font === 'custom') {
    form.value.font = customFont.value || 'custom';
  }
}

function validate() {
  errors.value.claimid = form.value.claimid.trim() ? '' : t('requiredField');
}

async function load() {
  try {
    const r = await axios.get('/config/liveviews-config.json');
    Object.assign(form.value, r.data);
    initial.value = JSON.stringify(form.value);
    dirty.value = false;
  } catch {
    pushToast({ type: 'error', message: t('liveviewsSaveFailed') });
  }
}

async function save() {
  validate();
  if (errors.value.claimid) return;
  try {
    saving.value = true;
    const fd = new FormData();
    Object.entries(form.value).forEach(([k, v]) => fd.append(k, v || ''));
    if (removingIcon.value) fd.append('removeIcon', '1');
    const r = await fetch('/config/liveviews-config.json', { method: 'POST', body: fd });
    const data = await r.json();
    if (data.success) {
      pushToast({ type: 'success', message: t('liveviewsSaved') });
      Object.assign(form.value, data.config);
      initial.value = JSON.stringify(form.value);
      dirty.value = false;
      removingIcon.value = false;
    } else {
      pushToast({ type: 'error', message: t('liveviewsSaveFailed') });
    }
  } catch {
    pushToast({ type: 'error', message: t('liveviewsSaveFailed') });
  } finally {
    saving.value = false;
  }
}

function selectIcon(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('icon', file);
  Object.entries(form.value).forEach(([k, v]) => fd.append(k, v || ''));
  fetch('/config/liveviews-config.json', { method: 'POST', body: fd })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        Object.assign(form.value, data.config);
        initial.value = JSON.stringify(form.value);
        dirty.value = false;
        pushToast({ type: 'success', message: t('liveviewsSaved') });
      } else {
        pushToast({ type: 'error', message: t('liveviewsSaveFailed') });
      }
    });
}

function removeIcon() {
  removingIcon.value = true;
  save();
}

onMounted(async () => {
  await pt.refresh();
  await load();
});
</script>
