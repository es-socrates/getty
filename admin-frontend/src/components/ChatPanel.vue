<template>
  <section class="admin-tab active" role="form">
    <OsCard class="mb-4" aria-describedby="chat-desc">
      <p id="chat-desc" class="sr-only">Chat configuration including chat source and colors.</p>
      <div class="form-group" aria-labelledby="chat-url-label" aria-live="polite">
        <label class="label" id="chat-url-label" for="chat-url">{{ t('chatClaimId') || 'Claim ID' }}</label>
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
      <div class="mt-3" :aria-labelledby="colorHeadingId">
        <div class="flex justify-between items-center mb-2">
          <h3 class="os-card-title mb-0" :id="colorHeadingId">{{ t('colorCustomizationTitle') }}</h3>
          <button type="button" class="btn" @click="resetColors" :aria-label="t('resetColors')">{{ t('resetColors') }}</button>
        </div>

        <div class="os-surface p-3 rounded-os border border-[var(--card-border)] bg-[var(--bg-card)] mb-3" aria-labelledby="general-colors-heading">
          <h4 id="general-colors-heading" class="text-xs font-semibold uppercase tracking-wide mb-2">{{ t('generalColors') || 'General' }}</h4>
          <div class="flex flex-wrap gap-2 items-end">
            <ColorInput v-model="form.colors.bg" :label="t('colorBg')" />
            <ColorInput v-model="form.colors.msgBg" :label="t('colorMsgBg')" />
            <ColorInput v-model="form.colors.msgBgAlt" :label="t('colorMsgAltBg')" />
            <ColorInput v-model="form.colors.border" :label="t('colorMsgBorder')" />
            <ColorInput v-model="form.colors.text" :label="t('colorMsgText')" />
            <div class="flex flex-col mb-2">
              <label class="text-xs font-medium opacity-70">&nbsp;</label>
              <label class="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" v-model="transparentBg" class="checkbox" />
                <span>{{ t('transparentBg') || 'Transparent background' }}</span>
              </label>
            </div>
          </div>
        </div>

        <div class="os-surface p-3 rounded-os border border-[var(--card-border)] bg-[var(--bg-card)] mb-3" aria-labelledby="username-colors-heading">
          <div class="flex items-center justify-between mb-2">
            <h4 id="username-colors-heading" class="text-xs font-semibold uppercase tracking-wide">{{ t('usernameColors') || 'Username' }}</h4>
            <label class="inline-flex items-center gap-2 text-sm cursor-pointer select-none" :title="t('toggleUsernameOverride') || 'Override username colors (otherwise the palette is used)'" :aria-describedby="'username-hint'">
              <input type="checkbox" v-model="overrideUsername" class="checkbox" />
              <span>{{ t('overrideUsername') || 'Override username colors' }}</span>
            </label>
          </div>
          <div v-if="overrideUsername" class="flex flex-wrap gap-2 items-end">
            <ColorInput v-model="form.colors.username" :label="t('colorMsgUsername')" />
            <ColorInput v-model="form.colors.usernameBg" :label="t('colorMsgUsernameBg')" />
            <small class="opacity-70 text-xs">{{ t('usernameOverrideOn') || 'These colors will replace the per-user palette.' }}</small>
          </div>
          <div v-else>
            <small id="username-hint" class="opacity-70 text-xs">{{ t('usernameOverrideOff') || 'Using CYBERPUNK_PALETTE — each user gets a different color.' }}</small>
          </div>
        </div>

        <div class="os-surface p-3 rounded-os border border-[var(--card-border)] bg-[var(--bg-card)]" aria-labelledby="donation-colors-heading">
          <h4 id="donation-colors-heading" class="text-xs font-semibold uppercase tracking-wide mb-2">{{ t('donationColors') || 'Donations' }}</h4>
          <div class="flex flex-wrap gap-2 items-end">
            <ColorInput v-model="form.colors.donation" :label="t('colorMsgDonation')" />
            <ColorInput v-model="form.colors.donationBg" :label="t('colorMsgDonationBg')" />
          </div>
        </div>
      </div>
      <div class="mt-3">
        <div class="flex items-center gap-2 mb-2" aria-live="polite">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs">
            <span :style="`width:8px;height:8px;border-radius:9999px;display:inline-block;background:${connected ? '#22c55e' : '#ef4444'}`"></span>
            <span>{{ connected ? t('connected') || 'Connected' : t('disconnected') || 'Disconnected' }}</span>
          </span>
          <small class="opacity-70">{{ lastStatusAt ? new Date(lastStatusAt).toLocaleTimeString() : '' }}</small>
        </div>
        <button
          class="btn"
          :disabled="saving"
          @click="save"
          :aria-busy="saving ? 'true' : 'false'"
        >
          {{ saving ? t('commonSaving') : t('saveSettings') }}
        </button>
      </div>
    </OsCard>
    <OsCard class="mt-4" :title="t('obsIntegration')">
      <div class="form-group">
        <label>{{ t('chatWidgetUrl') }}</label>
        <CopyField :value="widgetUrl" />
      </div>
      <div class="form-group mt-2">
        <label>{{ t('chatWidgetUrlHorizontal') || 'Chat Widget URL (Horizontal)' }}</label>
        <CopyField :value="widgetHorizontalUrl" />
      </div>
    </OsCard>
    <ChatThemeManager />
  </section>
