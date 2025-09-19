<template>
  <section class="relative" role="form">
    <div
      v-if="masked"
      class="absolute inset-0 z-10 flex items-center justify-center backdrop-blur bg-black/35">
      <div
        class="p-5 rounded-os bg-[var(--bg-card)] border border-[var(--card-border)] shadow-lg max-w-md text-center">
        <div class="mb-2 text-lg font-semibold">{{ t('externalSessionRequiredTitle') }}</div>
        <p class="mb-4 text-sm">{{ t('externalSessionRequiredBody') }}</p>
        <a href="/new-session" class="btn">{{ t('createSession') }}</a>
      </div>
    </div>
    <OsCard>
      <h3 class="mb-2 font-semibold">{{ t('liveAnnouncementDiscordTitle') }}</h3>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label">Title</label>
          <input class="input" v-model="form.title" :maxlength="150" />
          <small class="small">{{ form.title.length }}/150</small>

          <label class="label mt-3">Description</label>
          <textarea class="input desc-fixed" v-model="form.description" :maxlength="200" />
          <div class="mt-1 flex gap-2 items-center flex-wrap">
            <small class="small">{{ form.description.length }}/200</small>
            <select class="input max-w-[260px]" :value="''" @change="onPreset($event)">
              <option value="" disabled>{{ t('livePresetPick') }}</option>
              <option :value="t('livePresetLiveOnOdysee')">
                {{ t('livePresetLiveOnOdysee') }}
              </option>
              <option :value="t('livePresetJoinNow')">{{ t('livePresetJoinNow') }}</option>
              <option :value="t('livePresetNewStream')">{{ t('livePresetNewStream') }}</option>
            </select>
          </div>

          <label class="label mt-3">Channel URL</label>
          <input class="input" v-model="form.channelUrl" placeholder="https://odysee.com/@your" />
          <small v-if="errors.channelUrl" class="small text-red-700">{{ errors.channelUrl }}</small>

          <div class="mt-3 grid grid-cols-1 gap-2">
            <div>
              <label class="label">{{ t('liveClaimIdLabel') }}</label>
              <div class="flex gap-2 items-center">
                <input class="input" v-model="form.livePostClaimId" placeholder="b6f0a7..." />
                <button
                  type="button"
                  class="btn"
                  :disabled="!form.livePostClaimId || resolving"
                  @click="resolveFromClaimId">
                  {{ resolving ? t('resolving') : t('liveClaimIdFill') }}
                </button>
              </div>
              <small
                class="small"
                :class="claimMatchState === 'mismatch' ? 'text-red-700' : 'opacity-80'">
                <template v-if="!form.channelUrl && form.livePostClaimId">{{
                  t('liveClaimIdNoUrlHint')
                }}</template>
                <template
                  v-else-if="form.channelUrl && form.livePostClaimId && claimMatchState === 'match'"
                  >{{ t('liveClaimIdMatch') }}</template
                >
                <template
                  v-else-if="
                    form.channelUrl && form.livePostClaimId && claimMatchState === 'mismatch'
                  "
                  >{{ t('liveClaimIdMismatch') }}</template
                >
                <template v-else>{{ t('liveClaimIdHelp') }}</template>
              </small>
            </div>
          </div>

          <label class="label mt-3">Signature</label>
          <input class="input" v-model="form.signature" :maxlength="24" placeholder="@streamer" />
          <small class="small">{{ form.signature.length }}/24</small>

          <label class="label mt-3">Discord Webhook URL (override)</label>
          <div class="input-group">
            <input
              class="input"
              :type="reveal.discord ? 'text' : 'password'"
              v-model="form.discordWebhook"
              placeholder="https://discord.com/api/webhooks/..."
              autocomplete="off" />
            <button
              type="button"
              @click="reveal.discord = !reveal.discord"
              :aria-pressed="reveal.discord ? 'true' : 'false'"
              :aria-label="reveal.discord ? 'Hide' : 'Show'">
              <svg
                v-if="!reveal.discord"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="#fff"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="#fff"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round">
                <path
                  d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94" />
                <path d="M1 1l22 22" />
                <path d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 3-3 3 3 0 0 0-.24-1.17" />
              </svg>
            </button>
          </div>
          <small class="small">{{ t('liveDiscordOverrideHint') }}</small>

          <div class="mt-3 flex items-center gap-3 flex-wrap">
            <div class="inline-flex items-center gap-2">
              <button
                type="button"
                class="switch"
                :aria-pressed="String(form.auto)"
                :title="t('liveAutoPrereqClaimId')"
                @click="form.auto = !form.auto">
                <span class="knob"></span>
              </button>
              <span class="small">{{ t('liveAutoSendOnLive') }}</span>
            </div>
          </div>
          <div class="mt-2">
            <Alert>
              <Rocket class="h-5 w-5 alert-icon" />
              <div class="flex-1">
                <AlertTitle class="mb-0.5">{{ t('liveAutoAlertTitle') }}</AlertTitle>
                <AlertDescription>{{ t('liveAutoPrereqClaimId') }}</AlertDescription>
              </div>
            </Alert>
          </div>

          <div class="mt-2 small" :class="targets.length ? 'opacity-80' : 'text-red-700'">
            <template v-if="targets.length">
              {{ t('liveTargetsLabel') }} {{ targets.join(', ') }}
            </template>
            <template v-else>
              {{ t('liveTargetsNone') }}
            </template>
          </div>

          <div class="mt-3 flex gap-2 flex-wrap">
            <button class="btn" :disabled="sending || hasErrors" @click="send">
              {{ sending ? t('commonSending') : t('commonSend') }}
            </button>
            <button class="btn" @click="genPreview">{{ t('commonPreview') }}</button>
            <button class="btn" @click="testSend">{{ t('liveTestSendNow') }}</button>
            <button class="btn" @click="saveServerDraft" :disabled="saving">
              {{ saving ? t('commonSaving') : t('commonSaveDraft') }}
            </button>
            <button class="btn" @click="loadServerDraft">{{ t('commonLoadDraft') }}</button>
          </div>
        </div>

        <div>
          <div class="label">Post Preview</div>
          <div class="p-3 border rounded-os bg-[var(--bg-card)] text-[var(--text-primary)]">
            <div class="text-lg font-semibold">{{ form.title || 'We are live on Odysee! 🎬' }}</div>
            <div class="mt-1">{{ form.description }}</div>
            <div
              v-if="previewLoading"
              class="mt-2 flex items-center justify-center h-[120px] opacity-90">
              <div class="odysee-spinner" aria-label="loading preview" title="loading">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 103.3 103.3"
                  width="36"
                  height="36">
                  <defs>
                    <linearGradient
                      id="lg"
                      x1="37.9"
                      x2="110.84"
                      y1="5.54"
                      y2="180.15"
                      gradientTransform="translate(-9 -8.35)"
                      gradientUnits="userSpaceOnUse">
                      <stop offset="0" stop-color="#ef1970" />
                      <stop offset=".14" stop-color="#f23b5c" />
                      <stop offset=".44" stop-color="#f77d35" />
                      <stop offset=".7" stop-color="#fcad18" />
                      <stop offset=".89" stop-color="#fecb07" />
                      <stop offset="1" stop-color="#ffd600" />
                    </linearGradient>
                  </defs>
                  <circle cx="51.65" cy="51.65" r="51.65" fill="url(#lg)" />
                </svg>
              </div>
            </div>
            <div v-else-if="previewImage" class="mt-2">
              <img
                :src="previewImage"
                alt="preview"
                class="max-w-full max-h-[300px] rounded object-cover" />
            </div>
            <div v-else class="mt-2 small opacity-70">No preview image</div>
            <div v-if="form.channelUrl" class="mt-2 small opacity-80">{{ form.channelUrl }}</div>
            <div v-if="form.signature" class="mt-2 small opacity-60">{{ form.signature }}</div>
          </div>
        </div>
      </div>
    </OsCard>
  </section>
