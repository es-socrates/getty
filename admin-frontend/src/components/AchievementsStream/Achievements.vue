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
          class="btn-secondary"
          :aria-expanded="String(!settingsCollapsed)"
          aria-controls="ach-settings"
          @click="toggleSettings">
          <span class="opacity-90">{{
            settingsCollapsed ? t('commonShow') : t('commonHide')
          }}</span>
        </button>
      </div>

      <div id="ach-settings" v-show="!settingsCollapsed" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="panel-list" :aria-label="t('achievementsQuickOptions')">
            <div class="panel-list-row">
              <div class="row-text">
                <div class="row-title">{{ t('achievementsEnableLabel') }}</div>
                <div class="row-desc">{{ t('achievementsEnableDesc') }}</div>
              </div>
              <button
                type="button"
                class="switch"
                :aria-pressed="String(cfg.enabled)"
                @click="cfg.enabled = !cfg.enabled">
                <span class="knob"></span>
              </button>
            </div>
            <div class="panel-list-row">
              <div class="row-text">
                <div class="row-title">{{ t('achievementsDndLabel') }}</div>
                <div class="row-desc">{{ t('achievementsDndDesc') }}</div>
              </div>
              <button
                type="button"
                class="switch"
                :aria-pressed="String(cfg.dnd)"
                @click="cfg.dnd = !cfg.dnd">
                <span class="knob"></span>
              </button>
            </div>
          </div>
          <div class="field">
            <label class="label">{{ t('achievementsClaimIdLabel') }}</label>
            <input
              class="input"
              v-model="cfg.claimid"
              :placeholder="t('achievementsClaimIdPlaceholder')" />
          </div>
          <div class="field">
            <label class="label">{{ t('achievementsThemeLabel') }}</label>
            <select class="input" v-model="cfg.theme">
              <option value="light">{{ t('themeLight') }}</option>
              <option value="dark">{{ t('themeDark') }}</option>
            </select>
          </div>
          <div class="field">
            <label class="label">{{ t('achievementsPositionLabel') }}</label>
            <select class="input" v-model="cfg.position">
              <option value="top-right">{{ t('positionTopRight') }}</option>
              <option value="top-left">{{ t('positionTopLeft') }}</option>
              <option value="bottom-right">{{ t('positionBottomRight') }}</option>
              <option value="bottom-left">{{ t('positionBottomLeft') }}</option>
            </select>
          </div>
          <div class="field">
            <label class="label">{{ t('achievementsHistoryLabel') }}</label>
            <input class="input" v-model.number="cfg.historySize" type="number" min="1" max="20" />
          </div>
          <div class="field md:col-span-2">
            <label class="label">{{ t('achievementsSoundLabel') }}</label>
            <div class="audio-grid items-center">
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  class="switch"
                  :aria-pressed="String(cfg.sound.enabled)"
                  @click="cfg.sound.enabled = !cfg.sound.enabled">
                  <span class="knob"></span>
                </button>
                <span class="small opacity-80">{{ t('achievementsSoundToggleLabel') }}</span>
              </div>
              <div>
                <label class="label" for="audio-source">{{
                  t('achievementsAudioSourceFieldLabel')
                }}</label>
                <div class="flex items-center gap-2">
                  <span class="small opacity-70">{{ t('achievementsAudioSourceSublabel') }}</span>
                  <select
                    id="audio-source"
                    class="input select max-w-[200px]"
                    v-model="audio.audioSource"
                    aria-label="Audio source">
                    <option value="remote">{{ t('achievementsAudioSourceRemoteOption') }}</option>
                    <option value="custom">{{ t('achievementsAudioSourceCustomOption') }}</option>
                  </select>
                </div>
              </div>

              <div v-if="audio.audioSource === 'remote'" class="text-sm opacity-70">
                {{ t('achievementsAudioSourceRemoteOption') }}
              </div>
              <div
                class="flex items-center gap-1"
                role="group"
                :aria-label="t('achievementsSoundVolumeLabel')">
                <button
                  type="button"
                  class="btn-secondary"
                  @click="stepVol(-0.05)"
                  :disabled="cfg.sound.volume <= 0">
                  −
                </button>
                <span class="vol-badge" aria-live="polite">{{ volPercent }}%</span>
                <button
                  type="button"
                  class="btn-secondary"
                  @click="stepVol(0.05)"
                  :disabled="cfg.sound.volume >= 1">
                  +
                </button>
              </div>
            </div>
            <div class="mt-3" v-if="audio.audioSource === 'custom'">
              <div class="flex items-center gap-2 flex-wrap">
                <input
                  ref="audioInput"
                  type="file"
                  accept="audio/*"
                  class="hidden"
                  @change="onAudioChange" />
                <button class="btn-secondary" type="button" @click="triggerAudio">
                  {{ t('achievementsUploadAudioBtn') }}
                </button>
                <button
                  class="btn btn-danger"
                  type="button"
                  @click="deleteCustomAudio"
                  :disabled="savingAudio"
                  v-if="audioState.hasCustomAudio">
                  {{ t('remove') }}
                </button>
                <span class="small" v-if="audioState.audioFileName"
                  >{{ audioState.audioFileName }} ({{ formatSize(audioState.audioFileSize) }})</span
                >
                <button class="btn-save" type="button" :disabled="savingAudio" @click="saveAudio">
                  {{ savingAudio ? t('commonSaving') : t('achievementsSaveAudioBtn') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="btn-save" @click="save" :disabled="saving">{{ t('saveSettings') }}</button>
          <button class="btn-secondary" @click="testNotif" :disabled="saving">
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
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref, computed, watch } from 'vue';
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
const pt = usePublicToken();
const { t } = useI18n();
const widgetUrl = computed(() => pt.withToken(`${location.origin}/widgets/achievements`));
const channelAvatarUrl = ref('');
const volPercent = computed(() =>
  Math.round(Math.max(0, Math.min(1, Number(cfg.sound.volume) || 0)) * 100)
);

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

const audioInput = ref(null);
const audio = reactive({ audioSource: 'remote' });
const audioState = reactive({ hasCustomAudio: false, audioFileName: '', audioFileSize: 0 });
const savingAudio = ref(false);

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
  } finally {
    saving.value = false;
  }
}
async function reset(id) {
  try {
    await resetAchievement(id);
    await loadAll();
  } catch {}
}

