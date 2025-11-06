<template>
  <div class="user-profile-panel">
    <OsCard class="user-profile-card">
      <div v-if="config.shareEnabled && config.shareUrl" class="share-url">
        <div class="share-input">
          <CopyField :value="config.shareUrl" :aria-label="t('userProfileShareUrl')" />
        </div>
        <a :href="config.shareUrl" target="_blank" rel="noopener" class="share-open-btn">
          {{ t('userProfileViewPublic') }}
        </a>
      </div>

      <div v-if="configError" class="status status-error">
        {{ t('userProfileConfigLoadFailed') }}
      </div>

      <div v-if="loadError" class="status status-error">
        <span>{{ t('userProfileLoadFailed') }}</span>
        <button type="button" class="retry-btn" @click="loadOverview">
          {{ t('userProfileReload') }}
        </button>
      </div>

      <div v-else class="panel-content">
        <div v-if="visibleSections.header" class="channel-header">
          <div class="channel-cover" :style="channelCoverStyle"></div>
          <div class="channel-info">
            <div class="channel-avatar" :style="channelAvatarStyle" aria-hidden="true"></div>
            <div class="channel-meta">
              <div class="channel-names">
                <h3 class="channel-title">{{ channelDisplayName }}</h3>
                <p v-if="channelHandle" class="channel-handle">{{ channelHandle }}</p>
              </div>
              <div class="channel-tags">
                <div class="channel-tag-list">
                  <span class="badge" :class="liveBadgeClass">
                    {{ liveStatusText }}
                  </span>
                  <span v-if="followersDisplay" class="badge badge-muted">
                    {{ t('userProfileFollowers') }} · {{ followersDisplay }}
                  </span>
                </div>
                <div class="channel-share-toggle share-toggle" :title="shareToggleHint">
                  <span id="share-toggle-hint" class="sr-only">{{ shareToggleHint }}</span>
                  <span class="share-label">{{ t('userProfileShareLabel') }}</span>
                  <button
                    type="button"
                    :class="['share-switch', config.shareEnabled ? 'switch-on' : '']"
                    role="switch"
                    :aria-checked="config.shareEnabled ? 'true' : 'false'"
                    :aria-label="shareSwitchAriaLabel"
                    aria-describedby="share-toggle-hint"
                    :disabled="savingConfig || loadingConfig"
                    @click="handleShareToggle(!config.shareEnabled)"
                    @keyup.enter.prevent="handleShareToggle(!config.shareEnabled)"
                    @keyup.space.prevent="handleShareToggle(!config.shareEnabled)">
                    <span class="share-switch-thumb"></span>
                  </button>
                </div>
              </div>
              <p v-if="channelDescription" class="channel-description">{{ channelDescription }}</p>
              <div class="channel-links">
                <a
                  v-if="channelUrl"
                  :href="channelUrl"
                  target="_blank"
                  rel="noopener"
                  class="channel-link">
                  {{ t('userProfileChannelLink') }}
                </a>
                <span v-if="updatedAtLabel" class="updated-at">{{ updatedAtLabel }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="section-toggles" aria-labelledby="profile-sections-heading">
          <div class="section-toggle-header">
            <h3 id="profile-sections-heading">{{ t('userProfileSectionsTitle') }}</h3>
            <p>{{ t('userProfileSectionHelp') }}</p>
          </div>
          <div class="section-toggle-grid">
            <div
              v-for="key in sectionKeys"
              :key="key"
              class="section-toggle"
              :class="{ disabled: savingConfig || loadingConfig }">
              <button
                type="button"
                :class="['section-switch', visibleSections[key] ? 'switch-on' : '']"
                role="switch"
                :aria-checked="visibleSections[key] ? 'true' : 'false'"
                :aria-label="t(sectionLabelMap[key])"
                :disabled="savingConfig || loadingConfig"
                @click="handleSectionToggle(key, !visibleSections[key])">
                <span class="section-switch-thumb"></span>
              </button>
              <span class="section-toggle-label">{{ t(sectionLabelMap[key]) }}</span>
            </div>
          </div>
        </div>

        <div class="filters">
          <label class="filter">
            <span>{{ t('userProfilePeriod') }}</span>
            <select v-model="period">
              <option v-for="option in periodOptions" :key="option.value" :value="option.value">
                {{ t(option.label) }}
              </option>
            </select>
          </label>
          <label class="filter">
            <span>{{ t('userProfileSpan') }}</span>
            <select v-model.number="span">
              <option v-for="option in spanOptions" :key="option" :value="option">
                {{ formatSpanLabel(option) }}
              </option>
            </select>
          </label>
          <div class="tz-display">
            <span>{{ tzLabel }}</span>
            <span class="tz-note">{{ t('streamHistoryTzNote') }}</span>
          </div>
        </div>

        <div
          v-if="visibleSections.summary"
          class="summary-grid"
          :class="{ loading: loadingOverview }">
          <div class="summary-card">
            <span class="summary-label">{{ t('userProfileSummaryHours') }}</span>
            <span class="summary-value">{{ formatHours(summaryMetrics.hoursStreamed) }}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">{{ t('userProfileSummaryAvg') }}</span>
            <span class="summary-value">{{ formatNumber(summaryMetrics.avgViewers, 1) }}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">{{ t('userProfileSummaryPeak') }}</span>
            <span class="summary-value">{{ formatNumber(summaryMetrics.peakViewers, 0) }}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">{{ t('userProfileSummaryViewerHours') }}</span>
            <span class="summary-value">{{ formatNumber(summaryMetrics.hoursWatched, 1) }}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">{{ t('userProfileSummaryActiveDays') }}</span>
            <span class="summary-value">{{ formatNumber(summaryMetrics.activeDays, 0) }}</span>
          </div>
        </div>

        <div
          v-if="visibleSections.lifetime"
          class="lifetime-grid"
          :class="{ loading: loadingOverview }">
          <div class="lifetime-card">
            <span class="lifetime-label">{{ t('userProfileLifetimeTotalHours') }}</span>
            <span class="lifetime-value">{{
              formatHours(lifetimeMetrics.totalHoursStreamed)
            }}</span>
          </div>
          <div class="lifetime-card">
            <span class="lifetime-label">{{ t('userProfileLifetimeHighestViewers') }}</span>
            <span class="lifetime-value">{{
              formatNumber(lifetimeMetrics.highestViewers, 0)
            }}</span>
          </div>
        </div>

        <div v-if="visibleSections.chart" class="chart-block">
          <ChannelPerformanceChart :data="chartData" :loading="loadingOverview" />
        </div>

        <div v-if="visibleSections.recent" class="recent-section">
          <div class="recent-header">
            <h3 class="recent-title">{{ t('userProfileRecentStreams') }}</h3>
          </div>
          <ul v-if="recentStreams.length" class="recent-list">
            <li v-for="item in recentStreams" :key="item.startEpoch" class="recent-item">
              <div class="recent-meta">
                <span class="recent-date">{{ formatDateTime(item.startEpoch) }}</span>
              </div>
              <div class="recent-stats">
                <span class="recent-stat recent-stat-duration">
                  {{ t('userProfileRecentDuration') }}: {{ formatDuration(item.durationHours) }}
                </span>
                <span class="recent-stat recent-stat-avg"
                  >{{ t('userProfileSummaryAvg') }}: {{ formatNumber(item.avgViewers, 1) }}</span
                >
                <span class="recent-stat recent-stat-peak"
                  >{{ t('userProfileSummaryPeak') }}: {{ formatNumber(item.peakViewers, 0) }}</span
                >
                <span class="recent-stat recent-stat-viewer-hours"
                  >{{ t('userProfileSummaryViewerHours') }}:
                  {{ formatNumber(item.viewerHours, 1) }}</span
                >
              </div>
            </li>
          </ul>
          <p v-else class="recent-empty">{{ t('userProfileRecentEmpty') }}</p>
        </div>
      </div>
    </OsCard>
  </div>
</template>
<script setup>
import { reactive, ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import OsCard from '../os/OsCard.vue';
import CopyField from '../shared/CopyField.vue';
import ChannelPerformanceChart from './ChannelPerformanceChart.vue';
import { fetchJson } from '../../services/api';
import { pushToast } from '../../services/toast';

const { t, locale } = useI18n();

const defaultSections = Object.freeze({
  header: true,
  summary: true,
  lifetime: true,
  chart: true,
  recent: true,
});
const sectionKeys = ['header', 'summary', 'lifetime', 'chart', 'recent'];
const sectionLabelMap = {
  header: 'userProfileSectionHeader',
  summary: 'userProfileSectionSummary',
  lifetime: 'userProfileSectionLifetime',
  chart: 'userProfileSectionChart',
  recent: 'userProfileSectionRecent',
};

const config = reactive({
  shareEnabled: false,
  shareSlug: null,
  shareUrl: null,
  sections: reactive({ ...defaultSections }),
});

const overview = ref(null);
const loadingConfig = ref(false);
const loadingOverview = ref(false);
const savingConfig = ref(false);
const loadError = ref('');
const configError = ref('');
const initialLoaded = ref(false);
const lastUpdatedAt = ref(null);

const period = ref('day');
const span = ref(30);
const tzOffset = ref(Math.max(-840, Math.min(840, -new Date().getTimezoneOffset())));

const periodOptions = [
  { value: 'day', label: 'periodDay' },
  { value: 'week', label: 'periodWeek' },
  { value: 'month', label: 'periodMonth' },
  { value: 'year', label: 'periodYear' },
];

const spanOptionsMap = {
  day: [7, 14, 30, 60, 90],
  week: [4, 8, 12, 24],
  month: [3, 6, 12, 24],
  year: [1, 2, 3, 5],
};

const spanOptions = computed(() => spanOptionsMap[period.value] || [span.value]);

const visibleSections = computed(() => {
  const merged = { ...defaultSections };
  for (const key of sectionKeys) {
    merged[key] = config.sections[key] !== false;
  }
  return merged;
});

const numberFormatter = computed(() => new Intl.NumberFormat(locale.value || 'en-US'));
const decimalFormatter = computed(
  () =>
    new Intl.NumberFormat(locale.value || 'en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
);
const dateTimeFormatter = computed(
  () =>
    new Intl.DateTimeFormat(locale.value || 'en-US', { dateStyle: 'medium', timeStyle: 'short' })
);

const chartData = computed(() =>
  overview.value?.summary?.data ? [...overview.value.summary.data] : []
);
const summaryMetrics = computed(() => overview.value?.performance?.range || defaultSummary());
const lifetimeMetrics = computed(() => overview.value?.performance?.allTime || defaultLifetime());
const recentStreams = computed(() => overview.value?.performance?.recentStreams || []);
const channelInfo = computed(() => overview.value?.channel || {});
const liveInfo = computed(() => overview.value?.live || {});

const FALLBACK_AVATAR_URL =
  'https://thumbnails.odycdn.com/optimize/s:0:0/quality:85/plain/https://player.odycdn.com/speech/spaceman-png:2.png';
const FALLBACK_AVATAR_COLORS = [
  '#00bcd4',
  '#ff9800',
  '#8bc34a',
  '#e91e63',
  '#9c27b0',
  '#3f51b5',
  '#ff5722',
  '#4caf50',
  '#2196f3',
  '#ffc107',
];

const channelDisplayName = computed(() => {
  const info = channelInfo.value;
  return info.title || info.name || t('userProfileFallbackChannelTitle');
});

const channelHandle = computed(() => {
  const name = channelInfo.value?.name;
  if (!name) return '';
  if (name.startsWith('@')) return name;
  return `@${name}`;
});

const channelDescription = computed(() => {
  const text = channelInfo.value?.description;
  if (!text) return '';
  if (text.length <= 240) return text;
  return `${text.slice(0, 237)}...`;
});

const channelUrl = computed(() =>
  typeof channelInfo.value?.url === 'string' ? channelInfo.value.url : ''
);
const channelCoverStyle = computed(() => {
  const url = channelInfo.value?.cover;
  if (url) {
    return {
      backgroundImage: `linear-gradient(120deg, rgba(15, 23, 42, 0.65), rgba(15, 23, 42, 0.35)), url(${url})`,
    };
  }
  return {
    background: 'linear-gradient(120deg, rgba(99, 102, 241, 0.35), rgba(14, 116, 144, 0.35))',
  };
});

const channelAvatarStyle = computed(() => {
  const url = channelInfo.value?.thumbnail;
  if (url) {
    return { backgroundImage: `url(${url})` };
  }
  const fallback = channelDisplayName.value ? channelDisplayName.value.charCodeAt(0) : 68;
  const paletteIndex = fallback % FALLBACK_AVATAR_COLORS.length;
  const backgroundColor = FALLBACK_AVATAR_COLORS[paletteIndex];
  return {
    backgroundImage: `url(${FALLBACK_AVATAR_URL})`,
    backgroundColor,
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
});

const followersDisplay = computed(() => {
  const raw = Number(channelInfo.value?.followers || 0);
  if (!Number.isFinite(raw) || raw <= 0) return '';
  return numberFormatter.value.format(Math.round(raw));
});

const liveBadgeClass = computed(() => (liveInfo.value?.isLive ? 'badge-live' : 'badge-muted'));
const liveStatusText = computed(() =>
  liveInfo.value?.isLive ? t('userProfileLiveNow') : t('userProfileOffline')
);

const shareSwitchAriaLabel = computed(() =>
  config.shareEnabled ? t('userProfileShareOn') : t('userProfileShareOff')
);

const shareToggleHint = computed(() => t('userProfileShareToggleHint'));

const tzLabel = computed(() => {
  const offset = Math.max(-840, Math.min(840, Number(tzOffset.value || 0)));
  const abs = Math.abs(offset);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  const sign = offset >= 0 ? '+' : '-';
  return t('streamHistoryTzOffset', { offset: `${sign}${hours}:${minutes}` });
});

const updatedAtLabel = computed(() => {
  if (!lastUpdatedAt.value) return '';
  try {
    return t('userProfileUpdatedAt', { time: dateTimeFormatter.value.format(lastUpdatedAt.value) });
  } catch {
    return '';
  }
});

let overviewReqId = 0;

function defaultSummary() {
  return { hoursStreamed: 0, avgViewers: 0, peakViewers: 0, hoursWatched: 0, activeDays: 0 };
}

function defaultLifetime() {
  return { totalHoursStreamed: 0, highestViewers: 0 };
}

function normalizeSections(incoming) {
  const normalized = { ...defaultSections };
  if (!incoming || typeof incoming !== 'object') return normalized;
  for (const key of sectionKeys) {
    normalized[key] = incoming[key] !== false;
  }
  return normalized;
}

function applyConfig(payload = {}) {
  config.shareEnabled = payload.shareEnabled === true;
  config.shareSlug = typeof payload.shareSlug === 'string' ? payload.shareSlug : null;
  config.shareUrl = typeof payload.shareUrl === 'string' ? payload.shareUrl : null;
  const normalized = normalizeSections(payload.sections);
  for (const key of sectionKeys) {
    config.sections[key] = normalized[key];
  }
}

async function loadConfig() {
  loadingConfig.value = true;
  configError.value = '';
  try {
    const data = await fetchJson('/config/user-profile-config.json');
    applyConfig(data || {});
  } catch (err) {
    configError.value = err?.message || 'failed_to_load';
    pushToast({ type: 'error', message: t('userProfileConfigLoadFailed') });
  } finally {
    loadingConfig.value = false;
  }
}

async function loadOverview() {
  const localId = ++overviewReqId;
  loadingOverview.value = true;
  loadError.value = '';
  try {
    const params = new URLSearchParams({
      period: period.value,
      span: String(Math.max(1, span.value || 1)),
      tz: String(Math.max(-840, Math.min(840, Number(tzOffset.value || 0)))),
    });
    const data = await fetchJson(`/api/user-profile/overview?${params.toString()}`);
    if (overviewReqId !== localId) return;
    overview.value = data || null;
    lastUpdatedAt.value = data?.generatedAt ? new Date(data.generatedAt) : new Date();
  } catch (err) {
    if (overviewReqId !== localId) return;
    loadError.value = err?.message || 'failed_to_load';
    pushToast({ type: 'error', message: t('userProfileLoadFailed') });
  } finally {
    if (overviewReqId === localId) {
      loadingOverview.value = false;
    }
  }
}

async function saveConfig(options = {}) {
  savingConfig.value = true;
  try {
    const payload = {
      shareEnabled: config.shareEnabled,
      sections: { ...config.sections },
    };
    const res = await fetchJson('/config/user-profile-config.json', {
      method: 'POST',
      body: payload,
    });
    if (res?.config) {
      applyConfig(res.config);
    }
    if (options.refreshOverview) await loadOverview();
    return true;
  } finally {
    savingConfig.value = false;
  }
}

async function handleShareToggle(nextValue) {
  if (savingConfig.value || loadingConfig.value) return;
  const previous = config.shareEnabled;
  config.shareEnabled = nextValue;
  try {
    await saveConfig({ refreshOverview: true });
    pushToast({
      type: 'success',
      message: t(nextValue ? 'userProfileShareEnabledToast' : 'userProfileShareDisabledToast'),
    });
  } catch {
    config.shareEnabled = previous;
    pushToast({ type: 'error', message: t('userProfileShareCreateFailed') });
  }
}

async function handleSectionToggle(key, nextValue) {
  if (!sectionKeys.includes(key) || savingConfig.value || loadingConfig.value) return;
  const previous = config.sections[key];
  config.sections[key] = nextValue;
  try {
    await saveConfig();
    pushToast({ type: 'success', message: t('userProfileConfigSaved') });
  } catch {
    config.sections[key] = previous;
    pushToast({ type: 'error', message: t('userProfileConfigSaveFailed') });
  }
}

function formatNumber(value, minimumFractionDigits = 0) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';
  if (minimumFractionDigits > 0) {
    return decimalFormatter.value.format(num);
  }
  return numberFormatter.value.format(Math.round(num));
}

function formatHours(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';
  const decimals = num >= 10 ? 1 : 2;
  const formatted = num.toFixed(decimals);
  return formatted.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function formatDuration(hours) {
  const totalMinutes = Math.max(0, Math.round(Number(hours || 0) * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  if (m) return `${m}m`;
  return '—';
}

function formatDateTime(epoch) {
  if (!Number.isFinite(Number(epoch))) return '—';
  try {
    return dateTimeFormatter.value.format(new Date(epoch));
  } catch {
    return '—';
  }
}

function formatSpanLabel(option) {
  const unitKey =
    period.value === 'day'
      ? 'userProfileUnitDay'
      : period.value === 'week'
      ? 'userProfileUnitWeek'
      : period.value === 'month'
      ? 'userProfileUnitMonth'
      : 'userProfileUnitYear';
  return `${option} ${t(unitKey)}`;
}

onMounted(async () => {
  await loadConfig();
  await loadOverview();
  initialLoaded.value = true;
});

watch(
  () => period.value,
  () => {
    const options = spanOptions.value;
    if (!options.includes(span.value)) {
      span.value = options[0];
      return;
    }
    if (initialLoaded.value) loadOverview();
  }
);

watch(
  () => span.value,
  () => {
    if (initialLoaded.value) loadOverview();
  }
);
</script>
<style scoped>
.user-profile-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.user-profile-card {
  --os-card-gap: 18px;
}
.share-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
.share-label {
  font-size: 0.9rem;
  font-weight: 600;
}
.share-switch {
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid var(--card-border);
  background: var(--bg-chat);
  transition: background 0.2s ease, border-color 0.2s ease;
  padding: 2px;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}
.share-switch[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
.share-switch:focus-visible,
.section-switch:focus-visible {
  outline: 2px solid var(--primary, #2563eb);
  outline-offset: 2px;
}
.share-switch-thumb {
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.2);
}
.share-switch.switch-on {
  background: rgb(85, 63, 238);
  border-color: transparent;
}
.share-switch.switch-on .share-switch-thumb {
  transform: translateX(20px);
}
.share-url {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-start;
}
.share-input {
  flex: 0 1 420px;
  min-width: min(100%, 280px);
}
.share-input :deep(.input-group) {
  width: 100%;
}
.share-open-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid rgba(37, 99, 235, 0.2);
  background: transparent;
  font-size: 1rem;
  font-weight: 600;
  color: var(--primary, #2563eb);
  text-decoration: none;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}
.share-open-btn:hover,
.share-open-btn:focus-visible {
  background: rgba(37, 99, 235, 0.08);
  border-color: rgba(37, 99, 235, 0.35);
}
.share-open-btn:focus-visible {
  outline: 2px solid var(--primary, #2563eb);
  outline-offset: 2px;
}
@media (max-width: 640px) {
  .share-url {
    flex-direction: column;
    align-items: stretch;
  }
  .share-input {
    width: 100%;
  }
  .share-open-btn {
    width: 100%;
    justify-content: center;
  }
}
.section-toggles {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 16px;
  background: var(--bg-chat);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-toggle-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}
.section-toggle-header p {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.section-toggle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}
.section-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
}
.section-toggle.disabled {
  opacity: 0.6;
}
.section-switch {
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid var(--card-border);
  background: var(--bg-chat);
  transition: background 0.2s ease, border-color 0.2s ease;
  padding: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;
}
.section-switch[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
.section-switch-thumb {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: #fff;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.18);
}
.section-switch.switch-on {
  background: rgb(85, 63, 238);
  border-color: transparent;
}
.section-switch.switch-on .section-switch-thumb {
  transform: translateX(18px);
}
.section-toggle-label {
  font-size: 0.9rem;
}
.status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  font-size: 0.9rem;
}
.status-error {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}
.retry-btn {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid currentColor;
  background: transparent;
  font-size: 0.8rem;
}
.panel-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.channel-header {
  border-radius: 16px;
  position: relative;
}
.channel-cover {
  height: 190px;
  width: 100%;
  background-size: cover;
  background-position: center;
  border-radius: 12px;
}
.channel-info {
  position: relative;
  display: flex;
  gap: 18px;
  padding: 12px;
  background: var(--card-bg);
  margin-top: -18px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
}
.channel-avatar {
  width: 96px;
  height: 96px;
  border-radius: 20px;
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
  border: 3px solid var(--card-bg);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
}
.channel-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.channel-names {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.channel-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
}
.channel-handle {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
}
.channel-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.channel-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.channel-share-toggle {
  margin-left: auto;
  flex-shrink: 0;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}
.badge-live {
  background: rgba(252, 165, 165, 0.18);
  color: #dc2626;
}
.badge-muted {
  background: rgba(148, 163, 184, 0.18);
  color: #475569;
}
.channel-description {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  max-width: 720px;
}
.channel-links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.channel-link {
  font-size: 0.85rem;
  font-weight: 700;
  color: #eb2565;
}
.updated-at {
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
}
.filter {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 160px;
  font-size: 0.85rem;
}
.filter select {
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 6px 10px;
  background: var(--card-bg);
  color: var(--text-primary);
}
.tz-display {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
}
.tz-note {
  color: var(--text-secondary);
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
}
.summary-card {
  border-radius: 14px;
  padding: 14px;
  border: 1px solid var(--card-border);
  background: var(--bg-chat);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.summary-label {
  font-size: 0.8rem;
  font-weight: 700;
}
.summary-value {
  font-size: 24px;
  font-weight: 700;
}
.lifetime-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}
.lifetime-card {
  border-radius: 14px;
  padding: 14px;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lifetime-label {
  font-size: 0.8rem;
  font-weight: 700;
}
.lifetime-value {
  font-size: 24px;
  font-weight: 700;
}
.chart-block {
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 12px;
  background: var(--card-bg);
}
.recent-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.recent-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}
.recent-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.recent-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}
.recent-item {
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  background: var(--bg-chat);
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
}
.recent-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.85rem;
}
.recent-stat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 12px;
  font-weight: 600;
  color: #0f172a;
  font-size: 12px;
}
.recent-stat-duration {
  background: rgba(251, 191, 36, 0.9);
}
.recent-stat-avg {
  background: rgba(14, 165, 233, 0.9);
}
.recent-stat-peak {
  background: rgb(34 197 94);
}
.recent-stat-viewer-hours {
  background: rgba(129, 140, 248, 0.9);
}
.recent-empty {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
}
.summary-grid.loading .summary-value,
.lifetime-grid.loading .lifetime-value {
  opacity: 0.5;
}
@media (max-width: 640px) {
  .channel-info {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .channel-meta {
    align-items: center;
  }
  .channel-tags {
    flex-direction: column;
    align-items: stretch;
  }
  .channel-share-toggle {
    margin-left: 0;
    width: 100%;
    justify-content: center;
  }
  .channel-links {
    justify-content: center;
  }
  .filters {
    flex-direction: column;
    align-items: stretch;
  }
  .tz-display {
    flex-direction: row;
    justify-content: space-between;
  }
}
</style>