</template>
<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { Rocket } from 'lucide-vue-next';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import api from '../services/api';
import { useI18n } from 'vue-i18n';
import OsCard from './os/OsCard.vue';
import { usePublicToken } from '../composables/usePublicToken';
import { pushToast } from '../services/toast';
const { t } = useI18n();
const pt = usePublicToken();

const DRAFT_KEY = 'live_announcement_draft_v1';
const masked = ref(false);
const reveal = reactive({ discord: false });
const form = ref({
  title: '',
  description: '',
  channelUrl: '',
  signature: '',
  discordWebhook: '',
  auto: false,
  livePostClaimId: '',
});
const errors = ref({ channelUrl: '' });
const sending = ref(false);
const saving = ref(false);
const previewImage = ref('');
const previewLoading = ref(false);
const resolving = ref(false);
const hasErrors = computed(() => !!errors.value.channelUrl || claimMatchState.value === 'mismatch');
const liveTargets = ref({ discord: false, telegram: false });
const targets = computed(() => {
  const list = [];
  if (liveTargets.value.discord) list.push(t('discord'));
  if (!liveTargets.value.discord && form.value.discordWebhook)
    list.push(t('liveTargetDiscordOverride'));
  if (liveTargets.value.telegram) list.push(t('telegram'));
  return list;
});

