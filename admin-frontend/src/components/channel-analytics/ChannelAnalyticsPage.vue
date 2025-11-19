<template>
  <div class="channel-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">{{ t('channelAnalyticsEyebrow') }}</p>
        <p class="muted">{{ t('channelAnalyticsSubtitle') }}</p>
      </div>
      <div class="actions">
        <ChannelRangeFilter v-model="range" />
        <button
          class="ghost-btn"
          type="button"
          @click="toggleConfigVisibility"
          :aria-pressed="configVisible ? 'true' : 'false'">
          <i class="pi" :class="configVisible ? 'pi-eye-slash' : 'pi-eye'" aria-hidden="true"></i>
          {{ configVisible ? t('channelHideConfig') : t('channelShowConfig') }}
        </button>
        <button
          class="ghost-btn"
          type="button"
          @click="refreshOverview"
          :disabled="overview.loading || configState.loading || !analyticsReady">
          <i class="pi pi-sync" aria-hidden="true"></i>
          {{ t('commonRefresh') }}
        </button>
      </div>
    </header>

    <section class="layout-grid" :class="{ 'layout-single': !configVisible }">
      <article class="overview-card">
        <div class="totals">
          <div class="total-card" v-for="card in totalCards" :key="card.key">
            <p class="label">
              <i class="pi" :class="card.icon" aria-hidden="true"></i>
              <span>{{ card.label }}</span>
            </p>
            <p class="value">{{ card.value }}</p>
            <p class="hint">{{ card.hint }}</p>
          </div>
        </div>

        <div v-if="highlights" class="highlights-card">
          <div class="highlights-header">
            <div>
              <h3 class="highlight-title">
                <i class="pi pi-trophy" aria-hidden="true"></i>
                <span>{{ t('channelHighlightsTitle') }}</span>
              </h3>
              <p class="muted">{{ t('channelHighlightsSubtitle') }}</p>
            </div>
          </div>
          <div class="highlight-stats">
            <div class="highlight-stat">
              <p class="stat-label">{{ t('channelHighlightsViews') }}</p>
              <p class="stat-value">{{ formatMetric(highlights.views) }}</p>
              <p class="delta" :class="deltaClass(highlights.viewsChange)">
                {{ formatDelta(highlights.viewsChange) }}
                <span class="delta-range">({{ deltaRangeLabel }})</span>
              </p>
            </div>
            <div class="highlight-stat">
              <p class="stat-label">{{ t('channelHighlightsFollowers') }}</p>
              <p class="stat-value">{{ formatMetric(highlights.subs) }}</p>
              <p class="delta" :class="deltaClass(highlights.subsChange)">
                {{ formatDelta(highlights.subsChange) }}
                <span class="delta-range">({{ deltaRangeLabel }})</span>
              </p>
            </div>
          </div>
          <div v-if="highlightVideoCards.length" class="highlight-videos">
            <article
              v-for="entry in highlightVideoCards"
              :key="entry.key"
              class="highlight-video-card">
              <div
                v-if="entry.trend"
                class="trend-chart-wrapper"
                :class="{ 'trend-neutral': entry.trend.neutral }">
                <MiniTrendChart
                  v-if="!entry.trend.neutral"
                  class="trend-chart"
                  :points="entry.trend.series"
                  :color="entry.trend.color"
                  :height="120"
                  :aria-label="trendAriaLabel(entry.trend)" />
                <div
                  v-else
                  class="trend-neutral-line"
                  :style="{ backgroundColor: entry.trend.color }"
                  role="presentation"
                  aria-hidden="true"></div>
              </div>
              <i
                v-if="entry.trend && !entry.trend.neutral"
                class="pi trend-icon"
                :class="[entry.trend.icon, entry.trend.direction]"
                aria-hidden="true"></i>
              <p class="video-label">{{ entry.label }}</p>
              <template v-if="entry.video">
                <p class="video-title">
                  <a
                    v-if="entry.video?.url"
                    class="video-title-link"
                    :href="entry.video.url"
                    target="_blank"
                    rel="noreferrer"
                    :title="resolveVideoTitle(entry.video)">
                    <span>{{ formatVideoTitle(entry.video) }}</span>
                    <i class="pi pi-link link-indicator" aria-hidden="true"></i>
                  </a>
                  <span v-else :title="resolveVideoTitle(entry.video)">
                    {{ formatVideoTitle(entry.video) }}
                  </span>
                </p>
                <p class="video-views">
                  {{ formatMetric(entry.video?.views) }}
                  {{
                    entry.metricKey === 'comments'
                      ? t('channelHighlightsCommentsShort')
                      : t('channelHighlightsViewsShort')
                  }}
                  <span class="delta" :class="deltaClass(entry.video?.change)">
                    {{ formatDelta(entry.video?.change) }}
                    <span class="delta-range">({{ deltaRangeLabel }})</span>
                  </span>
                </p>
              </template>
              <p v-else class="video-empty">{{ t('channelHighlightsNoVideo') }}</p>
            </article>
          </div>
          <p v-else class="muted">{{ t('channelHighlightsNoVideo') }}</p>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div>
              <h3 class="chart-title">
                <i class="pi pi-video" aria-hidden="true"></i>
                <span>{{ t('channelChartTitle') }}</span>
              </h3>
              <p class="muted">{{ t('channelChartHint') }}</p>
            </div>
            <div class="chart-meta">
              <p v-if="overview.data?.updatedAt" class="muted text-sm">
                {{ t('lastUpdated') }} · {{ formatRelative(overview.data.updatedAt) }}
              </p>
              <button
                v-if="showRefreshButton"
                type="button"
                class="refresh-btn"
                :disabled="refreshBlocked"
                @click="handleRefresh"
                :title="refreshBlocked ? t('channelRefreshBlocked') : t('channelRefreshTooltip')">
                <i class="pi pi-sync" :class="{ spinning: overview.loading }"></i>
              </button>
            </div>
          </div>

          <div v-if="overview.loading || configState.loading" class="skeleton-chart"></div>
          <div v-else-if="emptyState" class="empty-state">
            <p>{{ emptyStateMessage }}</p>
          </div>
          <ChannelBarChart v-else :labels="chartLabels" :datasets="chartDatasets" :height="320" />
        </div>
      </article>

      <ChannelAnalyticsConfig
        v-if="configVisible"
        :config="configState.data"
        :loading="configState.loading"
        @saved="handleConfigSaved" />
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ChannelRangeFilter from './ChannelRangeFilter.vue';
import ChannelBarChart from './ChannelBarChart.vue';
import ChannelAnalyticsConfig from './ChannelAnalyticsConfig.vue';
import MiniTrendChart from './MiniTrendChart.vue';
import {
  fetchChannelAnalytics,
  fetchChannelAnalyticsConfig,
  type ChannelAnalyticsOverview,
  type ChannelAnalyticsConfigResponse,
  type ChannelAnalyticsRange,
  type ChannelAnalyticsHighlightVideo,
} from '../../services/channelAnalytics';
import { pushToast } from '../../services/toast';
import { useWalletSession } from '../../composables/useWalletSession';

