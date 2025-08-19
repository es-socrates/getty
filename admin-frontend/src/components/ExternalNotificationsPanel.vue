<template>
  <section class="admin-tab active" role="form">
    <OsCard>
      <div class="form-group">
        <label class="label">{{ t('externalDiscordWebhook') }}</label>
        <input class="input" :class="{'input-error': errors.discordWebhook}" v-model="form.discordWebhook" placeholder="https://discord.com/api/webhooks/..." @input="validate" />
        <small v-if="errors.discordWebhook" class="small" style="color:#b91c1c">{{ errors.discordWebhook }}</small>
      </div>

    <div class="form-group mt-4">
      <label class="label" for="obs-ws-ip">{{ t('obsWsIpLabel') }}</label>
      <input class="input" id="obs-ws-ip" v-model="obsForm.ip" :placeholder="t('obsWsIpPlaceholder')" @input="validateObs" />
      <label class="label mt-2" for="obs-ws-port">{{ t('obsWsPortLabel') }}</label>
      <input class="input" id="obs-ws-port" type="number" v-model="obsForm.port" :placeholder="t('obsWsPortPlaceholder')" @input="validateObs" />
      <label class="label mt-2" for="obs-ws-password">{{ t('obsWsPasswordLabel') }}</label>
      <input class="input" id="obs-ws-password" type="password" v-model="obsForm.password" :placeholder="t('obsWsPasswordPlaceholder')" @input="validateObs" />
      <small v-if="obsErrors.ip || obsErrors.port" class="small" style="color:#b91c1c">
        {{ obsErrors.ip || obsErrors.port }}
      </small>
      <button class="btn mt-2" :disabled="!obsDirty || hasObsErrors || obsSaving" @click="saveObs" :aria-busy="obsSaving ? 'true':'false'">
        <span v-if="obsSaving">{{ t('commonSaving') }}</span>
        <span v-else>{{ t('saveObsWsSettings') }}</span>
      </button>
    </div>

  <div class="form-group grid mt-4" style="grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <label class="label">{{ t('externalTelegramBotToken') }}</label>
          <input class="input" :class="{'input-error': errors.telegramBotToken}" v-model="form.telegramBotToken" placeholder="123456:ABCDEF" @input="validate" />
          <small v-if="errors.telegramBotToken" class="small" style="color:#b91c1c">{{ errors.telegramBotToken }}</small>
        </div>
        <div>
          <label class="label">{{ t('externalTelegramChatId') }}</label>
          <input class="input" :class="{'input-error': errors.telegramChatId}" v-model="form.telegramChatId" placeholder="-1001234567890" @input="validate" />
          <small v-if="errors.telegramChatId" class="small" style="color:#b91c1c">{{ errors.telegramChatId }}</small>
        </div>
      </div>
  <div class="form-group mt-4">
        <label class="label">{{ t('externalTemplate') }}</label>
        <textarea class="input" rows="3" v-model="form.template"></textarea>
        <small class="small">{{ t('externalTemplateHint') }}</small>
      </div>
  <div class="flex gap-2 items-center" role="group" aria-label="External notifications actions">
  <button class="btn" :disabled="!dirty || hasErrors || saving" @click="save" :aria-busy="saving? 'true':'false'">{{ saving ? t('commonSaving') : t('externalSave') }}</button>
    <span class="small" :style="{color: statusActive ? '#16a34a':'#888'}" :aria-live="dirty ? 'polite':'off'">{{ statusActive ? t('externalStatusActive'): t('externalStatusInactive') }}</span>
      </div>
  </OsCard>

  <div class="os-subtle p-4 rounded-os mt-4 flex items-start gap-3">
      <svg width="24" height="24" fill="none" style="flex-shrink:0;">
  <circle cx="12" cy="12" r="12" fill="#38bdf8" />
  <path d="M12 8v4m0 4h.01" stroke="#fff" stroke-width="2" stroke-linecap="round" />
      </svg>
      <div>
        <strong class="mr-1">{{ t('obsWsReminderTitle') }}</strong>
        <span>{{ t('obsWsReminderDesc') }}</span>
        <ul style="margin:8px 0 0 16px;">
          <li>{{ t('obsWsReminderNetwork') }}</li>
          <li>{{ t('obsWsReminderRemoteUrl') }}</li>
          <li>{{ t('obsWsReminderLocalMode') }}</li>
          <li>{{ t('obsWsReminderUpdateUrl') }}</li>
          <li>{{ t('obsWsReminderFirewall') }}</li>
          <li>{{ t('obsWsReminderNetworkConfig') }}</li>
          <li style="color:#ca004b;font-size:16px;">{{ t('obsWsReminderCopyUrl') }}</li>
        </ul>
      </div>
  </div>
  </section>
</template>
<script setup>