function isHttpUrl(u) {
  try {
    const v = new URL(u);
    return v.protocol === 'http:' || v.protocol === 'https:';
  } catch {
    return false;
  }
}
function validate() {
  errors.value.channelUrl =
    form.value.channelUrl && !isHttpUrl(form.value.channelUrl) ? t('invalidUrl') : '';
  if (form.value.discordWebhook && !isHttpUrl(form.value.discordWebhook)) {
    // simple client-side check; backend will validate URL
  }
}

const claimMatchState = ref('unknown');
function extractClaimIdFromUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/i.test(u.protocol)) return '';
    if (!/^(www\.)?odysee\.com$/i.test(u.hostname)) return '';
    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const m = last.match(/:([a-z0-9]+)/i);
    return m && m[1] ? m[1] : '';
  } catch {
    return '';
  }
}
watch(
  () => [form.value.channelUrl, form.value.livePostClaimId],
  ([url, id]) => {
    try {
      const a = (id || '').toLowerCase();
      const b = extractClaimIdFromUrl(url || '').toLowerCase();
      if (!a || !b) {
        claimMatchState.value = 'unknown';
        return;
      }
      claimMatchState.value = a.startsWith(b) || b.startsWith(a) ? 'match' : 'mismatch';
    } catch {
      claimMatchState.value = 'unknown';
    }
  }
);

async function genPreview() {
  previewImage.value = '';
  previewLoading.value = true;
  if (form.value.channelUrl) {
    try {
      const r = await api.get(pt.withToken('/api/external-notifications/live/og'), {
        params: { url: form.value.channelUrl },
      });
      if (r.data && r.data.imageUrl) {
        previewImage.value = r.data.imageUrl;
        pushToast({ type: 'success', message: 'Draft loaded' });
      } else {
        pushToast({ type: 'info', message: 'No preview available' });
      }
    } catch {
      pushToast({ type: 'error', message: 'Failed to generate preview' });
    } finally {
      previewLoading.value = false;
    }
  } else {
    previewLoading.value = false;
  }
}

async function send() {
  validate();
  if (errors.value.channelUrl) return;
  if (masked.value) {
    pushToast({ type: 'info', message: 'Session required to send' });
    return;
  }
  try {
    sending.value = true;
    const f = { ...form.value };
    const payload = {
      title: (f.title || '').trim() || undefined,
      description: (f.description || '').trim() || undefined,
      channelUrl: (f.channelUrl || '').trim() || undefined,
      signature: (f.signature || '').trim() || undefined,
      discordWebhook: (f.discordWebhook || '').trim() || undefined,
      livePostClaimId: (f.livePostClaimId || '').trim() || undefined,
    };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined) delete payload[k];
    });
    const r = await api.post(pt.withToken('/api/external-notifications/live/send'), payload);
    if (r.data && r.data.success) {
      pushToast({ type: 'success', message: 'Announcement sent' });
    } else {
      const msg = r.data?.error ? mapError(r.data.error) : 'Error sending announcement';
      pushToast({ type: 'error', message: msg });
    }
  } finally {
    sending.value = false;
  }
}

async function testSend() {
  validate();
  if (errors.value.channelUrl) return;
  if (masked.value) {
    pushToast({ type: 'info', message: 'Session required to send' });
    return;
  }
  try {
    sending.value = true;
    const f = { ...form.value };
    const payload = {
      title: (f.title || '').trim() || undefined,
      description: (f.description || '').trim() || undefined,
      channelUrl: (f.channelUrl || '').trim() || undefined,
      signature: (f.signature || '').trim() || undefined,
      discordWebhook: (f.discordWebhook || '').trim() || undefined,
      livePostClaimId: (f.livePostClaimId || '').trim() || undefined,
    };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined) delete payload[k];
    });
    const r = await api.post(pt.withToken('/api/external-notifications/live/test'), payload);
    if (r.data && r.data.success) {
      pushToast({ type: 'success', message: 'Sent (test)' });
    } else {
      const msg = r.data?.error ? mapError(r.data.error) : 'Error sending test';
      pushToast({ type: 'error', message: msg });
    }
  } finally {
    sending.value = false;
  }
}

function mapError(code) {
  if (code === 'invalid_payload') return 'Invalid data';
  if (code === 'claim_mismatch') return 'ClaimID does not match URL';
  if (code === 'no_live_channels_configured') return 'Configure a channel (or use the override)';
  if (code === 'session_required') return 'Session required';
  if (code === 'send_failed') return 'Failed to send (check Discord Webhook and connection)';
  return 'Error sending announcement';
}