const { t, locale } = useI18n();
// Toggle back to true once the access token issue affecting views is resolved.
const contentViewsSeriesEnabled = true;
const wallet = useWalletSession();
const range = ref<ChannelAnalyticsRange>('week');
const configVisible = ref(false);
const overview = reactive<{ loading: boolean; data: ChannelAnalyticsOverview | null }>({
  loading: false,
  data: null,
});
const configState = reactive<{ loading: boolean; data: ChannelAnalyticsConfigResponse | null }>({
  loading: false,
  data: null,
});
const numberFormatter = computed(() => createNumberFormatter());
const analyticsReady = computed(() => {
  const cfg = configState.data;
  return Boolean(cfg?.claimId && cfg?.hasAuthToken);
});

async function ensureSession() {
  try {
    await wallet.refresh();
  } catch {}
}

async function loadConfig() {
  configState.loading = true;
  try {
    configState.data = await fetchChannelAnalyticsConfig();
  } catch (err: any) {
    pushToast({ type: 'error', message: t('channelConfigLoadFailed') });
    console.error(err);
  } finally {
    configState.loading = false;
  }
}

function extractApiErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null) return undefined;
  const data = (response as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return undefined;
  const code = (data as { error?: unknown }).error;
  return typeof code === 'string' ? code : undefined;
}