</template>

<script setup>
import { reactive, computed, onMounted, onUnmounted, watch, ref } from 'vue';
import { registerDirty } from '../composables/useDirtyRegistry';
import { useI18n } from 'vue-i18n';
import api from '../services/api';
import ColorInput from './shared/ColorInput.vue';
import CopyField from './shared/CopyField.vue';
import { pushToast } from '../services/toast';
import ChatThemeManager from './ChatThemeManager.vue';
import OsCard from './os/OsCard.vue';

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
const overrideUsername = ref(false);
const clearedThemeCSS = ref(false);
const errors = reactive({ chatUrl: '' });
const CLAIM_BASE = 'wss://sockety.odysee.tv/ws/commentron?id=';
const claimPlaceholder = 'ej: 9e28103c613048b4a40...';
const saving = ref(false);
const connected = ref(false);
const lastStatusAt = ref(0);
const original = reactive({ snapshot: null });

const publicToken = ref('');
const widgetUrl = computed(() => `${location.origin}/widgets/chat${publicToken.value ? `?token=${encodeURIComponent(publicToken.value)}` : ''}`);
const widgetHorizontalUrl = computed(() => `${location.origin}/widgets/chat?horizontal=1${publicToken.value ? `&token=${encodeURIComponent(publicToken.value)}` : ''}`);

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
  overrideUsername.value = false;

  try { localStorage.removeItem('chatLiveThemeCSS'); } catch {}
  clearedThemeCSS.value = true;
}

async function load() {
  try {
    const { data } = await api.get('/api/chat-config');
    if (data) {
      const raw = data.chatUrl || '';
      let extracted = '';
      if (raw.startsWith(CLAIM_BASE)) {
        extracted = raw.substring(CLAIM_BASE.length);
      } else if (raw.includes('id=')) {
        extracted = raw.split('id=')[1].split('&')[0];
      } else {
        extracted = raw;
      }

      const isUnset = !extracted || extracted === '...' || extracted === '/' || extracted === '#';
      form.chatUrl = isUnset ? '' : extracted;
      form.colors.bg = data.bgColor || form.colors.bg;
      if (form.colors.bg === 'transparent') {
        transparentBg.value = true;
      }
      form.colors.msgBg = data.msgBgColor || form.colors.msgBg;
      form.colors.msgBgAlt = data.msgBgAltColor || form.colors.msgBgAlt;
      form.colors.border = data.borderColor || form.colors.border;
      form.colors.text = data.textColor || form.colors.text;

      if (typeof data.usernameColor === 'string' && data.usernameColor) {
        form.colors.username = data.usernameColor;
        overrideUsername.value = true;
      }
      if (typeof data.usernameBgColor === 'string' && data.usernameBgColor) {
        form.colors.usernameBg = data.usernameBgColor;
        overrideUsername.value = true;
      }
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
      usernameColor: overrideUsername.value ? form.colors.username : '',
      usernameBgColor: overrideUsername.value ? form.colors.usernameBg : '',
      donationColor: form.colors.donation,
      donationBgColor: form.colors.donationBg,
      themeCSS: clearedThemeCSS.value ? '' : (localStorage.getItem('chatLiveThemeCSS') || undefined),
    };
    await api.post('/api/chat', payload);
    original.snapshot = JSON.stringify(form);
    pushToast({ type: 'success', message: t('savedChat') });
  } catch {
    pushToast({ type: 'error', message: t('saveFailedChat') });
  } finally {
    saving.value = false;
    clearedThemeCSS.value = false;
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
  errors.chatUrl = claimId && !valid ? t('invalidClaimId') || 'Invalid Claim ID' : '';
  return !errors.chatUrl;
}

function isChatDirty() {
  return original.snapshot && original.snapshot !== JSON.stringify(form);
}
registerDirty(isChatDirty);
watch(form, () => {}, { deep: true });
onMounted(load);

async function pollStatus() {
  try {
    const { data } = await api.get('/api/chat/status');
    connected.value = !!data?.connected;
    lastStatusAt.value = Date.now();
  } catch {}
}

onMounted(() => {
  fetch('/api/session/public-token').then(r => r.ok ? r.json() : null).then(j => {
    if (j && typeof j.publicToken === 'string') publicToken.value = j.publicToken;
  }).catch(() => {});
  pollStatus();
  const id = setInterval(pollStatus, 5000);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pollStatus();
  });

  try {
    onUnmounted(() => clearInterval(id));
  } catch {}
});
</script>