function saveDraft() {
  try {
    const { title, description, channelUrl, signature } = form.value;
    const draft = { title, description, channelUrl, signature };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {}
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d && typeof d === 'object') {
      form.value.title = d.title || '';
      form.value.description = d.description || '';
      form.value.channelUrl = d.channelUrl || '';
      form.value.signature = d.signature || '';
    }
  } catch {}
}

async function loadMask() {
  try {
    const r = await api.get('/api/modules');
    masked.value = !!r?.data?.masked;
  } catch {
    masked.value = false;
  }
}

async function loadTargets() {
  try {
    const r = await api.get('/api/external-notifications');
    const c = r?.data?.config || {};
    liveTargets.value.discord = !!c.hasLiveDiscord;
    liveTargets.value.telegram = !!c.hasLiveTelegram;
  } catch {}
}

watch(form, saveDraft, { deep: true });

onMounted(async () => {
  await pt.refresh();
  await loadMask();
  await loadTargets();
  loadDraft();
});

async function saveServerDraft() {
  try {
    saving.value = true;
    const f = { ...form.value };
    const payload = {
      title: (f.title || '').trim() || undefined,
      description: (f.description || '').trim() || undefined,
      channelUrl: (f.channelUrl || '').trim() || undefined,
      signature: (f.signature || '').trim() || undefined,
      discordWebhook: (f.discordWebhook || '').trim() || undefined,
      auto: !!f.auto,
      livePostClaimId: (f.livePostClaimId || '').trim() || undefined,
    };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined) delete payload[k];
    });
    const r = await api.post(pt.withToken('/api/external-notifications/live/config'), payload);
    if (r.data?.success) pushToast({ type: 'success', message: 'Draft saved' });
    else pushToast({ type: 'error', message: 'Failed to save draft' });
  } catch {
    pushToast({ type: 'error', message: 'Failed to save draft' });
  } finally {
    saving.value = false;
  }
}

async function loadServerDraft() {
  try {
    const r = await api.get(pt.withToken('/api/external-notifications/live/config'));
    const c = r.data?.config || {};
    form.value.title = c.title || '';
    form.value.description = c.description || '';
    form.value.channelUrl = c.channelUrl || '';
    form.value.signature = c.signature || '';

    if (c.discordWebhook) form.value.discordWebhook = c.discordWebhook;
    form.value.auto = !!c.auto;
    form.value.livePostClaimId = c.livePostClaimId || '';
    pushToast({ type: 'success', message: 'Draft loaded' });
  } catch {
    pushToast({ type: 'error', message: 'Failed to load draft' });
  }
}

function onPreset(e) {
  try {
    const val = e?.target?.value || '';
    if (!val) return;
    form.value.description = val;
    e.target.value = '';
  } catch {}
}

async function resolveFromClaimId() {
  const claimId = (form.value.livePostClaimId || '').trim();
  if (!claimId) return;
  try {
    resolving.value = true;
    const r = await api.get(pt.withToken('/api/external-notifications/live/resolve'), {
      params: { claimId },
    });
    const ok = !!r?.data?.ok;
    const url = r?.data?.url || '';
    if (ok && url) {
      form.value.channelUrl = url;
      pushToast({ type: 'success', message: t('liveClaimIdResolveOk') });
      // Optionally refresh preview silently
      try {
        await genPreview();
      } catch {}
    } else {
      pushToast({ type: 'error', message: t('liveClaimIdResolveFail') });
    }
  } catch {
    pushToast({ type: 'error', message: t('liveClaimIdResolveFail') });
  } finally {
    resolving.value = false;
  }
}
</script>

<style scoped>
.label {
  display: block;
  margin-bottom: 4px;
  font-weight: 600;
}
.input {
  width: 100%;
}
.btn {
  white-space: nowrap;
}
.desc-fixed {
  width: 100%;
  max-width: 500px;
  height: 100px;
  resize: none;
}
.switch {
  width: 38px;
  height: 22px;
  background: var(--card-border);
  border-radius: 9999px;
  position: relative;
  transition: background 0.2s ease;
  display: inline-flex;
  align-items: center;
}
.switch .knob {
  position: absolute;
  left: 2px;
  top: 1px;
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 9999px;
  transition: transform 0.2s ease;
}
.switch[aria-pressed='true'] {
  background: #553fee;
}
.switch[aria-pressed='true'] .knob {
  transform: translateX(16px);
}

.odysee-spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
