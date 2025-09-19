<template>
  <section class="admin-tab active">
    <div class="mb-4">
      <div
        class="p-3 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] flex flex-col gap-2">
        <div class="font-semibold">{{ t('tokenTipsTitle') }}</div>
        <div class="text-sm opacity-90">{{ t('tokenTipsBody') }}</div>
      </div>
    </div>

    <OsCard class="mb-4">
      <template #header>
        <h3 class="os-card-title flex items-center gap-1.5">
          <span class="icon os-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round">
              <rect x="3" y="8" width="18" height="10" rx="2" />
              <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M12 12v2" />
            </svg>
          </span>
          {{ t('sessionTools') }}
        </h3>
      </template>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        <div class="p-3 os-subtle rounded-os-sm flex flex-col gap-2">
          <div class="os-th text-xs">
            {{ t('regeneratePublicToken') || 'Regenerate public token' }}
          </div>
          <div class="flex gap-2 items-center">
            <button
              class="px-3 py-2 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm"
              @click="regeneratePublic"
              :disabled="regenLoading || !sessionStatus.supported || !sessionStatus.active">
              {{
                regenLoading
                  ? t('commonUpdating')
                  : t('regeneratePublicToken') || 'Regenerate public token'
              }}
            </button>
            <button
              v-if="!sessionStatus.active && sessionStatus.supported"
              class="px-3 py-2 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm"
              @click="createSession"
              :disabled="regenLoading">
              {{ t('newSession') || 'New Session' }}
            </button>
            <button
              class="px-3 py-2 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm disabled:opacity-50"
              :disabled="!sessionStatus.supported || !sessionStatus.active || !lastPublicToken"
              @click="exportPublicToken">
              {{ t('exportPublicToken') || 'Export public token' }}
            </button>
          </div>
          <div v-if="lastPublicToken" class="flex gap-2 items-center">
            <input
              :value="lastPublicToken"
              readonly
              class="flex-1 px-2 py-1 rounded-os-sm bg-[var(--bg-chat)] border border-[var(--card-border)] text-xs font-mono" />
            <button
              class="px-2 py-1 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-xs"
              @click="copyToken">
              {{ t('commonCopy') || 'Copy' }}
            </button>
          </div>
          <div v-if="sessionStatus.active" class="flex flex-wrap gap-2 mt-2">
            <button
              class="px-2 py-1 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-xs"
              :disabled="revokeLoading"
              @click="revokePublic">
              {{
                revokeLoadingPublic ? t('commonLoading') : t('revokePublicToken') || 'Revoke Public'
              }}
            </button>
            <button
              class="px-2 py-1 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-xs"
              :disabled="revokeLoading"
              @click="revokeAll">
              {{ revokeLoadingAll ? t('commonLoading') : t('revokeAllSession') || 'Revoke All' }}
            </button>
            <button
              v-if="lastPublicToken"
              class="px-2 py-1 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-xs"
              @click="copyWidgetUrl">
              {{ t('copyWidgetUrl') || 'Copy Widget URL' }}
            </button>
          </div>
        </div>
        <div class="p-3 os-subtle rounded-os-sm flex flex-col gap-2">
          <div class="os-th text-xs">{{ t('exportConfig') }}</div>
          <div>
            <button
              class="px-3 py-2 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm"
              @click="exportCfg">
              {{ t('exportConfig') }}
            </button>
          </div>
        </div>
        <div class="p-3 os-subtle rounded-os-sm flex flex-col gap-2">
          <div class="os-th text-xs">{{ t('importConfig') }}</div>
          <div class="flex flex-col gap-2">
            <input
              ref="fileInputEl"
              type="file"
              accept="application/json,.json"
              @change="onImportFile"
              class="hidden"
              aria-hidden="true"
              tabindex="-1" />
            <button
              class="px-3 py-2 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm disabled:opacity-50"
              :disabled="importing"
              @click="triggerFile">
              {{ importing ? t('commonLoading') : t('importConfig') }}
            </button>
            <div
              v-if="
                importApplied.lastTip !== null ||
                importApplied.tipGoal !== null ||
                importApplied.socialmedia !== null ||
                importApplied.external !== null ||
                importApplied.liveviews !== null ||
                importApplied.announcement !== null
              "
              class="flex flex-wrap gap-2 text-xs mt-1">
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)]">
                {{ t('lastTip') }}:
                <span :class="importApplied.lastTip ? 'text-green-500' : 'text-red-500'">{{
                  importApplied.lastTip ? '✓' : '✗'
                }}</span>
              </span>
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)]">
                {{ t('tipGoal') }}:
                <span :class="importApplied.tipGoal ? 'text-green-500' : 'text-red-500'">{{
                  importApplied.tipGoal ? '✓' : '✗'
                }}</span>
              </span>
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)]">
                {{ t('socialMediaTitle') }}:
                <span :class="importApplied.socialmedia ? 'text-green-500' : 'text-red-500'">{{
                  importApplied.socialmedia ? '✓' : '✗'
                }}</span>
              </span>
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)]">
                {{ t('externalNotificationsTitle') }}:
                <span :class="importApplied.external ? 'text-green-500' : 'text-red-500'">{{
                  importApplied.external ? '✓' : '✗'
                }}</span>
              </span>
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)]">
                {{ t('liveviewsTitle') }}:
                <span :class="importApplied.liveviews ? 'text-green-500' : 'text-red-500'">{{
                  importApplied.liveviews ? '✓' : '✗'
                }}</span>
              </span>
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)]">
                {{ t('announcementTitle') }}:
                <span :class="importApplied.announcement ? 'text-green-500' : 'text-red-500'">{{
                  importApplied.announcement ? '✓' : '✗'
                }}</span>
              </span>
            </div>
          </div>
        </div>
        <div
          class="p-3 os-subtle rounded-os-sm flex flex-col gap-2"
          v-if="sessionStatus.supported && !sessionStatus.active">
          <div class="os-th text-xs">{{ t('newSession') }}</div>
          <div>
            <a
              href="/new-session"
              class="px-3 py-2 inline-block rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm">
              {{ t('newSession') }}
            </a>
          </div>
        </div>
      </div>
    </OsCard>

    <OsCard class="mb-4">
      <template #header>
        <h3 class="os-card-title flex items-center gap-1.5">
          <span class="icon os-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round">
              <path d="M4 6h16" />
              <path d="M4 10h10" />
              <path d="M4 14h16" />
              <path d="M4 18h10" />
            </svg>
          </span>
          {{ t('activityLogSettingsTitle') || 'Activity Log Settings' }}
        </h3>
      </template>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="p-3 os-subtle rounded-os-sm flex flex-col gap-2">
          <div class="os-th text-xs flex items-center justify-between gap-2">
            <span>{{ t('activityLogEnable') || 'Enable Activity Log' }}</span>
            <label
              class="checkbox-wrapper-2"
              :title="
                activity.enabled
                  ? t('commonEnabled') || 'Enabled'
                  : t('commonDisabled') || 'Disabled'
              ">
              <input type="checkbox" class="checkbox" v-model="activity.enabled" />
            </label>
          </div>
          <div class="text-[11px] opacity-70" v-if="!activity.enabled">
            {{ t('activityLogDisabledHint') || 'Disabled to reduce load.' }}
          </div>
        </div>
        <div
          class="p-3 os-subtle rounded-os-sm flex flex-col gap-2"
          :class="!activity.enabled ? 'opacity-60 pointer-events-none' : ''">
          <div class="os-th text-xs flex items-center justify-between gap-2">
            <span>{{ t('activityLogDefaultCollapsed') || 'Default collapsed' }}</span>
            <label
              class="checkbox-wrapper-2"
              :title="
                activity.collapsed
                  ? t('activityCollapsed') || 'Collapsed'
                  : t('activityExpanded') || 'Expanded'
              ">
              <input type="checkbox" class="checkbox" v-model="activity.collapsed" />
            </label>
          </div>
          <div class="text-[11px] opacity-70">
            <span v-if="activity.collapsed">{{ t('activityCollapsed') || 'Collapsed' }}</span>
            <span v-else>{{ t('activityExpanded') || 'Expanded' }}</span>
          </div>
        </div>
        <div
          class="p-3 os-subtle rounded-os-sm flex flex-col gap-2"
          :class="!activity.enabled ? 'opacity-60 pointer-events-none' : ''">
          <div class="os-th text-xs flex items-center justify-between gap-2">
            <span>{{ t('activityLogDefaultAutoScroll') || 'Default auto-scroll' }}</span>
            <label
              class="checkbox-wrapper-2"
              :title="activity.autoScrollDefault ? t('commonOn') || 'On' : t('commonOff') || 'Off'">
              <input type="checkbox" class="checkbox" v-model="activity.autoScrollDefault" />
            </label>
          </div>
          <div class="text-[11px] opacity-70">
            <span v-if="activity.autoScrollDefault">{{ t('commonOn') || 'On' }}</span>
            <span v-else>{{ t('commonOff') || 'Off' }}</span>
          </div>
        </div>
        <div
          class="p-3 os-subtle rounded-os-sm flex flex-col gap-2"
          :class="!activity.enabled ? 'opacity-60 pointer-events-none' : ''">
          <div class="os-th text-xs">{{ t('activityLogDefaultRows') || 'Default rows' }}</div>
          <select
            v-model.number="activity.limitDefault"
            class="px-2 py-1 rounded-os-sm bg-[var(--bg-chat)] border border-[var(--card-border)] text-sm w-28">
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
          </select>
        </div>
      </div>
    </OsCard>
  </section>