async function loadOverview(selectedRange = range.value) {
  if (!analyticsReady.value) {
    overview.data = null;
    overview.loading = false;
    return;
  }
  overview.loading = true;
  try {
    overview.data = await fetchChannelAnalytics(selectedRange);
  } catch (err) {
    overview.data = null;
    const code = extractApiErrorCode(err);
    if (code === 'missing_claim' || code === 'missing_auth') {
      pushToast({ type: 'warning', message: t('channelAnalyticsMissingConfig') });
    } else {
      pushToast({ type: 'error', message: t('channelAnalyticsLoadFailed') });
    }
    console.error(err);
  } finally {
    overview.loading = false;
  }
}

function handleConfigSaved(next: ChannelAnalyticsConfigResponse) {
  configState.data = next;
  refreshOverview();
}

function refreshOverview() {
  if (!analyticsReady.value) {
    pushToast({ type: 'warning', message: t('channelAnalyticsMissingConfig') });
    return;
  }
  loadOverview(range.value);
}

function toggleConfigVisibility() {
  configVisible.value = !configVisible.value;
}

watch(range, (next) => {
  if (analyticsReady.value && !['halfyear', 'year'].includes(next)) {
    loadOverview(next);
  }
});

watch(
  () => analyticsReady.value,
  (ready) => {
    if (ready && !['halfyear', 'year'].includes(range.value)) {
      loadOverview(range.value);
    } else if (!ready) {
      overview.data = null;
    }
  }
);

onMounted(async () => {
  await ensureSession();
  await loadConfig();
  if (analyticsReady.value && !['halfyear', 'year'].includes(range.value)) {
    await loadOverview(range.value);
  }
});

const emptyState = computed(() => {
  if (!analyticsReady.value) return true;
  if (!overview.data) return !['halfyear', 'year'].includes(range.value);
  return overview.data.bars.every((bar) => bar.views === 0 && bar.videos === 0);
});
const emptyStateMessage = computed(() => {
  if (!analyticsReady.value) return t('channelAnalyticsMissingConfig');
  if (['halfyear', 'year'].includes(range.value) && !overview.data) {
    return t('channelChartEmptyManual');
  }
  return t('channelChartEmpty');
});
const highlights = computed(() => overview.data?.highlights || null);
const deltaRangeLabel = computed(() => t('channelHighlightsDeltaRangeWeek'));

const chartLabels = computed(() => {
  if (!overview.data) return [];
  const currentRange = overview.data.range?.key;
  return overview.data.bars.map((bar) => formatBucketLabel(bar, currentRange));
});

const chartDatasets = computed(() => {
  if (!overview.data) return [];
  const accent = '#553FEE';
  const mint = '#22d3ee';
  const datasets = [] as Array<{
    label: string;
    backgroundColor: string;
    borderRadius: number;
    data: number[];
    yAxisID?: string;
  }>;
  if (contentViewsSeriesEnabled) {
    datasets.push({
      label: t('channelMetricViews'),
      backgroundColor: accent,
      borderRadius: 8,
      data: overview.data.bars.map((bar) => bar.views),
      yAxisID: 'y',
    });
  }
  datasets.push({
    label: t('channelMetricVideos'),
    backgroundColor: mint,
    borderRadius: 8,
    data: overview.data.bars.map((bar) => bar.videos),
    yAxisID: contentViewsSeriesEnabled ? 'y1' : 'y',
  });
  return datasets;
});

const totalCards = computed(() => {
  const totals = overview.data?.totals;
  const formatNumber = numberFormatter.value;
  return [
    {
      key: 'views',
      label: t('channelTotalViews'),
      value: formatNumber(totals?.views || 0),
      hint: t('channelTotalViewsHint'),
      icon: 'pi-eye',
    },
    {
      key: 'videos',
      label: t('channelTotalVideos'),
      value: formatNumber(totals?.videos || 0),
      hint: t('channelTotalVideosHint'),
      icon: 'pi-cloud-upload',
    },
    {
      key: 'subs',
      label: t('channelTotalSubs'),
      value: formatNumber(totals?.subscribers || 0),
      hint: t('channelTotalSubsHint'),
      icon: 'pi-users',
    },
  ];
});

