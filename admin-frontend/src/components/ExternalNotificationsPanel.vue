<template>
  <section class="admin-tab active relative" role="form">
    <div v-if="masked" class="absolute inset-0 z-10 flex items-center justify-center" style="backdrop-filter: blur(4px); background: rgba(0,0,0,0.35);">
      <div class="p-5 rounded-os bg-[var(--bg-card)] border border-[var(--card-border)] shadow-lg max-w-md text-center">
        <div class="mb-2 text-lg font-semibold">{{ t('externalSessionRequiredTitle') }}</div>
        <p class="mb-4 text-sm">{{ t('externalSessionRequiredBody') }}</p>
        <a href="/new-session" class="btn">{{ t('createSession') }}</a>
      </div>
    </div>

    <OsCard>
      <div class="mb-2 font-semibold">{{ t('tipNotificationsTitle') }}</div>
      <div class="form-group">
        <label class="label">{{ t('externalDiscordWebhook') }}</label>
        <div class="input-group">
          <input
            class="input"
            :class="{'input-error': errors.discordWebhook}"
            :type="reveal.discord ? 'text' : 'password'"
            v-model="form.discordWebhook"
            placeholder="https://discord.com/api/webhooks/..."
            @input="validate"
            autocomplete="off"
          />
          <button type="button" @click="reveal.discord = !reveal.discord" :aria-pressed="reveal.discord ? 'true' : 'false'" :aria-label="reveal.discord ? 'Hide' : 'Show'">
            <svg v-if="!reveal.discord" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94" />
              <path d="M1 1l22 22" />
              <path d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 3-3 3 3 0 0 0-.24-1.17" />
            </svg>
          </button>
        </div>
        <small v-if="errors.discordWebhook" class="small" style="color:#b91c1c">{{ errors.discordWebhook }}</small>
      </div>
  <div class="form-group grid mt-4" style="grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <label class="label">{{ t('externalTelegramBotToken') }}</label>
          <div class="input-group">
            <input
              class="input"
              :class="{'input-error': errors.telegramBotToken}"
              :type="reveal.telegram ? 'text' : 'password'"
              v-model="form.telegramBotToken"
              placeholder="123456:ABCDEF"
              @input="validate"
              autocomplete="off"
            />
            <button type="button" @click="reveal.telegram = !reveal.telegram" :aria-pressed="reveal.telegram ? 'true' : 'false'" :aria-label="reveal.telegram ? 'Hide' : 'Show'">
              <svg v-if="!reveal.telegram" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94" />
                <path d="M1 1l22 22" />
                <path d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 3-3 3 3 0 0 0-.24-1.17" />
              </svg>
            </button>
          </div>
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
  <button class="btn" :disabled="!dirty || hasErrors || saving || masked" @click="save" :aria-busy="saving? 'true':'false'">{{ saving ? t('commonSaving') : t('externalSave') }}</button>
    <span class="small" :style="{color: statusActive ? '#16a34a':'#888'}" :aria-live="dirty ? 'polite':'off'">{{ statusActive ? t('externalStatusActive'): t('externalStatusInactive') }}</span>
      </div>
  </OsCard>

  <OsCard class="mt-4">
    <div class="form-group">
      <label class="label" for="obs-ws-ip">{{ t('obsWsIpLabel') }}</label>
      <div class="input-group">
        <input
          class="input"
          id="obs-ws-ip"
          :type="reveal.obsIp ? 'text' : 'password'"
          v-model="obsForm.ip"
          :placeholder="t('obsWsIpPlaceholder')"
          @input="validateObs"
          autocomplete="off"
        />
        <button type="button" @click="reveal.obsIp = !reveal.obsIp" :aria-pressed="reveal.obsIp ? 'true' : 'false'" :aria-label="reveal.obsIp ? 'Hide' : 'Show'">
          <svg v-if="!reveal.obsIp" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94" />
            <path d="M1 1l22 22" />
            <path d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 3-3 3 3 0 0 0-.24-1.17" />
          </svg>
        </button>
      </div>
      <label class="label mt-2" for="obs-ws-port">{{ t('obsWsPortLabel') }}</label>
      <input class="input" id="obs-ws-port" type="number" v-model="obsForm.port" :placeholder="t('obsWsPortPlaceholder')" @input="validateObs" />
      <label class="label mt-2" for="obs-ws-password">{{ t('obsWsPasswordLabel') }}</label>
      <div class="input-group">
        <input
          class="input"
          id="obs-ws-password"
          :type="reveal.obsPwd ? 'text' : 'password'"
          v-model="obsForm.password"
          :placeholder="t('obsWsPasswordPlaceholder')"
          @input="validateObs"
          autocomplete="off"
        />
        <button type="button" @click="reveal.obsPwd = !reveal.obsPwd" :aria-pressed="reveal.obsPwd ? 'true' : 'false'" :aria-label="reveal.obsPwd ? 'Hide' : 'Show'">
          <svg v-if="!reveal.obsPwd" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94" />
            <path d="M1 1l22 22" />
            <path d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 3-3 3 3 0 0 0-.24-1.17" />
          </svg>
        </button>
      </div>
      <small v-if="obsErrors.ip || obsErrors.port" class="small" style="color:#b91c1c">
        {{ obsErrors.ip || obsErrors.port }}
      </small>
      <button class="btn mt-2" :disabled="!obsDirty || hasObsErrors || obsSaving || masked" @click="saveObs" :aria-busy="obsSaving ? 'true':'false'">
        <span v-if="obsSaving">{{ t('commonSaving') }}</span>
        <span v-else>{{ t('saveObsWsSettings') }}</span>
      </button>
    </div>
  </OsCard>

  <OsCard class="mt-4">
    <div class="mt-1">
      <Alert>
        <Rocket class="h-5 w-5 alert-icon" />
        <div class="flex-1">
          <AlertTitle>{{ t('liveCredsWebhookHelpTitle') }}</AlertTitle>
          <AlertDescription>{{ t('liveCredsWebhookHelp') }}</AlertDescription>
        </div>
      </Alert>
    </div>
    <div class="form-group mt-4">
      <label class="label">Live Discord Webhook</label>
      <div class="input-group">
        <input
          class="input"
          :class="{'input-error': errors.liveDiscordWebhook}"
          :type="reveal.liveDiscord ? 'text' : 'password'"
          v-model="form.liveDiscordWebhook"
          placeholder="https://discord.com/api/webhooks/..."
          @input="validate"
          autocomplete="off"
        />
        <button type="button" @click="reveal.liveDiscord = !reveal.liveDiscord" :aria-pressed="reveal.liveDiscord ? 'true' : 'false'">
          <span>{{ reveal.liveDiscord ? 'Hide' : 'Show' }}</span>
        </button>
      </div>
      <small v-if="errors.liveDiscordWebhook" class="small" style="color:#b91c1c">{{ errors.liveDiscordWebhook }}</small>
    </div>

    <div class="form-group grid mt-4" style="grid-template-columns:1fr 1fr; gap:12px;">
      <div>
        <label class="label">Live Telegram Bot Token</label>
        <div class="input-group">
          <input
            class="input"
            :class="{'input-error': errors.liveTelegramBotToken}"
            :type="reveal.liveTelegram ? 'text' : 'password'"
            v-model="form.liveTelegramBotToken"
            placeholder="123456:ABCDEF"
            @input="validate"
            autocomplete="off"
          />
          <button type="button" @click="reveal.liveTelegram = !reveal.liveTelegram" :aria-pressed="reveal.liveTelegram ? 'true' : 'false'">
            <span>{{ reveal.liveTelegram ? 'Hide' : 'Show' }}</span>
          </button>
        </div>
        <small v-if="errors.liveTelegramBotToken" class="small" style="color:#b91c1c">{{ errors.liveTelegramBotToken }}</small>
      </div>
      <div>
        <label class="label">Live Telegram Chat ID</label>
        <input class="input" :class="{'input-error': errors.liveTelegramChatId}" v-model="form.liveTelegramChatId" placeholder="-1001234567890" @input="validate" />
        <small v-if="errors.liveTelegramChatId" class="small" style="color:#b91c1c">{{ errors.liveTelegramChatId }}</small>
      </div>
    </div>
    <div class="mt-3">
      <button class="btn" :disabled="!dirty || hasErrors || saving || masked" @click="save">{{ saving ? t('commonSaving') : t('externalSave') }}</button>
      <div class="mt-2 small" :style="(liveHas.discord || liveHas.telegram) ? 'opacity:0.8' : 'color:#b91c1c'">
        <template v-if="liveHas.discord || liveHas.telegram">
          {{ t('liveTargetsLabel') }} {{ [ liveHas.discord ? t('discord') : null, liveHas.telegram ? t('telegram') : null ].filter(Boolean).join(', ') }}
        </template>
        <template v-else>
          {{ t('liveTargetsNone') }}
        </template>
      </div>
    </div>
  </OsCard>
  </section>
