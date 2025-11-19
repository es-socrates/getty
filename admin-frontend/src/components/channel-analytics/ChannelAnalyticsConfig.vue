<template>
  <section class="config-card">
    <header class="config-header">
      <div>
        <p class="eyebrow">{{ t('channelConfigTitle') }}</p>
        <p class="muted">{{ t('channelConfigDescription') }}</p>
      </div>
      <div class="config-header-meta">
        <div class="channel-card" v-if="channelIdentity">
          <div class="channel-card-head">
            <p class="channel-card-label">{{ t('channelIdentityPreviewLabel') }}</p>
          </div>
          <div class="channel-card-body with-status">
            <div class="channel-card-main">
              <div class="channel-avatar">
                <img
                  v-if="channelIdentity.thumbnailUrl"
                  :src="channelIdentity.thumbnailUrl"
                  :alt="channelIdentityAlt"
                  loading="lazy" />
                <span v-else>{{ channelInitial }}</span>
              </div>
              <div class="channel-card-text">
                <p class="channel-card-name">
                  {{ channelNamePreview }}
                </p>
                <p class="channel-card-handle">
                  {{ channelHandlePreview }}
                </p>
              </div>
            </div>
            <div class="status-pill" :class="secretReady ? 'ok' : 'warn'">
              <span v-if="secretReady" class="status-pill-icon" aria-hidden="true">
                <i class="pi pi-verified"></i>
              </span>
              <span>
                {{ secretReady ? 'Configured' : t('channelSecretMissing') }}
              </span>
            </div>
          </div>
        </div>
        <div class="channel-card skeleton" v-else-if="isLoading">
          <div class="channel-card-head">
            <p class="channel-card-label">{{ t('channelIdentityPreviewLabel') }}</p>
          </div>
          <div class="channel-card-body">
            <div class="channel-avatar skeleton-avatar"></div>
            <div class="channel-skeleton-lines">
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
        <div class="channel-card empty" v-else>
          <p class="channel-card-label">{{ t('channelIdentityPreviewLabel') }}</p>
          <p class="channel-card-empty-text">{{ t('channelIdentityPreviewMissing') }}</p>
        </div>
      </div>
    </header>

    <p v-if="showEnvNotice" class="env-note">{{ t('channelEnvOverrideNotice') }}</p>

    <form class="config-form" @submit.prevent="save">
      <label class="form-label" :for="ids.handle">{{ t('channelHandleLabel') }}</label>
      <input
        :id="ids.handle"
        v-model.trim="form.channelHandle"
        class="form-input"
        type="text"
        autocomplete="off"
        :placeholder="'@' + t('channelHandlePlaceholder')" />

      <label class="form-label" :for="ids.claim">{{ t('channelClaimLabel') }}</label>
      <input
        :id="ids.claim"
        v-model.trim="form.claimId"
        class="form-input"
        type="text"
        autocomplete="off"
        :placeholder="t('channelClaimPlaceholder')" />

      <template v-if="authFormEnabled">
        <label class="form-label" :for="ids.token">{{ t('channelAuthTokenLabel') }}</label>
        <input
          :id="ids.token"
          v-model.trim="form.authToken"
          class="form-input"
          type="password"
          autocomplete="off"
          :placeholder="t('channelAuthTokenPlaceholder')" />
        <p class="form-hint">
          <i18n-t keypath="channelAuthTokenHint" tag="span">
            <template #link>
              <a
                class="channel-help-link"
                href="https://odysee.com/$/help"
                target="_blank"
                rel="noreferrer noopener">
                {{ t('channelAuthTokenLinkLabel') }}
              </a>
            </template>
          </i18n-t>
          <span v-if="hasStoredToken" class="stored-hint">
            {{ t('channelAuthTokenStoredHint') }}
          </span>
        </p>

        <div class="token-actions" v-if="hasStoredToken">
          <label class="checkbox-row">
            <input type="checkbox" v-model="form.clearAuthToken" />
            <span>{{ t('channelClearTokenLabel') }}</span>
          </label>
          <p class="form-hint">{{ t('channelClearTokenHint') }}</p>
        </div>
      </template>

      <div class="form-actions">
        <button class="btn" type="submit" :disabled="saving || isLoading">
          {{ saving ? t('commonSaving') : t('channelSaveConfig') }}
        </button>
      </div>
    </form>

    <div class="meta" v-if="currentConfig?.updatedAt">
      <p>
        {{ t('channelConfigUpdatedAt', { date: formatDate(currentConfig.updatedAt) }) }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  type ChannelAnalyticsConfigResponse,
  saveChannelAnalyticsConfig,
} from '../../services/channelAnalytics';
import { pushToast } from '../../services/toast';