const highlightVideoCards = computed(() => {
  const stats = highlights.value;
  if (!stats) return [];
  return [
    {
      key: 'all-time',
      label: t('channelHighlightsTopAllTime'),
      video: stats.topAllTime,
      metricKey: 'views' as const,
    },
    {
      key: 'recent',
      label: t('channelHighlightsTopRecent'),
      video: stats.topNew,
      metricKey: 'views' as const,
    },
    {
      key: 'commented',
      label: t('channelHighlightsTopComment'),
      video: stats.topCommented,
      metricKey: 'comments' as const,
    },
  ].map((entry) => ({
    ...entry,
    trend: entry.video && entry.metricKey !== 'comments' ? createTrendData(entry.video) : null,
  }));
});

function formatBucketLabel(
  bar: { label: string; start: string | null },
  rangeKey: ChannelAnalyticsRange | undefined
) {
  const fallbackLabel = formatDateLabel(bar.start);
  if (rangeKey === 'week') {
    if (bar.label && fallbackLabel) return `${bar.label} · ${fallbackLabel}`;
    if (bar.label) return bar.label;
    return fallbackLabel;
  }
  if (bar.label) return bar.label;
  return fallbackLabel;
}

function formatDateLabel(fallback: string | null) {
  if (!fallback) return '';
  try {
    const formatter = new Intl.DateTimeFormat(locale.value || 'en', {
      month: 'short',
      day: 'numeric',
    });
    return formatter.format(new Date(fallback));
  } catch {
    return fallback;
  }
}

function formatRelative(iso: string) {
  try {
    const target = new Date(iso).getTime();
    const now = Date.now();
    const diffMinutes = Math.round((target - now) / (60 * 1000));
    const formatter = new Intl.RelativeTimeFormat(locale.value || 'en', { numeric: 'auto' });
    if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, 'minute');
    const diffHours = Math.round(diffMinutes / 60);
    return formatter.format(diffHours, 'hour');
  } catch {
    return iso;
  }
}

function createNumberFormatter() {
  try {
    const nf = new Intl.NumberFormat(locale.value || 'en', {
      maximumFractionDigits: 1,
    });
    return (value: number) => nf.format(value);
  } catch {
    return (value: number) => String(value);
  }
}

function formatMetric(value?: number | null) {
  const formatter = numberFormatter.value;
  return formatter(value ?? 0);
}

function formatDelta(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0';
  if (value > 0) return `+${numberFormatter.value(value)}`;
  if (value < 0) return `-${numberFormatter.value(Math.abs(value))}`;
  return '0';
}

function deltaClass(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value) || value === 0) return 'delta neutral';
  return value > 0 ? 'delta positive' : 'delta negative';
}

function resolveVideoTitle(video?: ChannelAnalyticsHighlightVideo | null) {
  if (!video) return t('channelHighlightsUntitled');
  return video.title || video.uri || t('channelHighlightsUntitled');
}

const VIDEO_TITLE_MAX_LENGTH = 70;

function formatVideoTitle(video?: ChannelAnalyticsHighlightVideo | null) {
  const title = resolveVideoTitle(video);
  if (title.length <= VIDEO_TITLE_MAX_LENGTH) return title;
  const safeLength = Math.max(VIDEO_TITLE_MAX_LENGTH - 3, 0);
  return `${title.slice(0, safeLength).trimEnd()}...`;
}

type TrendDirection = 'up' | 'down' | 'neutral';

type TrendData = {
  series: number[];
  direction: TrendDirection;
  icon: string;
  color: string;
  neutral?: boolean;
};

function normalizeTrendNumber(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value;
}

