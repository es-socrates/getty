<template>
  <section class="admin-tab active" role="form">
  <div class="panel-surface">
      <div class="form-group">
        <label class="label">{{ t('externalDiscordWebhook') }}</label>
        <input class="input" :class="{'input-error': errors.discordWebhook}" v-model="form.discordWebhook" placeholder="https://discord.com/api/webhooks/..." @input="validate" />
        <small v-if="errors.discordWebhook" class="small" style="color:#b91c1c">{{ errors.discordWebhook }}</small>
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

// i18n
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

onMounted(load);
</script>
