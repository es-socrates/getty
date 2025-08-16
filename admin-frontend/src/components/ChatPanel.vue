<template>
  <section class="admin-tab active" role="form">
  <div class="panel-surface mb-4" aria-describedby="chat-desc">
      <p id="chat-desc" class="sr-only">Chat configuration including chat source and colors.</p>
      <div class="form-group" :aria-labelledby="chat-url-label" aria-live="polite">
        <label class="label" :id="chat-url-label" for="chat-url">{{ t('chatClaimId') || 'Claim ID' }}</label>
        <input
          class="input"
          :aria-invalid="!!errors.chatUrl"
          :class="{ 'input-error': errors.chatUrl }"
          id="chat-url"
          v-model="form.chatUrl"
          type="text"
          :placeholder="claimPlaceholder"
        />
        <div class="flex gap-2 small" style="justify-content:space-between;">
          <small :style="errors.chatUrl ? 'color:#b91c1c':''">
            {{ errors.chatUrl || ' ' }}
          </small>
          <small aria-live="polite" aria-atomic="true">
            {{ t('charsUsed', { used: form.chatUrl.length, max: 999 }) }}
          </small>
        </div>
      </div>
      <div class="mt-3">
        <div class="flex justify-between items-center mb-2" :aria-labelledby="colorHeadingId">
          <h3 class="widget-title mb-0" :id="colorHeadingId">
            {{ t('colorCustomizationTitle') }}
          </h3>
          <button
            type="button"
            class="btn"
            @click="resetColors"
            :aria-label="t('resetColors')"
          >
            {{ t('resetColors') }}
          </button>
        </div>
        <div class="flex flex-wrap gap-2 items-end">
          <ColorInput
            v-for="c in colorFields"
            :key="c.key"
            v-model="form.colors[c.key]"
            :label="t(c.label)"
          />
          <div class="flex flex-col mb-2">
            <label class="text-xs font-medium opacity-70">&nbsp;</label>
            <label class="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" v-model="transparentBg" class="checkbox" />
              <span>{{ t('transparentBg') || 'Transparent background' }}</span>
            </label>
          </div>
        </div>
      </div>
      <div class="mt-3">
        <button
          class="btn"
          :disabled="saving"
          @click="save"
          :aria-busy="saving ? 'true' : 'false'"
        >
          {{ saving ? t('commonSaving') : t('saveSettings') }}
        </button>
      </div>
    </div>
  <div class="panel-surface mt-4">
      <h3 class="widget-title">{{ t('obsIntegration') }}</h3>
      <div class="form-group">
        <label>{{ t('chatWidgetUrl') }}</label>
        <CopyField :value="widgetUrl" />
      </div>
      <div class="form-group mt-2">
      <label>{{ t('chatWidgetUrlHorizontal') || 'Chat Widget URL (Horizontal)' }}</label>
        <CopyField :value="widgetHorizontalUrl" />
      </div>
    </div>
    <ChatThemeManager />
  </section>
</template>

<script setup>
import { reactive, computed, onMounted, watch, ref } from 'vue';
import { registerDirty } from '../composables/useDirtyRegistry';
import { useI18n } from 'vue-i18n';
import api from '../services/api';
import ColorInput from './shared/ColorInput.vue';
import CopyField from './shared/CopyField.vue';
import { pushToast } from '../services/toast';
import ChatThemeManager from './ChatThemeManager.vue';

const { t } = useI18n();
const colorHeadingId = 'chat-color-heading';
const form = reactive({
  chatUrl: '',
  colors: {
    bg: '#080c10',
    msgBg: '#0a0e12',
    msgBgAlt: '#0d1114',
    border: '#161b22',
    text: '#e6edf3',
    username: '#ffffff',
    usernameBg: '#11ff79',
    donation: '#1bdf5f',
    donationBg: '#ececec',
  },
});
const transparentBg = ref(false);
const errors = reactive({ chatUrl: '' });
const CLAIM_BASE = 'wss://sockety.odysee.tv/ws/commentron?id=';
const claimPlaceholder = 'ej: 2ab34cdef...(Claim ID)';
const saving = ref(false);
const original = reactive({ snapshot: null });
const colorFields = [
  { key: 'bg', label: 'colorBg' },
  { key: 'msgBg', label: 'colorMsgBg' },
  { key: 'msgBgAlt', label: 'colorMsgAltBg' },
  { key: 'border', label: 'colorMsgBorder' },
  { key: 'text', label: 'colorMsgText' },
  { key: 'username', label: 'colorMsgUsername' },
  { key: 'usernameBg', label: 'colorMsgUsernameBg' },
  { key: 'donation', label: 'colorMsgDonation' },
  { key: 'donationBg', label: 'colorMsgDonationBg' },
];
const widgetUrl = computed(() => `${location.origin}/widgets/chat`);
const widgetHorizontalUrl = computed(() => `${location.origin}/widgets/chat.html?horizontal=1`);