</template>
<script setup>

import { ref, reactive, onMounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import { pushToast } from '../services/toast';
import { registerDirty } from '../composables/useDirtyRegistry';
import { isHttpUrl } from '../utils/validation';
import OsCard from './os/OsCard.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Rocket } from 'lucide-vue-next'

const { t } = useI18n();

const masked = ref(false);

const reveal = reactive({ discord: false, obsIp: false, obsPwd: false, telegram: false, liveDiscord: false, liveTelegram: false });

const form = ref({
  discordWebhook: '',
  telegramBotToken: '',
  telegramChatId: '',
  template: '',
  liveDiscordWebhook: '',
  liveTelegramBotToken: '',
  liveTelegramChatId: ''
});

const errors = ref({
  discordWebhook: '',
  telegramBotToken: '',
  telegramChatId: '',
  liveDiscordWebhook: '',
  liveTelegramBotToken: '',
  liveTelegramChatId: ''
});

const initial = ref('');
const statusActive = ref(false);
const dirty = ref(false);
const saving = ref(false);
const liveHas = ref({ discord: false, telegram: false });

registerDirty(() => dirty.value);

const hasErrors = computed(() => Object.values(errors.value).some(e => e));

watch(form, () => {
  dirty.value = JSON.stringify(form.value) !== initial.value;
}, { deep: true });

async function load() {
  try {
    const [modulesRes, r] = await Promise.all([
      axios.get('/api/modules').catch(() => ({ data: {} })),
      axios.get('/api/external-notifications')
    ]);
    masked.value = !!modulesRes?.data?.masked;
    form.value.discordWebhook = r.data.config?.discordWebhook || '';
    form.value.telegramBotToken = r.data.config?.telegramBotToken || '';
    form.value.telegramChatId = r.data.config?.telegramChatId || '';
    form.value.template = r.data.config?.template || '';
    form.value.liveDiscordWebhook = r.data.config?.liveDiscordWebhook || '';
    form.value.liveTelegramBotToken = r.data.config?.liveTelegramBotToken || '';
    form.value.liveTelegramChatId = r.data.config?.liveTelegramChatId || '';
    liveHas.value.discord = !!r.data.config?.hasLiveDiscord;
    liveHas.value.telegram = !!r.data.config?.hasLiveTelegram;
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
  if (masked.value) {
    pushToast({ type: 'info', message: t('externalSessionRequiredToast') });
    return;
  }
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

  errors.value.liveDiscordWebhook = form.value.liveDiscordWebhook && !isHttpUrl(form.value.liveDiscordWebhook)
    ? t('invalidUrl')
    : '';

  if (form.value.liveTelegramBotToken || form.value.liveTelegramChatId) {
    errors.value.liveTelegramBotToken = form.value.liveTelegramBotToken ? '' : t('requiredField');
    errors.value.liveTelegramChatId = form.value.liveTelegramChatId ? '' : t('requiredField');
  } else {
    errors.value.liveTelegramBotToken = '';
    errors.value.liveTelegramChatId = '';
  }
}

async function save() {
  if (masked.value) {
    pushToast({ type: 'info', message: t('externalSessionRequiredToast') });
    return;
  }
  validate();
  if (hasErrors.value) return;
  try {
    saving.value = true;

    const payload = {
      discordWebhook: (form.value.discordWebhook || '').trim() || undefined,
      telegramBotToken: (form.value.telegramBotToken || '').trim() || undefined,
      telegramChatId: (form.value.telegramChatId || '').trim() || undefined,
      template: (form.value.template || '').toString(),
      liveDiscordWebhook: (form.value.liveDiscordWebhook || '').trim() || undefined,
      liveTelegramBotToken: (form.value.liveTelegramBotToken || '').trim() || undefined,
      liveTelegramChatId: (form.value.liveTelegramChatId || '').trim() || undefined
    };
    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
    const r = await axios.post('/api/external-notifications', payload);
    if (r.data.success) {
      pushToast({ type: 'success', message: t('externalSaved') });
      statusActive.value = !!r.data.status?.active;
      initial.value = JSON.stringify(form.value);
      dirty.value = false;

      try {
        const rr = await axios.get('/api/external-notifications');
        liveHas.value.discord = !!rr.data?.config?.hasLiveDiscord;
        liveHas.value.telegram = !!rr.data?.config?.hasLiveTelegram;
      } catch {}
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