import { ref, onMounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import { pushToast } from '../services/toast';
import { registerDirty } from '../composables/useDirtyRegistry';
import { isHttpUrl } from '../utils/validation';
import OsCard from './os/OsCard.vue'

const { t } = useI18n();

const form = ref({
  discordWebhook: '',
  telegramBotToken: '',
  telegramChatId: '',
  template: ''
});

const errors = ref({
  discordWebhook: '',
  telegramBotToken: '',
  telegramChatId: ''
});

const initial = ref('');
const statusActive = ref(false);
const dirty = ref(false);
const saving = ref(false);

registerDirty(() => dirty.value);

const hasErrors = computed(() => Object.values(errors.value).some(e => e));

watch(form, () => {
  dirty.value = JSON.stringify(form.value) !== initial.value;
}, { deep: true });

async function load() {
  try {
    const r = await axios.get('/api/external-notifications');
    form.value.discordWebhook = r.data.config.discordWebhook || '';
    form.value.telegramBotToken = r.data.config.telegramBotToken || '';
    form.value.telegramChatId = r.data.config.telegramChatId || '';
    form.value.template = r.data.config.template || '';
    statusActive.value = !!r.data.active;
    initial.value = JSON.stringify(form.value);
    dirty.value = false;
  } catch {
    pushToast({ type: 'error', message: t('externalSaveFailed') });
  }
}

const obsForm = ref({ ip: '', port: '', password: '' });
const obsInitial = ref('');
const obsDirty = ref(false);
const obsSaving = ref(false);
const obsErrors = ref({ ip: '', port: '' });
const hasObsErrors = computed(() => Object.values(obsErrors.value).some(e => e));

watch(obsForm, () => {
  obsDirty.value = JSON.stringify(obsForm.value) !== obsInitial.value;
}, { deep: true });

async function loadObs() {
  try {
    const r = await axios.get('/api/obs-ws-config');
    obsForm.value.ip = r.data.ip || '';
    obsForm.value.port = r.data.port || '';
    obsForm.value.password = r.data.password || '';
    obsInitial.value = JSON.stringify(obsForm.value);
    obsDirty.value = false;
  } catch {
    pushToast({ type: 'error', message: t('externalSaveFailed') });
  }
}

function validateObs() {
  obsErrors.value.ip = obsForm.value.ip && !/^([\d]{1,3}\.){3}[\d]{1,3}$/.test(obsForm.value.ip) && obsForm.value.ip !== 'localhost'
    ? t('invalidUrl')
    : '';
  obsErrors.value.port = obsForm.value.port && (isNaN(Number(obsForm.value.port)) || Number(obsForm.value.port) < 1)
    ? t('requiredField')
    : '';
}

async function saveObs() {
  validateObs();
  if (hasObsErrors.value) return;
  try {
    obsSaving.value = true;
    const payload = { ...obsForm.value };
    const r = await axios.post('/api/obs-ws-config', payload);
    if (r.data.success) {
      pushToast({ type: 'success', message: t('externalSaved') });
      obsInitial.value = JSON.stringify(obsForm.value);
      obsDirty.value = false;
    } else {
      pushToast({ type: 'error', message: t('externalSaveFailed') });
    }
  } catch {
    pushToast({ type: 'error', message: t('externalSaveFailed') });
  } finally {
    obsSaving.value = false;
  }
}

function mapError(msg) {
  if (/Either Discord webhook/.test(msg)) return t('externalValidationError');
  if (/Invalid payload/.test(msg)) return t('externalSaveFailed');
  return t('externalSaveFailed');
}

function validate() {
  errors.value.discordWebhook = form.value.discordWebhook && !isHttpUrl(form.value.discordWebhook)
    ? t('invalidUrl')
    : '';

  if (form.value.telegramBotToken || form.value.telegramChatId) {
    errors.value.telegramBotToken = form.value.telegramBotToken ? '' : t('requiredField');
    errors.value.telegramChatId = form.value.telegramChatId ? '' : t('requiredField');
  } else {
    errors.value.telegramBotToken = '';
    errors.value.telegramChatId = '';
  }
}

async function save() {
  validate();
  if (hasErrors.value) return;
  try {
    saving.value = true;
    const payload = { ...form.value };
    const r = await axios.post('/api/external-notifications', payload);
    if (r.data.success) {
      pushToast({ type: 'success', message: t('externalSaved') });
      statusActive.value = !!r.data.status?.active;
      initial.value = JSON.stringify(form.value);
      dirty.value = false;
    } else {
      pushToast({ type: 'error', message: mapError(r.data.error) });
    }
  } catch (e) {
    const msg = e.response?.data?.error;
    pushToast({ type: 'error', message: mapError(msg) });
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  load();
  loadObs();
});
</script>