async function testNotif() {
  try {
    await testAchievementsNotification();
  } catch {}
}

function stepVol(delta) {
  const v = Math.max(0, Math.min(1, (Number(cfg.sound.volume) || 0) + delta));
  cfg.sound.volume = Math.round(v * 100) / 100;
}

function triggerAudio() {
  audioInput.value?.click();
}
function onAudioChange(e) {
  const f = e.target.files?.[0];
  if (!f) return;

  if (f.size > 1024 * 1024) {
    return;
  }
  audioInput.value.file = f;
}
async function saveAudio() {
  try {
    savingAudio.value = true;
    const fd = new FormData();
    fd.append('audioSource', audio.audioSource);
    const f = audioInput.value?.files?.[0];
    if (audio.audioSource === 'custom' && f) {
      fd.append('audioFile', f);
    }
    await api.post('/api/audio-settings', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    cfg.sound.url = audio.audioSource === 'custom' ? '/api/custom-audio' : REMOTE_ACH_SOUND_URL;
    await loadAll();
  } catch {
  } finally {
    savingAudio.value = false;
  }
}
async function deleteCustomAudio() {
  try {
    savingAudio.value = true;
    await api.delete('/api/audio-settings');
    await loadAll();
  } catch {
  } finally {
    savingAudio.value = false;
  }
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
function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

watch(
  () => cfg.claimid,
  () => {
    refreshChannelAvatar();
  }
);

async function refreshChannelAvatar() {
  try {
    channelAvatarUrl.value = '';
    const id = (cfg.claimid || '').trim();
    if (!id) return;
    const r = await fetch(`/api/channel/avatar?claimId=${encodeURIComponent(id)}`, {
      credentials: 'include',
    });
    if (!r.ok) return;
    const j = await r.json();
    channelAvatarUrl.value = typeof j?.avatar === 'string' ? j.avatar : '';
  } catch {}
}
</script>

<style scoped src="./Achievements.css"></style>