function resetColors() {
  form.colors = {
    bg: '#080c10',
    msgBg: '#0a0e12',
    msgBgAlt: '#0d1114',
    border: '#161b22',
    text: '#e6edf3',
    username: '#ffffff',
    usernameBg: '#11ff79',
    donation: '#1bdf5f',
    donationBg: '#ececec',
  };
  transparentBg.value = false;
}

async function load() {
  try {
    const { data } = await api.get('/api/chat-config');
    if (data) {
      const raw = data.chatUrl || '';
      if (raw.startsWith(CLAIM_BASE)) {
        // Extract ID after base
        form.chatUrl = raw.substring(CLAIM_BASE.length);
      } else if (raw.includes('id=')) {
        form.chatUrl = raw.split('id=')[1].split('&')[0];
      } else {
        form.chatUrl = raw;
      }
      form.colors.bg = data.bgColor || form.colors.bg;
      if (form.colors.bg === 'transparent') {
        transparentBg.value = true;
      }
      form.colors.msgBg = data.msgBgColor || form.colors.msgBg;
      form.colors.msgBgAlt = data.msgBgAltColor || form.colors.msgBgAlt;
      form.colors.border = data.borderColor || form.colors.border;
      form.colors.text = data.textColor || form.colors.text;
      form.colors.username = data.usernameColor || form.colors.username;
      form.colors.usernameBg = data.usernameBgColor || form.colors.usernameBg;
      form.colors.donation = data.donationColor || form.colors.donation;
      form.colors.donationBg = data.donationBgColor || form.colors.donationBg;
      original.snapshot = JSON.stringify(form);
    }
  } catch {
    pushToast({ type: 'error', message: t('loadFailedChat') });
  }
}

async function save() {
  if (!validate()) return;
  try {
    saving.value = true;
    const claimId = extractClaimId(form.chatUrl.trim());
    const payload = {
      chatUrl: CLAIM_BASE + claimId,
  bgColor: transparentBg.value ? 'transparent' : form.colors.bg,
      msgBgColor: form.colors.msgBg,
      msgBgAltColor: form.colors.msgBgAlt,
      borderColor: form.colors.border,
      textColor: form.colors.text,
      usernameColor: form.colors.username,
      usernameBgColor: form.colors.usernameBg,
      donationColor: form.colors.donation,
  donationBgColor: form.colors.donationBg,
  // Persist currently active custom theme CSS if present
  themeCSS: localStorage.getItem('chatLiveThemeCSS') || undefined,
    };
    await api.post('/api/chat', payload);
    original.snapshot = JSON.stringify(form);
    pushToast({ type: 'success', message: t('savedChat') });
  } catch {
    pushToast({ type: 'error', message: t('saveFailedChat') });
  } finally {
    saving.value = false;
  }
}

function extractClaimId(input) {
  if (!input) return '';
  if (input.startsWith(CLAIM_BASE)) return input.substring(CLAIM_BASE.length);
  if (input.startsWith('wss://') && input.includes('id=')) return input.split('id=')[1].split('&')[0];
  return input;
}

function validate() {
  const claimId = extractClaimId(form.chatUrl.trim());
  const valid = /^[A-Za-z0-9]{5,64}$/.test(claimId);
  errors.chatUrl = claimId && !valid ? t('invalidClaimId') || 'Claim ID inválido' : '';
  return !errors.chatUrl;
}

function isChatDirty() {
  return original.snapshot && original.snapshot !== JSON.stringify(form);
}
registerDirty(isChatDirty);
watch(form, () => {}, { deep: true });
onMounted(load);
</script>
