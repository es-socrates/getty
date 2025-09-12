<template>
  <section class="os-card overflow-hidden flex flex-col">
    <h1 class="section-title flex items-center gap-1.5">
      <span class="icon os-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round">
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
          <path d="M17 9a5 5 0 0 0 5-5h-5" />
          <path d="M7 9a5 5 0 0 1-5-5h5" />
        </svg>
      </span>
      <span>{{ t('achievementsTitle') }}</span>
    </h1>

    <div class="p-4 space-y-4">
      <div class="banner">
        <h3 class="banner-title">{{ t('achievementsBannerTitle') }}</h3>
        <p class="banner-desc">
          {{ t('achievementsBannerDesc') }}
        </p>
      </div>

      <div class="flex items-center justify-end gap-3">
        <div class="text-xs opacity-70 hidden md:block">
          <span>{{ t('settingsTitle') }}</span>
        </div>
        <button
          type="button"
          class="btn-secondary btn-compact-secondary"
          :aria-expanded="String(!settingsCollapsed)"
          aria-controls="ach-settings"
          @click="toggleSettings">
          <span class="opacity-90">{{
            settingsCollapsed ? t('commonShow') : t('commonHide')
          }}</span>
        </button>
      </div>

      <div
        id="ach-settings"
        v-show="!settingsCollapsed"
        class="space-y-4"
        :data-ach-theme="cfg.theme">
        <div class="ach-settings-layout">
          <div class="ach-settings-col">
            <div class="ach-group-box" :aria-label="t('achievementsGroupNotificationPrefs')">
              <div class="ach-group-head">
                <span class="ach-head-icon" aria-hidden="true">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round">
                    <path d="M8 21h8" />
                    <path d="M12 17v4" />
                    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
                    <path d="M17 9a5 5 0 0 0 5-5h-5" />
                    <path d="M7 9a5 5 0 0 1-5-5h5" />
                  </svg>
                </span>
                <span class="ach-head-title">{{ t('achievementsGroupNotificationPrefs') }}</span>
              </div>

              <div class="ach-setting-item has-inline-switch">
                <button
                  type="button"
                  class="switch"
                  :aria-pressed="String(cfg.enabled)"
                  @click="cfg.enabled = !cfg.enabled">
                  <span class="knob"></span>
                </button>
                <div class="ach-setting-text">
                  <div class="ach-setting-title">{{ t('achievementsEnableLabel') }}</div>
                  <div class="ach-setting-desc">{{ t('achievementsEnableDesc') }}</div>
                </div>
              </div>

              <div class="ach-setting-item has-inline-switch">
                <button
                  type="button"
                  class="switch"
                  :disabled="!cfg.enabled"
                  :aria-pressed="String(cfg.dnd)"
                  @click="cfg.dnd = !cfg.dnd">
                  <span class="knob"></span>
                </button>
                <div class="ach-setting-text">
                  <div class="ach-setting-title">{{ t('achievementsDndLabel') }}</div>
                  <div class="ach-setting-desc">{{ t('achievementsDndDesc') }}</div>
                </div>
              </div>

              <div class="ach-setting-item is-vertical">
                <div class="ach-setting-text">
                  <div class="ach-setting-title flex items-center gap-2">
                    <span>{{ t('achievementsSoundRowTitle') }}</span>
                    <span
                      class="badge inline-flex items-center justify-center text-[10px] tracking-wide"
                      v-if="cfg.sound.enabled"
                      >ON</span
                    >
                  </div>
                  <div class="ach-setting-desc">{{ t('achievementsSoundRowDesc') }}</div>
                </div>
                <div class="ach-setting-control w-full flex-col items-stretch">
                  <LegacyAudioControls
                    class="w-full"
                    compact
                    force-stack
                    :show-label="false"
                    :enabled="cfg.sound.enabled"
                    :volume="cfg.sound.volume"
                    :audio-source="audio.audioSource"
                    :has-custom-audio="audioState.hasCustomAudio"
                    :audio-file-name="audioState.audioFileName"
                    :audio-file-size="audioState.audioFileSize"
                    :remote-url="REMOTE_ACH_SOUND_URL"
                    @update:enabled="(v) => (cfg.sound.enabled = v)"
                    @update:volume="(v) => (cfg.sound.volume = v)"
                    @update:audio-source="(v) => (audio.audioSource = v)"
                    @audio-saved="loadAll"
                    @audio-deleted="
                      () => {
                        audioState.hasCustomAudio = false;
                        loadAll();
                      }
                    "
                    @toast="(p) => pushToast(p.type || 'info', p.messageKey)" />
                </div>
              </div>
            </div>

            <div class="ach-group-box" :aria-label="t('achievementsGroupChannelId')">
              <div class="ach-group-head">
                <span class="ach-head-icon" aria-hidden="true">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M7 8h10" />
                    <path d="M7 12h6" />
                    <path d="M7 16h8" />
                  </svg>
                </span>
                <span class="ach-head-title">{{ t('achievementsGroupChannelId') }}</span>
              </div>
              <div class="ach-setting-item is-vertical">
                <div class="ach-setting-text">
                  <div class="ach-setting-title">{{ t('achievementsClaimIdLabel') }}</div>
                  <div class="ach-setting-desc">{{ t('achievementsClaimIdPlaceholder') }}</div>
                </div>
                <div class="ach-setting-control w-full max-w-[680px]">
                  <div class="claimid-row in-group">
                    <input
                      class="input claimid-input"
                      v-model="cfg.claimid"
                      :placeholder="t('achievementsClaimIdPlaceholder')"
                      @input="debouncedAvatarRefresh" />
                    <div class="ach-avatar-slot" v-if="cfg.claimid">
                      <div
                        v-if="avatarLoading"
                        class="ach-avatar-skeleton"
                        aria-hidden="true"
                        :title="t('channelAvatarLoading')"></div>
                      <div
                        v-else
                        class="ach-avatar-preview"
                        :class="{ 'is-error': avatarError }"
                        :title="avatarError ? t('channelAvatarError') : t('channelAvatar')">
                        <template v-if="!avatarError && channelAvatarUrl">
                          <img :src="channelAvatarUrl" alt="" @error="onAvatarError" />
                        </template>
                        <span v-else class="ach-avatar-fallback" aria-hidden="true">{{
                          fallbackInitial
                        }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="ach-settings-col">
            <div class="ach-group-box" :aria-label="t('achievementsGroupDisplay')">
              <div class="ach-group-head">
                <span class="ach-head-icon" aria-hidden="true">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 3v18" />
                    <path d="M3 12h18" />
                  </svg>
                </span>
                <span class="ach-head-title">{{ t('achievementsGroupDisplay') }}</span>
              </div>

              <div class="ach-setting-item">
                <div class="ach-setting-text">
                  <div class="ach-setting-title">{{ t('achievementsThemeLabel') }}</div>
                  <div class="ach-setting-desc">{{ t('achievementsThemeLabel') }}</div>
                </div>
                <select class="input w-[160px]" v-model="cfg.theme">
                  <option value="light">{{ t('themeLight') }}</option>
                  <option value="dark">{{ t('themeDark') }}</option>
                </select>
              </div>

              <div class="ach-setting-item">
                <div class="ach-setting-text">
                  <div class="ach-setting-title">{{ t('achievementsPositionLabel') }}</div>
                  <div class="ach-setting-desc">{{ t('achievementsPositionLabel') }}</div>
                </div>
                <select class="input w-[190px]" v-model="cfg.position">
                  <option value="top-right">{{ t('positionTopRight') }}</option>
                  <option value="top-left">{{ t('positionTopLeft') }}</option>
                  <option value="bottom-right">{{ t('positionBottomRight') }}</option>
                  <option value="bottom-left">{{ t('positionBottomLeft') }}</option>
                </select>
              </div>

              <div class="ach-setting-item">
                <div class="ach-setting-text">
                  <div class="ach-setting-title">{{ t('achievementsHistoryLabel') }}</div>
                  <div class="ach-setting-desc">{{ t('achievementsHistoryLabel') }}</div>
                </div>
                <div class="number-field mt-[12px]" :aria-label="t('achievementsHistoryLabel')">
                  <button
                    type="button"
                    class="nf-btn"
                    :disabled="cfg.historySize <= 1"
                    @click="decHistory"
                    :aria-label="t('commonDecrease') || '−'">
                    −
                  </button>
                  <input
                    class="nf-input"
                    :id="historyNumberId"
                    type="number"
                    min="1"
                    max="20"
                    step="1"
                    inputmode="numeric"
                    v-model.number="cfg.historySize"
                    @input="clampHistory"
                    @blur="clampHistory"
                    :aria-live="'off'" />
                  <button
                    type="button"
                    class="nf-btn"
                    :disabled="cfg.historySize >= 20"
                    @click="incHistory"
                    :aria-label="t('commonIncrease') || '+'">
                    +
                  </button>
                </div>
              </div>
            </div>

            <div class="ach-group-box" :aria-label="t('achievementsGroupPreview')">
              <div class="ach-group-head">
                <span class="ach-head-icon" aria-hidden="true">
                  <!-- Eye icon -->
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </span>
                <span class="ach-head-title">{{ t('achievementsGroupPreview') }}</span>
              </div>
              <div class="ach-preview">
                <div class="ach-preview-title flex items-center justify-between">
                  <span>{{ t('achievementsGroupPreview') }}</span>
                  <button
                    type="button"
                    class="btn-secondary btn-compact-secondary px-2 py-1 text-[11px]"
                    @click="testNotif"
                    :disabled="saving">
                    {{ t('achievementsTestNotificationBtn') }}
                  </button>
                </div>
                <div class="ach-live-demo" :data-theme="cfg.theme">
                  <div class="ald-item">
                    <div class="ald-left">
                      <div class="ald-ico" aria-hidden="true">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round">
                          <path d="M12 17v4" />
                          <path d="M8 21h8" />
                          <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
                          <path d="M17 9a5 5 0 0 0 5-5h-5" />
                          <path d="M7 9a5 5 0 0 1-5-5h5" />
                        </svg>
                      </div>
                      <div class="ald-text">
                        <div class="ald-title">{{ t('ach.def.t_first.title') }}</div>
                        <div class="ald-desc">{{ t('ach.def.t_first.desc') }}</div>
                      </div>
                    </div>
                    <div class="ald-time">{{ t('ach.widget.now') }}</div>
                  </div>
                </div>
                <div class="ach-preview-hint text-[11px] opacity-70">
                  <span>{{ t('achievementsBannerDesc') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="btn-save" @click="save" :disabled="saving">{{ t('saveSettings') }}</button>
          <button
            class="btn-secondary btn-compact-secondary ach-test-btn"
            @click="testNotif"
            :disabled="saving">
            {{ t('achievementsTestNotificationBtn') }}
          </button>
        </div>

        <OsCard class="mt-4" :title="t('obsIntegration')">
          <div class="form-group">
            <div class="flex flex-wrap items-center gap-3">
              <span class="label mb-0">{{ t('achievementsWidgetUrlLabel') }}</span>
              <CopyField :value="widgetUrl" :aria-label="t('achievementsWidgetUrlLabel')" />
            </div>
          </div>
        </OsCard>
      </div>

      <div>
        <h4 class="section-title">{{ t('achievementsProgressTitle') }}</h4>
        <div v-for="g in grouped" :key="g.cat" class="ach-group">
          <div class="ach-group-title">
            <span class="ach-group-left">
              <span class="ach-group-ico" aria-hidden="true">
                <svg
                  v-if="g.cat === 'viewers'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg
                  v-else-if="g.cat === 'chat'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
                </svg>
                <svg
                  v-else-if="g.cat === 'tips'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <path d="M12 17v4" />
                  <path d="M8 21h8" />
                  <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
                  <path d="M17 9a5 5 0 0 0 5-5h-5" />
                  <path d="M7 9a5 5 0 0 1-5-5h5" />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </span>
              <span>{{ g.label }}</span>
            </span>
            <span class="chip">{{ g.completed }}/{{ g.total }}</span>
          </div>
          <div class="ach-grid">
            <div v-for="it in g.items" :key="it.id" class="ach-card">
              <div class="ach-card-head">
                <div class="ach-monogram" :data-cat="it.category">{{ monogram(it.category) }}</div>
                <div class="ach-txt">
                  <div class="ach-name">{{ t(it.titleKey) || it.title }}</div>
                  <div class="ach-desc">{{ t(it.descKey) || it.desc }}</div>
                </div>
                <div class="ach-cta">
                  <span v-if="it.completed" class="badge">{{
                    t('tipGoalCardStatusCompleted')
                  }}</span>
                  <button
                    v-else
                    class="pct"
                    :class="(it.progress.percent || 0) <= 1 ? 'pct-zero' : 'pct-progress'"
                    :title="it.progress.percent + '%'">
                    {{ it.progress.percent }}%
                  </button>
                </div>
              </div>
              <div class="ach-bar" v-if="!it.completed">
                <span
                  :class="
                    'ach-w-' + Math.round(Math.max(0, Math.min(100, it.progress.percent)))
                  "></span>
              </div>
              <div class="ach-actions">
                <button
                  v-if="
                    it.category !== 'viewers' &&
                    it.id !== 't_first' &&
                    (it.progress?.percent || 0) > 1
                  "
                  class="badge-action"
                  @click="reset(it.id)"
                  :title="t('reset')">
                  {{ t('reset') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Toasts -->
      <div class="ach-toasts" aria-live="polite" aria-atomic="false">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="ach-toast"
          :class="toast.type"
          role="status">
          <span class="ach-toast-msg">{{ t(toast.messageKey) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref, computed, watch } from 'vue';
import LegacyAudioControls from '../shared/LegacyAudioControls.vue';
import CopyField from '../shared/CopyField.vue';
import OsCard from '../os/OsCard.vue';
import { usePublicToken } from '../../composables/usePublicToken';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';
import {
  fetchAchievementsConfig,
  saveAchievementsConfig,
  getAchievementsStatus,
  resetAchievement,
  testAchievementsNotification,
} from './Achievements.js';

const cfg = reactive({
  enabled: true,
  claimid: '',
  theme: 'light',
  position: 'top-right',
  dnd: false,
  historySize: 10,
  sound: { enabled: false, url: '', volume: 0.5 },
});
const status = reactive({ items: [] });
const saving = ref(false);
const toasts = ref([]);
let toastCounter = 0;
const pt = usePublicToken();
const { t } = useI18n();
const widgetUrl = computed(() => pt.withToken(`${location.origin}/widgets/achievements`));
const channelAvatarUrl = ref('');
const avatarError = ref(false);
const avatarLoading = ref(false);
const historyNumberId = 'ach-history-number';
const fallbackInitial = computed(() => {
  const id = (cfg.claimid || '').trim();
  if (!id) return '?';
  return id[0].toUpperCase();
});

const LS_KEY = 'ach-settings-collapsed';
const settingsCollapsed = ref(true);
function readCollapsed() {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}
function writeCollapsed(v) {
  try {
    localStorage.setItem(LS_KEY, v ? '1' : '0');
  } catch {}
}
function toggleSettings() {
  settingsCollapsed.value = !settingsCollapsed.value;
  writeCollapsed(settingsCollapsed.value);
}

const audio = reactive({ audioSource: 'remote' });
const audioState = reactive({ hasCustomAudio: false, audioFileName: '', audioFileSize: 0 });

const REMOTE_ACH_SOUND_URL =
  'https://itkxmyqv2a2vccunpsndolfhjejajugsztsg3wewgh6lrpvhundq.ardrive.net/RNV2YhXQNVEKjXyaNyynSRIE0NLM5G3YljH8uL6no0c';

function monogram(cat) {
  if (cat === 'viewers') return 'V';
  if (cat === 'chat') return 'C';
  if (cat === 'tips') return 'T';
  return 'M';
}

function labelFor(cat) {
  if (cat === 'viewers') return t('achievementsGroupViewers');
  if (cat === 'chat') return t('achievementsGroupChat');
  if (cat === 'tips') return t('achievementsGroupTips');
  return t('achievementsGroupOther');
}

const grouped = computed(() => {
  const order = ['viewers', 'chat', 'tips'];
  const byCat = Object.create(null);
  for (const it of status.items || []) {
    const key = order.includes(it.category) ? it.category : 'misc';
    (byCat[key] ||= []).push(it);
  }
  return order
    .map((cat) => {
      const items = byCat[cat] || [];
      const completed = items.filter((i) => i.completed).length;
      return { cat, label: labelFor(cat), items, total: items.length, completed };
    })
    .filter((g) => g.items.length > 0);
});

async function loadAll() {
  try {
    Object.assign(cfg, await fetchAchievementsConfig());
  } catch {}
  try {
    const st = await getAchievementsStatus();
    status.items = Array.isArray(st.items) ? st.items : [];
  } catch {}
  try {
    const { data } = await api.get('/api/audio-settings');
    audio.audioSource = data.audioSource || 'remote';
    audioState.hasCustomAudio = !!data.hasCustomAudio;
    audioState.audioFileName = data.audioFileName || '';
    audioState.audioFileSize = data.audioFileSize || 0;

    cfg.sound.url = audio.audioSource === 'custom' ? '/api/custom-audio' : REMOTE_ACH_SOUND_URL;
  } catch {}
  try {
    await refreshChannelAvatar();
  } catch {}
}
async function save() {
  saving.value = true;
  try {
    await saveAchievementsConfig(cfg);
    await loadAll();
    pushToast('success', 'toastSettingsSaved');
  } finally {
    saving.value = false;
  }
}
async function reset(id) {
  try {
    await resetAchievement(id);
    await loadAll();
    pushToast('info', 'toastAchievementReset');
  } catch {}
}

async function testNotif() {
  try {
    await testAchievementsNotification();
    pushToast('info', 'toastTestSent');
  } catch {}
}

onMounted(loadAll);
onMounted(() => {
  settingsCollapsed.value = readCollapsed();
});

watch(
  () => audio.audioSource,
  (src) => {
    cfg.sound.url = src === 'custom' ? '/api/custom-audio' : REMOTE_ACH_SOUND_URL;
  }
);

watch(
  () => cfg.claimid,
  () => {
    refreshChannelAvatar();
  }
);

async function refreshChannelAvatar() {
  try {
    channelAvatarUrl.value = '';
    avatarError.value = false;
    avatarLoading.value = true;
    const id = (cfg.claimid || '').trim();
    if (!id) return;
    const r = await fetch(`/api/channel/avatar?claimId=${encodeURIComponent(id)}`, {
      credentials: 'include',
    });
    if (!r.ok) return;
    const j = await r.json();
    channelAvatarUrl.value = typeof j?.avatar === 'string' ? j.avatar : '';
    if (!channelAvatarUrl.value) avatarError.value = true;
  } catch {
    avatarError.value = true;
  } finally {
    avatarLoading.value = false;
  }
}

function onAvatarError() {
  avatarError.value = true;
  channelAvatarUrl.value = '';
}

let avatarTimer = null;
function clampHistory() {
  if (typeof cfg.historySize !== 'number' || isNaN(cfg.historySize)) cfg.historySize = 1;
  if (cfg.historySize < 1) cfg.historySize = 1;
  if (cfg.historySize > 20) cfg.historySize = 20;
}
function incHistory() {
  if (cfg.historySize < 20) cfg.historySize++;
}
function decHistory() {
  if (cfg.historySize > 1) cfg.historySize--;
}
function debouncedAvatarRefresh() {
  if (avatarTimer) clearTimeout(avatarTimer);
  avatarTimer = setTimeout(() => {
    refreshChannelAvatar();
  }, 450);
}

function pushToast(type, messageKey, timeout = 3500) {
  const id = ++toastCounter;
  toasts.value.push({ id, type, messageKey });
  if (timeout > 0) {
    setTimeout(() => dismissToast(id), timeout);
  }
}
function dismissToast(id) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}
</script>

<style scoped src="./Achievements.css"></style>