</template>

<script setup>
import { ref, onMounted, reactive, watch } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import OsCard from '../components/os/OsCard.vue';
import { pushToast } from '../services/toast';
import { useActivityLogPrefs } from '../stores/activityLogPrefs';

const { t } = useI18n();
const activityPrefs = useActivityLogPrefs();
const activity = reactive({
  get enabled() {
    return activityPrefs.enabled.value;
  },
  set enabled(v) {
    activityPrefs.enabled.value = !!v;
  },
  get collapsed() {
    return activityPrefs.collapsed.value;
  },
  set collapsed(v) {
    activityPrefs.collapsed.value = !!v;
  },
  get autoScrollDefault() {
    return activityPrefs.autoScrollDefault.value;
  },
  set autoScrollDefault(v) {
    activityPrefs.autoScrollDefault.value = !!v;
  },
  get limitDefault() {
    return activityPrefs.limitDefault.value;
  },
  set limitDefault(v) {
    if ([50, 100, 200].includes(Number(v))) activityPrefs.limitDefault.value = Number(v);
  },
});

const regenLoading = ref(false);
const lastPublicToken = ref('');
const sessionStatus = ref({ supported: false, active: false });
const revokeLoading = ref(false);
const revokeLoadingPublic = ref(false);
const revokeLoadingAll = ref(false);
const importing = ref(false);
const fileInputEl = ref(null);
const importApplied = ref({
  lastTip: null,
  tipGoal: null,
  socialmedia: null,
  external: null,
  liveviews: null,
  announcement: null,
});
let importAppliedTimer = null;