function createTrendData(video?: ChannelAnalyticsHighlightVideo | null): TrendData | null {
  if (!video) return null;
  const current = normalizeTrendNumber(video.views);
  const delta = normalizeTrendNumber(video.change);
  if (current === null || delta === null) return null;
  if (delta === 0) {
    return {
      series: [],
      direction: 'neutral',
      icon: 'pi-minus',
      color: '#de0050',
      neutral: true,
    };
  }
  const previous = current - delta;
  if (!Number.isFinite(previous)) return null;
  const direction: TrendDirection = current >= previous ? 'up' : 'down';
  const steps = 6;
  const diff = current - previous;
  const wobbleBase = Math.abs(diff || current || 1) * 0.05;
  const series: number[] = [];
  for (let index = 0; index < steps; index += 1) {
    const ratio = index / (steps - 1);
    const base = previous + diff * ratio;
    const wobble = Math.sin(ratio * Math.PI * 2) * wobbleBase;
    const adjusted = direction === 'up' ? base + Math.abs(wobble) : base - Math.abs(wobble);
    series.push(Number(Math.max(adjusted, 0).toFixed(2)));
  }
  const minValue = Math.min(...series);
  if (Number.isFinite(minValue) && minValue > 0) {
    for (let idx = 0; idx < series.length; idx += 1) {
      series[idx] = Number(Math.max(series[idx] - minValue, 0).toFixed(2));
    }
  }
  return {
    series,
    direction,
    icon: direction === 'up' ? 'pi-trending-up' : 'pi-trending-down',
    color: direction === 'up' ? '#22c55e' : '#de0050',
  };
}

const showRefreshButton = computed(() => ['halfyear', 'year'].includes(range.value));
const refreshBlocked = computed(() => {
  const blocked = getRefreshBlocked(range.value);
  return blocked > Date.now();
});

function handleRefresh() {
  if (refreshBlocked.value) {
    pushToast({ type: 'warning', message: t('channelRefreshBlockedMessage') });
    return;
  }
  recordRefreshAttempt(range.value);
  loadOverview(range.value);
}

function getRefreshBlocked(rangeKey: ChannelAnalyticsRange): number {
  if (!['halfyear', 'year'].includes(rangeKey)) return 0;
  try {
    const key = `analytics_refresh_blocked_${rangeKey}`;
    const stored = localStorage.getItem(key);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

function trendAriaLabel(trend: TrendData | null): string {
  if (!trend) return '';
  if (trend.neutral) return t('channelTrendNeutral');
  const direction = trend.direction === 'up' ? t('channelTrendUp') : t('channelTrendDown');
  return `${direction} ${t('channelTrendLabel')}`;
}

function recordRefreshAttempt(rangeKey: ChannelAnalyticsRange) {
  if (!['halfyear', 'year'].includes(rangeKey)) return;
  try {
    const key = `analytics_refresh_attempts_${rangeKey}`;
    const stored = localStorage.getItem(key);
    const attempts: number[] = stored ? JSON.parse(stored) : [];
    const now = Date.now();
    // Keep only attempts in last 20 seconds
    const recent = attempts.filter((ts) => now - ts < 20000);
    recent.push(now);
    localStorage.setItem(key, JSON.stringify(recent));
    if (recent.length > 3) {
      // Block for 72 hours
      const blockedUntil = now + 72 * 60 * 60 * 1000;
      localStorage.setItem(`analytics_refresh_blocked_${rangeKey}`, String(blockedUntil));
      pushToast({ type: 'error', message: t('channelRefreshRateLimited') });
    }
  } catch {}
}
</script>
<style scoped>
.channel-page {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
.page-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.ghost-btn {
  border: 1px solid var(--card-border);
  border-radius: 0.75rem;
  padding: 0.5rem 0.9rem;
  background: transparent;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
}
.ghost-btn .pi {
  font-size: 1rem;
}
.layout-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 360px);
  gap: 1.5rem;
}
.layout-grid.layout-single {
  grid-template-columns: 1fr;
}
@media (max-width: 1024px) {
  .layout-grid {
    grid-template-columns: 1fr;
  }
}
.overview-card {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
}
.totals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}
.total-card {
  padding: 1rem;
  border-radius: 1rem;
  background: var(--bg-chat, var(--bg-card));
  border: 1px solid var(--card-border);
}
.total-card .label {
  font-size: 1.16rem;
  margin-bottom: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.total-card .label .pi {
  font-size: 1.1rem;
  color: var(--text-secondary);
}
.total-card .value {
  font-size: 2rem;
  font-weight: 700;
}
.total-card .hint {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.chart-card {
  border: 1px solid var(--card-border);
  border-radius: 1.2rem;
  padding: 1.5rem;
  background: var(--card-bg, var(--bg-card));
  min-width: 0;
}
.highlights-card {
  border: 1px solid var(--card-border);
  border-radius: 1.2rem;
  padding: 1rem;
  background: var(--bg-card);
}
.highlight-title,
.chart-title {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  font-weight: 600;
}
.highlight-title {
  font-weight: 600;
  font-size: 1.16rem;
}
.highlight-title .pi,
.chart-title .pi {
  font-size: 1.15rem;
  color: var(--text-secondary);
}
.highlights-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}
.highlight-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}
.highlight-stat {
  border: 1px solid var(--card-border);
  border-radius: 1rem;
  padding: 1rem;
  background: var(--bg-chat, transparent);
}
.highlight-stat .stat-label {
  font-size: 1rem;
  font-weight: 600;
  color: #de0050;
}
.highlight-stat .stat-value {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0.25rem 0;
}
.highlight-videos {
  margin-top: 1.25rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}
