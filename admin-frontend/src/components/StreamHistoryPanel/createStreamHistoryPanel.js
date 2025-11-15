/* global module */
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import api from '../../services/api';
import { pushToast } from '../../services/toast';
import {
  formatHours,
  formatTotalHours,
  usdFromAr,
  buildDisplayData,
} from './utils/streamHistoryUtils.js';
import { renderStreamHistoryChart, renderViewersSparkline } from './utils/renderChart.js';

const QUICK_SPAN_VALUES = Object.freeze([7, 14, 30, 90]);
const MAX_CALENDAR_RANGE_DAYS = 360;

export function createStreamHistoryPanel(t) {
  const chartEl = ref(null);
  const sparklineEl = ref(null);
  const period = ref('day');
  const span = ref(30);
  const mode = ref('candle');
  const filterQuick = ref('day');
  const filterQuickSpan = ref(30);
  const claimid = ref('');
  const initialClaimid = ref('');
  const saving = ref(false);
  const showClearModal = ref(false);
  const showClaimChangeModal = ref(false);
  const clearBusy = ref(false);
  const perf = ref({
    range: { hoursStreamed: 0, avgViewers: 0, peakViewers: 0, hoursWatched: 0, activeDays: 0 },
    allTime: { totalHoursStreamed: 0, highestViewers: 0 },
  });
  const recentStreams = ref([]);
  const status = ref({
    connected: false,
    live: false,
    sampleCount: 0,
    lastSampleTs: null,
    avgSampleIntervalSec: null,
    latestSampleIntervalSec: null,
  });
  const anyModalOpen = computed(() => showClearModal.value || showClaimChangeModal.value);
  const overlayCollapsed = ref(false);
  const OVERLAY_KEY = 'streamHistory.overlayCollapsed';
  const EARNINGS_HIDE_KEY = 'streamHistory.earningsHidden';
  const GOAL_KEY = 'streamHistory.dailyGoalHours';
  const TREND_KEY = 'streamHistory.viewerTrendVisible';
  const NOW_TICK_INTERVAL = 30000;
  const showViewers = ref(false);
  const totalAR = ref(0);
  const arUsd = ref(null);
  const earningsHidden = ref(false);
  const lastSummaryData = ref([]);
  const customRange = ref({ startDate: null, endDate: null });
  const customRangeActive = computed(() => {
    const { startDate, endDate } = customRange.value || {};
    return !!(startDate && endDate);
  });
  const TZ_KEY = 'streamHistory.tzOffset';
  const tzOffsetMinutes = ref(-new Date().getTimezoneOffset());
  const effectiveTzOffset = ref(tzOffsetMinutes.value);
  const previousTzOffset = ref(null);
  const tzChangeVisible = ref(false);
  const goalHours = ref(6);
  const showViewerTrend = ref(true);
  const peakSessionSummary = ref('');
  const nowTick = ref(Date.now());
  const lastStream = computed(() => {
    const arr = Array.isArray(recentStreams.value) ? recentStreams.value : [];
    return arr.length ? arr[arr.length - 1] : null;
  });
  const previousStream = computed(() => {
    const arr = Array.isArray(recentStreams.value) ? recentStreams.value : [];
    return arr.length >= 2 ? arr[arr.length - 2] : null;
  });
  const streamComparisons = computed(() => {
    const current = lastStream.value;
    const prev = previousStream.value;
    const hasCurrent = !!current;
    const hasPrev = !!prev;
    const toNumber = (val) => {
      const num = Number(val);
      return Number.isFinite(num) ? num : 0;
    };
    const delta = (curVal, prevVal) => (hasPrev ? toNumber(curVal) - toNumber(prevVal) : null);

    return {
      hasCurrent,
      hasPrevious: hasPrev,
      durationHours: hasCurrent ? toNumber(current.durationHours) : 0,
      durationDiffHours: delta(current?.durationHours, prev?.durationHours),
      avgViewers: hasCurrent ? toNumber(current.avgViewers) : 0,
      avgViewersDiff: delta(current?.avgViewers, prev?.avgViewers),
      peakViewers: hasCurrent ? toNumber(current.peakViewers) : 0,
      peakViewersDiff: delta(current?.peakViewers, prev?.peakViewers),
      viewerHours: hasCurrent ? toNumber(current.viewerHours) : 0,
      viewerHoursDiff: delta(current?.viewerHours, prev?.viewerHours),
      activeDayKey: current?.activeDayKey || null,
      activeDayDiff: hasPrev
        ? current?.activeDayKey && prev?.activeDayKey && current.activeDayKey !== prev.activeDayKey
          ? 1
          : 0
        : null,
      totalHoursDiff: hasPrev ? toNumber(current?.durationHours) : null,
      highestViewersDiff: delta(current?.peakViewers, prev?.peakViewers),
    };
  });
  const tzDisplay = computed(() => {
    const off = effectiveTzOffset.value;
    const sign = off >= 0 ? '+' : '-';
    const abs = Math.abs(off);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `UTC${sign}${hh}:${mm}`;
  });
  const currentPhysicalTzDisplay = computed(() => {
    const off = tzOffsetMinutes.value;
    const sign = off >= 0 ? '+' : '-';
    const abs = Math.abs(off);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `UTC${sign}${hh}:${mm}`;
  });
  const previousTzDisplay = computed(() => {
    if (previousTzOffset.value == null) return '';
    const off = previousTzOffset.value;
    const sign = off >= 0 ? '+' : '-';
    const abs = Math.abs(off);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `UTC${sign}${hh}:${mm}`;
  });
  const tzOffsetShort = computed(() => {
    try {
      const val = tzDisplay.value || '';
      return val.startsWith('UTC') ? val.slice(3) : val;
    } catch {
      return '';
    }
  });

  const sampleCount = computed(() => Number(status.value.sampleCount || 0));
  const sparklineAvailable = computed(() =>
    (lastSummaryData.value || []).some((item) => Number(item?.avgViewers || 0) > 0)
  );

  function formatSeconds(value) {
    const seconds = Number(value || 0);
    if (!isFinite(seconds) || seconds <= 0) return '';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  }

  function formatAgo(ms) {
    const diffMs = Number(ms || 0);
    if (!isFinite(diffMs) || diffMs < 0) return '';
    if (diffMs < 45000)
      return t('streamHistoryAgoSeconds', { value: Math.max(1, Math.round(diffMs / 1000)) });
    if (diffMs < 90 * 60000)
      return t('streamHistoryAgoMinutes', { value: Math.max(1, Math.round(diffMs / 60000)) });
    if (diffMs < 36 * 3600000)
      return t('streamHistoryAgoHours', { value: Math.max(1, Math.round(diffMs / 3600000)) });
    return t('streamHistoryAgoDays', { value: Math.max(1, Math.round(diffMs / 86400000)) });
  }

  const samplingCaption = computed(() => {
    const cadenceSec = Number(status.value.avgSampleIntervalSec || 0);
    const lastTs = Number(status.value.lastSampleTs || 0);
    const cadenceStr = cadenceSec > 0 ? formatSeconds(cadenceSec) : '';
    const ageStr = lastTs > 0 ? formatAgo(nowTick.value - lastTs) : '';
    if (cadenceStr && ageStr)
      return t('streamHistorySamplingCaption', { cadence: cadenceStr, ago: ageStr });
    if (cadenceStr) return t('streamHistorySamplingCadenceOnly', { cadence: cadenceStr });
    if (ageStr) return t('streamHistorySamplingLastOnly', { ago: ageStr });
    return '';
  });

  const buildPeakCandidate = (data = []) => {
    try {
      const display = buildDisplayData(data) || [];
      let candidate = null;
      for (const entry of display) {
        if (!entry) continue;
        const hours = Number(entry.hours || 0);
        if (!Number.isFinite(hours) || hours <= 0) continue;
        if (!candidate || hours > candidate.hours) {
          candidate = {
            hours,
            avgViewers: Number(entry.avgViewers || 0),
          };
        }
      }
      return candidate;
    } catch {
      return null;
    }
  };

  const formatPeakSummary = (candidate) => {
    if (!candidate || !candidate.hours || candidate.hours <= 0) return '';
    const viewersRounded = Math.max(0, Math.round(Number(candidate.avgViewers || 0)));
    try {
      if (viewersRounded > 0) {
        return t('chartTopSessionBadge', {
          hours: formatHours(candidate.hours),
          viewers: viewersRounded,
        });
      }
      return t('chartTopSessionBadgeNoViewers', {
        hours: formatHours(candidate.hours),
      });
    } catch {
      try {
        return `Top session: ${formatHours(candidate.hours)}`;
      } catch {
        return '';
      }
    }
  };

  const toLocalYMD = (dateObj) => {
    if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return null;
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const normalizeDateRange = (range = []) => {
    if (!Array.isArray(range) || range.length < 2) return null;
    const [a, b] = range;
    if (!(a instanceof Date) || !(b instanceof Date)) return null;
    const start = a.getTime() <= b.getTime() ? a : b;
    const end = a.getTime() <= b.getTime() ? b : a;
    const startIso = toLocalYMD(start);
    const endIso = toLocalYMD(end);
    if (!startIso || !endIso) return null;
    return { startDate: startIso, endDate: endIso, start, end };
  };

  const calcDaySpan = (start, end) => {
    if (!(start instanceof Date) || !(end instanceof Date)) return 0;
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    const diff = Math.max(0, endUtc - startUtc);
    return Math.floor(diff / 86400000) + 1;
  };

  function applyCustomRange(range) {
    const normalized = normalizeDateRange(range);
    if (!normalized) return;
    const { startDate, endDate, start, end } = normalized;
    customRange.value = { startDate, endDate };
    filterQuick.value = 'custom';
    const totalDays = calcDaySpan(start, end);
    if (totalDays <= 120) {
      period.value = 'day';
      span.value = Math.min(MAX_CALENDAR_RANGE_DAYS, totalDays);
    } else {
      period.value = 'week';
      span.value = Math.min(MAX_CALENDAR_RANGE_DAYS, Math.ceil(totalDays / 7));
    }
    scheduleRefresh(true);
  }

  function applyRangeFromResponse(range) {
    if (!range || typeof range !== 'object') return;
    const startDate = typeof range.startDate === 'string' ? range.startDate : null;
    const endDate = typeof range.endDate === 'string' ? range.endDate : null;
    if (startDate && endDate) {
      customRange.value = { startDate, endDate };
    }
  }

  function clearCustomRange(autoRefresh = true) {
    if (!customRangeActive.value) return;
    customRange.value = { startDate: null, endDate: null };
    if (filterQuick.value === 'custom') filterQuick.value = period.value;
    if (autoRefresh) scheduleRefresh(true);
  }

  let ro = null;
  let resizeTimer = null;
  let resizeRaf = null;
  let refreshDebounceTimer = null;
  let pollTimer = null;
  let nowTimer = null;
  const REFRESH_DEBOUNCE_MS = 150;

  function setScrollLock(lock) {
    try {
      const el = document.documentElement;
      const body = document.body;
      if (lock) {
        el.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
      } else {
        el.style.overflow = '';
        body.style.overflow = '';
      }
    } catch {}
  }
  function onKeydown(e) {
    try {
      if (e.key === 'Escape' && anyModalOpen.value && !clearBusy.value) {
        showClearModal.value = false;
        showClaimChangeModal.value = false;
      }
    } catch {}
  }
  watch(anyModalOpen, (open) => {
    setScrollLock(open);
    try {
      if (open) window.addEventListener('keydown', onKeydown);
      else window.removeEventListener('keydown', onKeydown);
    } catch {}
  });

  onUnmounted(() => {
    setScrollLock(false);
    try {
      window.removeEventListener('keydown', onKeydown);
    } catch {}
    try {
      if (ro && ro.disconnect) ro.disconnect();
    } catch {}
    try {
      if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
    } catch {}
    try {
      if (nowTimer) {
        clearInterval(nowTimer);
        nowTimer = null;
      }
    } catch {}
    try {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    } catch {}
  });

  async function loadConfig() {
    try {
      const r = await api.get('/config/stream-history-config.json');
      claimid.value = r?.data?.claimid || '';
      initialClaimid.value = claimid.value;
    } catch {}
  }

  async function saveConfig() {
    try {
      saving.value = true;
      const changed = (claimid.value || '') !== (initialClaimid.value || '');
      await api.post('/config/stream-history-config.json', { claimid: claimid.value });
      try {
        pushToast({ type: 'success', message: t('savedStreamHistory') });
      } catch {}
      if (changed) showClaimChangeModal.value = true;
      initialClaimid.value = claimid.value;
      await refresh();
    } catch (e) {
      const msg =
        e && e.response && e.response.data && e.response.data.error === 'session_required'
          ? t('sessionRequiredToast')
          : t('saveFailedStreamHistory');
      try {
        pushToast({ type: 'error', message: msg });
      } catch {}
    } finally {
      saving.value = false;
    }
  }

  async function refresh() {
    try {
      const tz = effectiveTzOffset.value;
      const params = new URLSearchParams({
        period: period.value,
        span: span.value,
        tz,
      });
      if (customRangeActive.value && customRange.value?.startDate && customRange.value?.endDate) {
        params.set('startDate', customRange.value.startDate);
        params.set('endDate', customRange.value.endDate);
      }
      const query = params.toString();
      const summaryUrl = `/api/stream-history/summary?${query}`;
      const perfUrl = `/api/stream-history/performance?${query}`;
      const r = await api.get(summaryUrl);
      lastSummaryData.value = r?.data?.data || [];
      if (customRangeActive.value && r?.data?.appliedRange) {
        applyRangeFromResponse(r.data.appliedRange);
      }
      renderCharts(lastSummaryData.value);
      const p = await api.get(perfUrl);
      if (customRangeActive.value && p?.data?.appliedRange) {
        applyRangeFromResponse(p.data.appliedRange);
      }
      if (p?.data) {
        perf.value = {
          range: p.data.range,
          allTime: p.data.allTime,
        };
        recentStreams.value = Array.isArray(p.data.recentStreams) ? p.data.recentStreams : [];
      }
      try {
        const pr = await api.get('/api/ar-price');
        arUsd.value = pr?.data?.arweave?.usd || arUsd.value;
      } catch {}
      try {
        const er = await api.get('/api/last-tip/earnings');
        totalAR.value = Number(er?.data?.totalAR || 0);
      } catch {}
      try {
        const sr = await api.get('/api/stream-history/status');
        if (sr?.data) {
          const toNumberOrNull = (val) => {
            const num = Number(val);
            return Number.isFinite(num) ? num : null;
          };
          status.value = {
            connected: !!sr.data.connected,
            live: !!sr.data.live,
            sampleCount: Number(sr.data.sampleCount || 0),
            lastSampleTs: toNumberOrNull(sr.data.lastSampleTs),
            avgSampleIntervalSec: toNumberOrNull(sr.data.avgSampleIntervalSec),
            latestSampleIntervalSec: toNumberOrNull(sr.data.latestSampleIntervalSec),
          };
        }
      } catch {}
    } catch {
      renderCharts([]);
    }
  }

  function scheduleRefresh(immediate = false) {
    try {
      if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
    } catch {}
    if (immediate) {
      refresh();
      return;
    }
    refreshDebounceTimer = setTimeout(() => {
      refresh();
    }, REFRESH_DEBOUNCE_MS);
  }

  function onQuickFilterChange() {
    try {
      if (filterQuick.value === 'custom') {
        return;
      }
      if (['day', 'week', 'month', 'year'].includes(filterQuick.value)) {
        if (customRangeActive.value) customRange.value = { startDate: null, endDate: null };
        period.value = filterQuick.value;
        scheduleRefresh();
      }
    } catch {}
  }
  function onQuickRangeChange() {
    try {
      const v = Number(filterQuickSpan.value || 30);
      if (QUICK_SPAN_VALUES.includes(v)) {
        if (customRangeActive.value) customRange.value = { startDate: null, endDate: null };
        span.value = v;
        scheduleRefresh();
      }
    } catch {}
  }
  function clearHistory() {
    showClearModal.value = true;
  }
  async function confirmClear() {
    try {
      clearBusy.value = true;
      await api.post('/api/stream-history/clear');
      await refresh();
      showClearModal.value = false;
      try {
        pushToast({ type: 'success', message: t('streamHistoryCleared') });
      } catch {}
    } catch {
      try {
        pushToast({ type: 'error', message: t('streamHistoryClearFailed') });
      } catch {}
    } finally {
      clearBusy.value = false;
    }
  }
  async function confirmClearAfterClaimChange() {
    try {
      clearBusy.value = true;
      await api.post('/api/stream-history/clear');
      await refresh();
      showClaimChangeModal.value = false;
      try {
        pushToast({ type: 'success', message: t('streamHistoryCleared') });
      } catch {}
    } catch {
      try {
        pushToast({ type: 'error', message: t('streamHistoryClearFailed') });
      } catch {}
    } finally {
      clearBusy.value = false;
    }
  }
  async function downloadExport() {
    try {
      let text = '';
      try {
        const resp = await api.get('/api/stream-history/export', {
          responseType: 'text',
          transformResponse: [(r) => r],
        });
        text =
          typeof resp?.data === 'string' ? resp.data : JSON.stringify(resp?.data || {}, null, 2);
      } catch (e) {
        try {
          const r = await fetch('/api/stream-history/export', { cache: 'no-cache' });
          if (!r.ok) throw new Error('export_failed');
          text = await r.text();
        } catch {
          throw e;
        }
      }
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `stream-history-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      try {
        pushToast({ type: 'error', message: t('streamHistoryExportFailed') });
      } catch {}
    }
  }
  async function onImport(e) {
    try {
      const file = e?.target?.files?.[0];
      if (!file) return;
      const text = await file.text();
      const json = JSON.parse(text);
      await api.post('/api/stream-history/import', json);
      await refresh();
      try {
        pushToast({ type: 'success', message: t('streamHistoryImported') });
      } catch {}
    } catch {
      try {
        pushToast({ type: 'error', message: t('streamHistoryImportFailed') });
      } catch {}
    } finally {
      try {
        e.target.value = '';
      } catch {}
    }
  }
  function toggleEarningsHidden() {
    earningsHidden.value = !earningsHidden.value;
  }

  watch([mode, period, span], () => {
    scheduleRefresh();
  });
  watch(period, (p) => {
    if (!['day', 'week', 'month', 'year'].includes(p)) return;
    if (customRangeActive.value) return;
    filterQuick.value = p;
  });
  watch(span, (s) => {
    if (customRangeActive.value) return;
    const num = Number(s);
    if (QUICK_SPAN_VALUES.includes(num)) filterQuickSpan.value = num;
  });
  watch(customRangeActive, (active) => {
    if (active) {
      filterQuick.value = 'custom';
    } else if (filterQuick.value === 'custom') {
      filterQuick.value = period.value;
    }
  });
  watch(overlayCollapsed, (v) => {
    try {
      localStorage.setItem(OVERLAY_KEY, v ? '1' : '0');
    } catch {}
  });

  watch(
    () => Number(status.value.sampleCount || 0),
    (count, prev) => {
      if (!Number.isFinite(count) || count <= 0) return;
      if (!Number.isFinite(prev) || count > prev) {
        scheduleRefresh(true);
      }
    }
  );
  watch(
    () => status.value.live,
    (live, prev) => {
      if (prev == null || live === prev) return;
      scheduleRefresh(true);
    }
  );
  watch(showViewers, () => {
    try {
      renderCharts(lastSummaryData.value || []);
    } catch {}
  });
  watch(goalHours, (val) => {
    let safe = Number(val);
    if (!Number.isFinite(safe) || safe < 0) safe = 0;
    if (safe !== val) {
      goalHours.value = safe;
      return;
    }
    try {
      localStorage.setItem(GOAL_KEY, JSON.stringify({ value: safe }));
    } catch {}
    try {
      renderCharts(lastSummaryData.value || []);
    } catch {}
  });
  watch(showViewerTrend, (val) => {
    try {
      localStorage.setItem(TREND_KEY, val ? '1' : '0');
    } catch {}
    try {
      renderCharts(lastSummaryData.value || []);
    } catch {}
  });

  function renderCharts(data) {
    let peakFromChart = null;
    try {
      const result = renderStreamHistoryChart(chartEl.value, data, {
        mode: mode.value,
        period: period.value,
        showViewers: !!showViewers.value,
        smoothWindow: 5,
        goalHours: Number(goalHours.value || 0),
      });
      peakFromChart = result && result.peak ? result.peak : null;
    } catch {
      peakFromChart = null;
    }
    try {
      const bounds = chartEl.value?.getBoundingClientRect();
      if (bounds && chartEl.value) {
        chartEl.value.dataset.lastWidth = String(Math.round(bounds.width));
        chartEl.value.dataset.lastHeight = String(Math.round(bounds.height));
      }
    } catch {}
    try {
      if (showViewerTrend.value && sparklineEl.value) {
        renderViewersSparkline(sparklineEl.value, data, {
          period: period.value,
          smoothWindow: 5,
        });
      } else if (sparklineEl.value) {
        sparklineEl.value.innerHTML = '';
      }
    } catch {}
    const fallbackCandidate = peakFromChart || buildPeakCandidate(data);
    peakSessionSummary.value = formatPeakSummary(fallbackCandidate);
  }
  function toggleShowViewers() {
    showViewers.value = !showViewers.value;
  }

  function queueChartReflow() {
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 16);
    const caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout;
    try {
      if (resizeRaf) caf(resizeRaf);
    } catch {}
    resizeRaf = raf(() => {
      resizeRaf = null;
      try {
        chartEl.value?.classList.add('reflowing');
      } catch {}
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        try {
          renderCharts(lastSummaryData.value || []);
        } catch {}
        try {
          setTimeout(() => chartEl.value?.classList.remove('reflowing'), 120);
        } catch {}
      }, 60);
    });
  }

  onMounted(async () => {
    try {
      const v = localStorage.getItem(OVERLAY_KEY);
      if (v === '1' || v === '0') overlayCollapsed.value = v === '1';
    } catch {}
    try {
      const h = localStorage.getItem(EARNINGS_HIDE_KEY);
      if (h === '1' || h === '0') earningsHidden.value = h === '1';
    } catch {}
    try {
      const savedGoal = JSON.parse(localStorage.getItem(GOAL_KEY) || 'null');
      if (savedGoal && typeof savedGoal.value === 'number' && isFinite(savedGoal.value)) {
        goalHours.value = Math.max(0, savedGoal.value);
      }
    } catch {}
    try {
      const trendPref = localStorage.getItem(TREND_KEY);
      if (trendPref === '0' || trendPref === '1') showViewerTrend.value = trendPref === '1';
    } catch {}
    try {
      if (!nowTimer)
        nowTimer = setInterval(() => {
          nowTick.value = Date.now();
        }, NOW_TICK_INTERVAL);
    } catch {}
    await loadConfig();
    try {
      const stored = localStorage.getItem(TZ_KEY);
      if (stored != null && stored !== '') {
        const parsed = Number(stored);
        if (Number.isFinite(parsed) && Math.abs(parsed) <= 840) {
          effectiveTzOffset.value = parsed;
          if (parsed !== tzOffsetMinutes.value) {
            previousTzOffset.value = parsed;
            tzChangeVisible.value = true;
          }
        }
      } else {
        localStorage.setItem(TZ_KEY, String(effectiveTzOffset.value));
      }
    } catch {}
    await refresh();
    try {
      const el = chartEl.value;
      if (el && typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver((entries = []) => {
          const entry = entries[0];
          const target = entry?.target || chartEl.value;
          if (!target) return;
          const width = Math.round(entry?.contentRect?.width || target.clientWidth || 0);
          const height = Math.round(entry?.contentRect?.height || target.clientHeight || 0);
          const prevW = Number(target.dataset.lastWidth || 0);
          const prevH = Number(target.dataset.lastHeight || 0);
          if (Math.abs(prevW - width) < 2 && Math.abs(prevH - height) < 2) return;
          queueChartReflow();
        });
        ro.observe(el);
      } else {
        const onR = () => {
          queueChartReflow();
        };
        window.addEventListener('resize', onR);
        ro = {
          disconnect() {
            try {
              window.removeEventListener('resize', onR);
            } catch {}
          },
        };
      }
    } catch {}
    async function pollStatus() {
      try {
        const r = await api.get('/api/stream-history/status', { timeout: 4000 });
        const data = r?.data || {};
        const toNumberOrNull = (val) => {
          const num = Number(val);
          return Number.isFinite(num) ? num : null;
        };
        status.value = {
          connected: !!data.connected,
          live: !!data.live,
          sampleCount: Number(data.sampleCount || 0),
          lastSampleTs: toNumberOrNull(data.lastSampleTs),
          avgSampleIntervalSec: toNumberOrNull(data.avgSampleIntervalSec),
          latestSampleIntervalSec: toNumberOrNull(data.latestSampleIntervalSec),
        };
      } catch {}
      pollTimer = setTimeout(pollStatus, 5000);
    }
    pollStatus();
  });

  function acceptNewTimezone() {
    try {
      previousTzOffset.value = effectiveTzOffset.value;
      effectiveTzOffset.value = tzOffsetMinutes.value;
      localStorage.setItem(TZ_KEY, String(effectiveTzOffset.value));
      tzChangeVisible.value = false;
      scheduleRefresh(true);
      try {
        pushToast({ type: 'success', message: t('streamHistoryUseNewTz') });
      } catch {}
    } catch {}
  }
  function keepPreviousTimezone() {
    try {
      tzChangeVisible.value = false;
      localStorage.setItem(TZ_KEY, String(effectiveTzOffset.value));
      try {
        pushToast({ type: 'info', message: t('streamHistoryKeepPrevTz') });
      } catch {}
    } catch {}
  }
  function forceRefreshTimezone() {
    try {
      tzOffsetMinutes.value = -new Date().getTimezoneOffset();
      if (tzOffsetMinutes.value !== effectiveTzOffset.value) {
        previousTzOffset.value = effectiveTzOffset.value;
        tzChangeVisible.value = true;
      }
    } catch {}
  }

  function dispose() {
    try {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    } catch {}
    try {
      if (refreshDebounceTimer) {
        clearTimeout(refreshDebounceTimer);
        refreshDebounceTimer = null;
      }
    } catch {}
    try {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
        resizeTimer = null;
      }
    } catch {}
    try {
      if (resizeRaf) {
        const caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout;
        caf(resizeRaf);
        resizeRaf = null;
      }
    } catch {}
    try {
      if (nowTimer) {
        clearInterval(nowTimer);
        nowTimer = null;
      }
    } catch {}
    try {
      if (ro && ro.disconnect) {
        ro.disconnect();
        ro = null;
      }
    } catch {}
  }

  return {
    chartEl,
    sparklineEl,
    period,
    span,
    mode,
    filterQuick,
    filterQuickSpan,
    claimid,
    saving,
    showClearModal,
    showClaimChangeModal,
    clearBusy,
    perf,
    status,
    overlayCollapsed,
    totalAR,
    arUsd,
    earningsHidden,
    lastSummaryData,
    recentStreams,
    lastStream,
    previousStream,
    streamComparisons,
    customRange,
    customRangeActive,
    initialClaimid,
    showViewers,
    tzDisplay,
    tzOffsetShort,
    tzChangeVisible,
    previousTzDisplay,
    currentPhysicalTzDisplay,
    goalHours,
    samplingCaption,
    showViewerTrend,
    sparklineAvailable,
    peakSessionSummary,
    acceptNewTimezone,
    keepPreviousTimezone,
    forceRefreshTimezone,
    saveConfig,
    refresh,
    onQuickFilterChange,
    onQuickRangeChange,
    clearHistory,
    confirmClear,
    confirmClearAfterClaimChange,
    downloadExport,
    onImport,
    toggleEarningsHidden,
    applyCustomRange,
    clearCustomRange,
    toggleShowViewers,
    dispose,
    fmtHours: formatHours,
    fmtTotal: formatTotalHours,
    usdFromAr,
    sampleCount,
  };
}

export default createStreamHistoryPanel;

if (typeof module !== 'undefined' && module?.exports) {
  module.exports = { createStreamHistoryPanel };
}