interface Props {
  config: ChannelAnalyticsConfigResponse | null;
  loading: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ saved: [ChannelAnalyticsConfigResponse] }>();
const { t, locale } = useI18n();

const DISPLAY_CHAR_LIMIT = 10;

const form = reactive({
  channelHandle: '',
  claimId: '',
  authToken: '',
  clearAuthToken: false,
});
const saving = ref(false);
const currentConfig = computed(() => props.config);
const envOverrides = computed(() => currentConfig.value?.envOverrides || {});
const authFormEnabled = computed(() => currentConfig.value?.authFormEnabled !== false);
const secretStatus = computed(() => ({
  auth: !!(envOverrides.value.authToken || currentConfig.value?.hasAuthToken || form.authToken),
}));
const secretReady = computed(() => secretStatus.value.auth);
const channelIdentity = computed(() => currentConfig.value?.channelIdentity || null);
const channelInitial = computed(() => {
  if (!channelIdentity.value) return '•';
  const base = (channelIdentity.value.title || channelIdentity.value.name || '').trim();
  return base ? base.charAt(0).toUpperCase() : '•';
});
function limitCharacters(value: string | null | undefined, limit = DISPLAY_CHAR_LIMIT) {
  if (!value) return '';
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}
const channelNamePreview = computed(() => {
  const fallback = t('channelIdentityPreviewMissing');
  const base = channelIdentity.value?.title || channelIdentity.value?.name || fallback;
  return limitCharacters(base);
});
const channelHandlePreview = computed(() => {
  const handle = channelIdentity.value?.name;
  if (!handle) return '—';
  return limitCharacters(handle);
});
const channelIdentityAlt = computed(() => {
  if (!channelIdentity.value) return t('channelIdentityPreviewLabel');
  return (
    channelIdentity.value.title || channelIdentity.value.name || t('channelIdentityPreviewLabel')
  );
});
const showEnvNotice = computed(
  () => !authFormEnabled.value || Object.values(envOverrides.value).some((flag) => Boolean(flag))
);
const isLoading = computed(() => props.loading);
const hasStoredToken = computed(() => !!currentConfig.value?.hasAuthToken);

watch(
  () => props.config,
  (next) => {
    form.channelHandle = next?.channelHandle || '';
    form.claimId = next?.claimId || '';
    form.authToken = '';
    form.clearAuthToken = false;
  },
  { immediate: true }
);

watch(
  () => form.authToken,
  (next) => {
    if (!authFormEnabled.value) return;
    if (next) form.clearAuthToken = false;
  }
);

watch(
  () => authFormEnabled.value,
  (enabled) => {
    if (!enabled) {
      form.authToken = '';
      form.clearAuthToken = false;
    }
  },
  { immediate: true }
);

const ids = {
  handle: `channel-handle-${Math.random().toString(36).slice(2)}`,
  claim: `channel-claim-${Math.random().toString(36).slice(2)}`,
  token: `channel-token-${Math.random().toString(36).slice(2)}`,
};