async function load() {
  try {
    const ss = await axios.get('/api/session/status');
    sessionStatus.value = {
      supported: !!ss?.data?.supported,
      active: !!ss?.data?.active,
    };
  } catch {}

  try {
    if (sessionStatus.value.supported && sessionStatus.value.active) {
      const pt = await axios.get('/api/session/public-token');
      if (pt?.data?.publicToken) lastPublicToken.value = pt.data.publicToken;
    }
  } catch {}
}

onMounted(() => {
  load();
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {}
  try {
    const KEY = 'getty_settings_tip_shown_v1';
    if (localStorage.getItem(KEY) !== '1') {
      pushToast({ i18nKey: 'tokenTipsTitle', type: 'info', timeout: 4000 });
      localStorage.setItem(KEY, '1');
    }
  } catch {}
});

watch(
  () => activity.enabled,
  (v, old) => {
    try {
      if (old === undefined) return;
      pushToast({
        i18nKey: v ? 'activityLogEnabledToast' : 'activityLogDisabledToast',
        type: v ? 'success' : 'info',
        timeout: 2500,
      });
    } catch {}
  }
);

async function regeneratePublic() {
  try {
    if (!sessionStatus.value.active && sessionStatus.value.supported) {
      try {
        regenLoading.value = true;
        const create = await axios.get('/api/session/new?json=1');
        if (create?.data?.publicToken) {
          lastPublicToken.value = create.data.publicToken;
          sessionStatus.value.active = true;
          pushToast({
            message: t('tokenRegenerated') || 'Session initialized',
            type: 'success',
            timeout: 2000,
            autoTranslate: false,
          });
        }
      } catch {
      } finally {
        regenLoading.value = false;
      }
    }
    regenLoading.value = true;
    const r = await axios.post('/api/session/regenerate-public');
    const tok = r?.data?.publicToken;
    if (tok) {
      lastPublicToken.value = tok;
    }
    pushToast({ i18nKey: 'tokenRegenerated', type: 'success', timeout: 2500 });
  } catch (e) {
    const code = e?.response?.data?.error;
    if (code === 'no_admin_session') {
      try {
        const create = await axios.get('/api/session/new?json=1');
        const tok1 = create?.data?.publicToken;
        if (tok1) {
          lastPublicToken.value = tok1;
          sessionStatus.value.active = true;

          const second = await axios.post('/api/session/regenerate-public');
          const tok2 = second?.data?.publicToken;
          if (tok2) lastPublicToken.value = tok2;
          pushToast({ i18nKey: 'tokenRegenerated', type: 'success', timeout: 2500 });
          return;
        }
      } catch (inner) {
        const msgInner = inner?.response?.data?.error || 'session_init_failed';
        pushToast({ message: msgInner, type: 'error', timeout: 3200, autoTranslate: false });
        return;
      }
    }
    const msg = code || 'Failed';
    pushToast({ message: msg, type: 'error', timeout: 3000, autoTranslate: false });
  } finally {
    regenLoading.value = false;
  }
}