.highlight-video-card {
  border: 1px solid var(--card-border);
  border-radius: 1rem;
  padding: 1rem;
  background: var(--bg-card);
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
.highlight-video-card .video-label {
  font-size: 1.15rem;
  font-weight: 600;
  margin-bottom: 0.3rem;
  color: #196eed;
}
.highlight-video-card .video-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
  word-break: break-word;
}
.highlight-video-card .video-label,
.highlight-video-card .video-title,
.highlight-video-card .video-views {
  position: relative;
  z-index: 1;
}
.highlight-video-card .video-title-link {
  color: inherit;
  text-decoration: none;
  transition: color 0.15s ease;
}
.highlight-video-card .video-title-link:hover,
.highlight-video-card .video-title-link:focus {
  color: #de0050;
  text-decoration: none;
}
.highlight-video-card .video-title-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.link-indicator {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.highlight-video-card .video-views {
  font-size: 0.9rem;
  color: var(--text-secondary);
  display: flex;
  gap: 0.4rem;
  align-items: baseline;
}
.highlight-video-card .video-empty {
  font-size: 0.92rem;
  color: var(--text-secondary);
  margin-top: 0.35rem;
}
.trend-chart-wrapper {
  position: absolute;
  top: 0.5rem;
  bottom: 0.5rem;
  left: 50%;
  right: 0.65rem;
  display: flex;
  align-items: center;
  pointer-events: none;
  z-index: 0;
}
.trend-chart-wrapper.trend-neutral {
  justify-content: flex-end;
  align-items: flex-end;
}
.trend-chart {
  width: 100%;
  height: 100%;
}
.trend-neutral-line {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0.85rem;
  height: 3px;
  border-radius: 999px;
  opacity: 0.9;
}
.trend-icon {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  font-size: 0.9rem;
}
.trend-icon.up {
  color: rgb(34, 197, 94);
}
.trend-icon.down {
  color: rgb(248, 113, 113);
}
.trend-icon.neutral {
  color: rgb(248, 113, 113);
}
.delta {
  font-size: 0.85rem;
  font-weight: 600;
}
.delta.positive {
  color: rgb(34, 197, 94);
}
.delta.negative {
  color: rgb(248, 113, 113);
}
.delta.neutral {
  color: var(--text-secondary);
}
.delta-range {
  margin-left: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 15px;
}
.chart-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.refresh-btn {
  border: 1px solid var(--card-border);
  border-radius: 0.5rem;
  padding: 0.4rem;
  background: transparent;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, color 0.2s ease;
}
.refresh-btn:hover:not(:disabled) {
  background: rgba(148, 163, 184, 0.1);
  color: var(--text-primary);
}
.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.refresh-btn .pi {
  font-size: 1rem;
}
.refresh-btn .pi.spinning {
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
.skeleton-chart {
  height: 320px;
  border-radius: 1rem;
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.1),
    rgba(148, 163, 184, 0.3),
    rgba(148, 163, 184, 0.1)
  );
  background-size: 600px 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% {
    background-position: -600px 0;
  }
  100% {
    background-position: 600px 0;
  }
}
.empty-state {
  border: 1px dashed var(--card-border);
  border-radius: 1rem;
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
  background: var(--bg-chat, transparent);
}
.eyebrow {
  font-size: 1.13rem;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 0.2rem;
}
.muted {
  font-size: 1rem;
  font-weight: 500;
}
</style>