function formatDate(iso: string) {
  try {
    const formatter = new Intl.DateTimeFormat(locale.value || 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    return formatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

async function save() {
  if (saving.value) return;
  try {
    saving.value = true;
    const trimmedToken = form.authToken ? form.authToken.trim() : '';
    if (trimmedToken) form.clearAuthToken = false;
    const payload = {
      channelHandle: form.channelHandle || undefined,
      claimId: form.claimId || undefined,
      ...(authFormEnabled.value
        ? {
            authToken: trimmedToken || undefined,
            clearAuthToken: form.clearAuthToken || undefined,
          }
        : {}),
    };
    const next = await saveChannelAnalyticsConfig(payload);
    emit('saved', next);
    pushToast({ type: 'success', message: t('channelConfigSaved') });
    form.authToken = '';
    form.clearAuthToken = false;
  } catch (err) {
    pushToast({ type: 'error', message: t('channelConfigSaveFailed') });
    console.error(err);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.config-card {
  border: 1px solid var(--card-border);
  border-radius: 1rem;
  padding: 1.5rem;
  background: var(--card-bg, var(--bg-card));
}
.config-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}
.eyebrow {
  font-size: 1.16rem;
  font-weight: 700;
  margin-bottom: 0.2rem;
}
.config-header h2 {
  margin: 0;
}
.muted {
  font-size: 0.95rem;
  color: var(--text-secondary);
}
.config-header-meta {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  align-items: stretch;
}
.channel-card {
  border: 1px solid var(--card-border);
  border-radius: 0.75rem;
  padding: 0.75rem 0.75rem 0.5rem;
  background: var(--bg-chat, var(--bg-card));
  width: 100%;
  min-width: 220px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.channel-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}
.channel-card-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 700;
  color: var(--text-secondary);
  margin: 0;
}
.channel-card-body {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}
.channel-card-body.with-status {
  justify-content: space-between;
  gap: 1rem;
}
.channel-card-main {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex: 1;
  min-width: 0;
}
.channel-card-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.channel-avatar {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: var(--bg-card, #f3f4f6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--text-secondary);
  overflow: hidden;
}
.channel-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.channel-card-name {
  margin: 0;
  font-weight: 600;
  font-size: 1rem;
}
.channel-card-handle {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.channel-card.empty {
  text-align: left;
}
.channel-card-empty-text {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.channel-card.skeleton .channel-avatar,
.channel-card.skeleton .channel-skeleton-lines span {
  background: linear-gradient(90deg, rgba(148, 163, 184, 0.2), rgba(148, 163, 184, 0.05));
  background-size: 200px 100%;
  animation: shimmer 1.4s infinite;
}
.channel-skeleton-lines {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  width: 120px;
}
.channel-skeleton-lines span {
  display: block;
  height: 10px;
  border-radius: 999px;
}
.skeleton-avatar {
  width: 44px;
  height: 44px;
}
.status-pill {
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  line-height: 1;
}
.status-pill.ok {
  background: rgba(34, 197, 94, 0.12);
  color: rgb(34, 197, 94);
}
.status-pill.warn {
  background: rgba(248, 113, 113, 0.15);
  color: rgb(248, 113, 113);
}
.status-pill-icon {
  border-radius: 999px;
  background: currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
}
.status-pill-icon .pi {
  line-height: 0;
}
.env-note {
  font-size: 0.85rem;
  color: var(--text-secondary);
  background: var(--bg-chat);
  border: 1px solid var(--card-border);
  border-radius: 0.75rem;
  padding: 0.75rem;
  margin-bottom: 1rem;
}
.config-form {
  display: grid;
  gap: 0.9rem;
}
.form-label {
  font-weight: 600;
  font-size: 1rem;
}
.form-input {
  border: 1px solid var(--card-border);
  border-radius: 0.75rem;
  padding: 0.6rem 0.85rem;
  font-size: 0.95rem;
  background: var(--bg-card);
  color: var(--text-primary);
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
}
.form-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.form-hint {
  font-size: 0.85rem;
}
.form-hint :deep(.channel-help-link) {
  color: #de0048;
  font-weight: 600;
  text-decoration: none;
}
.form-hint :deep(.channel-help-link:hover),
.form-hint :deep(.channel-help-link:focus) {
  text-decoration: underline;
}
.form-hint .stored-hint {
  margin-left: 0.35rem;
}
.token-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}
.btn {
  background: #553fee;
  color: #fff;
  padding: 0.6rem 1.2rem;
  border-radius: 0.75rem;
  border: none;
}
.btn.ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--card-border);
}
.meta {
  margin-top: 1rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}
@keyframes shimmer {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: 200px 0;
  }
}
@media (max-width: 600px) {
  .config-card {
    padding: 1.1rem;
  }
  .config-header-meta {
    width: 100%;
    align-items: flex-start;
  }
}
</style>