function createSession() {
  try {
    window.location.href = '/api/session/new';
  } catch {}
}

async function copyToken() {
  try {
    await navigator.clipboard.writeText(lastPublicToken.value || '');
    pushToast({ i18nKey: 'urlCopied', type: 'success', timeout: 2000 });
  } catch {}
}

function exportPublicToken() {
  try {
    if (!lastPublicToken.value) return;
    const payload = {
      publicToken: lastPublicToken.value,
      origin: window.location.origin,
      createdAt: new Date().toISOString(),
      note: 'Public token for getty session. Do not share the admin token.',
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `getty-public-token-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  } catch {}
}

function exportCfg() {
  try {
    window.location.href = '/api/session/export';
  } catch {}
}

async function revokePublic() {
  if (revokeLoading.value) return;
  try {
    revokeLoading.value = true;
    revokeLoadingPublic.value = true;
    await axios.post('/api/session/revoke', { scope: 'public' });
    lastPublicToken.value = '';
    await load();
    pushToast({
      message: t('revokePublicTokenDone') || 'Public token revoked',
      type: 'success',
      timeout: 2500,
      autoTranslate: false,
    });
  } catch (e) {
    const msg = e?.response?.data?.error || 'Failed';
    pushToast({ message: msg, type: 'error', timeout: 3000, autoTranslate: false });
  } finally {
    revokeLoading.value = false;
    revokeLoadingPublic.value = false;
  }
}

async function revokeAll() {
  if (revokeLoading.value) return;
  try {
    revokeLoading.value = true;
    revokeLoadingAll.value = true;
    await axios.post('/api/session/revoke', { scope: 'all' });
    lastPublicToken.value = '';
    sessionStatus.value.active = false;
    pushToast({
      message: t('revokeAllSessionDone') || 'Session revoked',
      type: 'success',
      timeout: 2500,
      autoTranslate: false,
    });
  } catch (e) {
    const msg = e?.response?.data?.error || 'Failed';
    pushToast({ message: msg, type: 'error', timeout: 3000, autoTranslate: false });
  } finally {
    revokeLoading.value = false;
    revokeLoadingAll.value = false;
  }
}

function copyWidgetUrl() {
  try {
    if (!lastPublicToken.value) return;
    const base = window.location.origin;
    const url = `${base}/widgets/chat?token=${encodeURIComponent(lastPublicToken.value)}`;
    navigator.clipboard.writeText(url);
    pushToast({
      message: t('urlCopied') || 'Copied',
      type: 'success',
      timeout: 2000,
      autoTranslate: false,
    });
  } catch {}
}

function triggerFile() {
  try {
    if (!fileInputEl.value) {
      const inputs = document.querySelectorAll('input[type="file"][accept*="json"]');
      if (inputs && inputs[0]) inputs[0].click();
    } else {
      fileInputEl.value.click();
    }
  } catch {}
}

async function onImportFile(e) {
  try {
    const file = e?.target?.files?.[0];
    if (!file) return;
    importing.value = true;
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (!data || typeof data !== 'object') {
      pushToast({ message: 'Invalid JSON', type: 'error', timeout: 2500, autoTranslate: false });
      return;
    }
    const r = await axios.post('/api/session/import', data);
    if (r?.data?.ok) {
      const restored = r?.data?.restored || {};
      importApplied.value = {
        lastTip: typeof restored.lastTip === 'boolean' ? restored.lastTip : null,
        tipGoal: typeof restored.tipGoal === 'boolean' ? restored.tipGoal : null,
        socialmedia: typeof restored.socialmedia === 'boolean' ? restored.socialmedia : null,
        external: typeof restored.external === 'boolean' ? restored.external : null,
        liveviews: typeof restored.liveviews === 'boolean' ? restored.liveviews : null,
        announcement: typeof restored.announcement === 'boolean' ? restored.announcement : null,
      };
      pushToast({ message: t('importedOk'), type: 'success', timeout: 2500, autoTranslate: false });
      load();

      try {
        if (importAppliedTimer) clearTimeout(importAppliedTimer);
        importAppliedTimer = setTimeout(() => {
          importApplied.value = {
            lastTip: null,
            tipGoal: null,
            socialmedia: null,
            external: null,
            liveviews: null,
            announcement: null,
          };
          importAppliedTimer = null;
        }, 6000);
      } catch {}
    } else {
      pushToast({ message: 'Import failed', type: 'error', timeout: 2500, autoTranslate: false });
    }
  } catch (err) {
    const msg = err?.response?.data?.error || 'Import failed';
    pushToast({ message: msg, type: 'error', timeout: 3000, autoTranslate: false });
  } finally {
    importing.value = false;
    try {
      e.target.value = '';
    } catch {}
  }
}
</script>

<style scoped></style>
