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
          <div class="os-th text-xs">{{ t('regeneratePublicToken') }}</div>
          <div class="flex gap-2 items-center">
            <button
              class="px-3 py-2 rounded-os-sm border border-[var(--card-border)] hover:bg-[var(--bg-chat)] text-sm"
              @click="regeneratePublic"
              :disabled="regenLoading || !sessionStatus.supported || !sessionStatus.active">
              {{ regenLoading ? t('commonUpdating') : t('regeneratePublicToken') }}
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
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import OsCard from '../components/os/OsCard.vue';
import { pushToast } from '../services/toast';

const { t } = useI18n();

const regenLoading = ref(false);
const lastPublicToken = ref('');
const sessionStatus = ref({ supported: false, active: false });
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

async function regeneratePublic() {
  try {
    regenLoading.value = true;
    const r = await axios.post('/api/session/regenerate-public');
    const tok = r?.data?.publicToken;
    if (tok) {
      lastPublicToken.value = tok;
    }
    pushToast({ i18nKey: 'tokenRegenerated', type: 'success', timeout: 2500 });
  } catch (e) {
    const msg = e?.response?.data?.error || 'Failed';
    pushToast({ message: msg, type: 'error', timeout: 3000, autoTranslate: false });
  } finally {
    regenLoading.value = false;
  }
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
