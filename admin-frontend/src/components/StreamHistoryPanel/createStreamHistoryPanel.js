import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import api from '../../services/api';
import { pushToast } from '../../services/toast';
import { formatHours, formatTotalHours, usdFromAr } from './utils/streamHistoryUtils.js';
import { renderStreamHistoryChart } from './utils/renderChart.js';

export function createStreamHistoryPanel(t) {
  const chartEl = ref(null);
  const period = ref('day');
  const span = ref(30);
  const mode = ref('line');
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
  const status = ref({ connected: false, live: false, sampleCount: 0 });
  const backfillDismissed = ref(false);
  const showBackfill = computed(
    () => status.value.live && !backfillDismissed.value && period.value === 'day' && Number(perf.value?.range?.hoursStreamed || 0) < 2,
  );
  const anyModalOpen = computed(() => showClearModal.value || showClaimChangeModal.value);
  const overlayCollapsed = ref(false);
  const OVERLAY_KEY = 'streamHistory.overlayCollapsed';
  const EARNINGS_HIDE_KEY = 'streamHistory.earningsHidden';
  const showViewers = ref(true);
  const totalAR = ref(0);
  const arUsd = ref(null);
  const earningsHidden = ref(false);
  const lastSummaryData = ref([]);
  const menuOpen = ref(false);
  const overlayMenuEl = ref(null);
  const TZ_KEY = 'streamHistory.tzOffset';
  const tzOffsetMinutes = ref(-new Date().getTimezoneOffset());
  const effectiveTzOffset = ref(tzOffsetMinutes.value);
  const previousTzOffset = ref(null);
  const tzChangeVisible = ref(false);
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
  const tzOffsetShort = computed(() => { try { const val = tzDisplay.value || ''; return val.startsWith('UTC') ? val.slice(3) : val; } catch { return ''; } });

  const compactModalOpen = ref(false);
  const compactBusy = ref(false);
  const compactDryBusy = ref(false);
  const compactPreview = ref(null);
  const compactIntervalMinutes = ref(10);
  const recommendedThreshold = 5000;
  const sampleCount = computed(() => Number(status.value.sampleCount || 0));
  const compactionRecommended = computed(() => sampleCount.value > recommendedThreshold);
  const compactionSavingsPercent = computed(() => {
    if (!compactPreview.value) return 0;
    const b = compactPreview.value.before || 0; const a = compactPreview.value.after || 0;
    if (b <= 0 || a >= b) return 0;
    return Math.round(((b - a) / b) * 100);
  });

  let clickAwayHandler = null; let ro = null; let resizeTimer = null; let refreshDebounceTimer = null; let pollTimer = null;
  const REFRESH_DEBOUNCE_MS = 150;

  function setScrollLock(lock) {
    try { const el = document.documentElement; const body = document.body; if (lock) { el.style.overflow = 'hidden'; body.style.overflow = 'hidden'; } else { el.style.overflow=''; body.style.overflow=''; } } catch {}
  }
  function onKeydown(e) { try { if (e.key === 'Escape' && (anyModalOpen.value || compactModalOpen.value) && !clearBusy.value && !compactBusy.value && !compactDryBusy.value) { showClearModal.value = false; showClaimChangeModal.value = false; compactModalOpen.value = false; } } catch {} }
  watch(anyModalOpen, (open) => { setScrollLock(open || compactModalOpen.value); try { if (open) window.addEventListener('keydown', onKeydown); else if (!compactModalOpen.value) window.removeEventListener('keydown', onKeydown); } catch {} });
  watch(compactModalOpen, (open) => { setScrollLock(open || anyModalOpen.value); try { if (open) window.addEventListener('keydown', onKeydown); else if (!anyModalOpen.value) window.removeEventListener('keydown', onKeydown); } catch {} });

  onUnmounted(() => { setScrollLock(false); try { window.removeEventListener('keydown', onKeydown); } catch {}; try { if (ro && ro.disconnect) ro.disconnect(); } catch {}; try { if (clickAwayHandler) document.removeEventListener('click', clickAwayHandler, true); } catch {}; try { if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer); } catch {} });

  async function loadConfig() { try { const r = await api.get('/config/stream-history-config.json'); claimid.value = r?.data?.claimid || ''; initialClaimid.value = claimid.value; } catch {} }

  async function saveConfig() {
    try {
      saving.value = true; const changed = (claimid.value || '') !== (initialClaimid.value || '');
  await api.post('/config/stream-history-config.json', { claimid: claimid.value });
      try { pushToast({ type: 'success', message: t('savedStreamHistory') }); } catch {}
      if (changed) showClaimChangeModal.value = true; initialClaimid.value = claimid.value; await refresh();
    } catch (e) {
      const msg = (e && e.response && e.response.data && e.response.data.error === 'session_required') ? t('sessionRequiredToast') : t('saveFailedStreamHistory');
      try { pushToast({ type: 'error', message: msg }); } catch {}
    } finally { saving.value = false; }
  }

  async function refresh() {
    try {
      const tz = effectiveTzOffset.value;
  const r = await api.get(`/api/stream-history/summary?period=${encodeURIComponent(period.value)}&span=${span.value}&tz=${tz}`);
      lastSummaryData.value = r?.data?.data || [];
      renderChart(lastSummaryData.value);
  const p = await api.get(`/api/stream-history/performance?period=${encodeURIComponent(period.value)}&span=${span.value}&tz=${tz}`);
      perf.value = p?.data ? { range: p.data.range, allTime: p.data.allTime } : perf.value;
  try { const pr = await api.get('/api/ar-price'); arUsd.value = pr?.data?.arweave?.usd || arUsd.value; } catch {}
  try { const er = await api.get('/api/last-tip/earnings'); totalAR.value = Number(er?.data?.totalAR || 0); } catch {}
  try { const sr = await api.get('/api/stream-history/status'); if (sr?.data) { status.value = { connected: !!sr.data.connected, live: !!sr.data.live, sampleCount: Number(sr.data.sampleCount || 0) }; } } catch {}
    } catch { renderChart([]); }
  }

  function scheduleRefresh(immediate = false) { try { if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer); } catch {}; if (immediate) { refresh(); return; } refreshDebounceTimer = setTimeout(() => { refresh(); }, REFRESH_DEBOUNCE_MS); }

  function onQuickFilterChange() { try { if (['day','week','month','year'].includes(filterQuick.value)) { period.value = filterQuick.value; scheduleRefresh(); } } catch {} }
  function onQuickRangeChange() { try { const v = Number(filterQuickSpan.value || 30); if ([7,14,30,90,180,365].includes(v)) { span.value = v; scheduleRefresh(); } } catch {} }
  function clearHistory() { showClearModal.value = true; }
  async function confirmClear() { try { clearBusy.value = true; await api.post('/api/stream-history/clear'); await refresh(); showClearModal.value = false; try { pushToast({ type: 'success', message: t('streamHistoryCleared') }); } catch {} } catch { try { pushToast({ type: 'error', message: t('streamHistoryClearFailed') }); } catch {} } finally { clearBusy.value = false; } }
  async function confirmClearAfterClaimChange() { try { clearBusy.value = true; await api.post('/api/stream-history/clear'); await refresh(); showClaimChangeModal.value = false; try { pushToast({ type: 'success', message: t('streamHistoryCleared') }); } catch {} } catch { try { pushToast({ type: 'error', message: t('streamHistoryClearFailed') }); } catch {} } finally { clearBusy.value = false; } }
  async function downloadExport() {
    try {
      let text = '';
      try {
        const resp = await api.get('/api/stream-history/export', { responseType: 'text', transformResponse: [r => r] });
        text = typeof resp?.data === 'string' ? resp.data : JSON.stringify(resp?.data || {}, null, 2);
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
      try { pushToast({ type: 'error', message: t('streamHistoryExportFailed') }); } catch {}
    }
  }
  async function onImport(e) { try { const file = e?.target?.files?.[0]; if (!file) return; const text = await file.text(); const json = JSON.parse(text); await api.post('/api/stream-history/import', json); await refresh(); try { pushToast({ type: 'success', message: t('streamHistoryImported') }); } catch {} } catch { try { pushToast({ type: 'error', message: t('streamHistoryImportFailed') }); } catch {} } finally { try { e.target.value = ''; } catch {} } }
  function toggleMenu() { menuOpen.value = !menuOpen.value; }
  function onBackfillClick(h) { menuOpen.value = false; backfill(h); }
  function onBackfillDismiss() { menuOpen.value = false; backfillDismissed.value = true; }
  function toggleEarningsHidden() { earningsHidden.value = !earningsHidden.value; }

  watch([mode, period, span], () => { scheduleRefresh(); });
  watch(period, (p) => { if (['day','week','month','year'].includes(p)) filterQuick.value = p; });
  watch(span, (s) => { if ([7,14,30,90,180,365].includes(Number(s))) filterQuickSpan.value = Number(s); });
  watch(overlayCollapsed, (v) => { try { localStorage.setItem(OVERLAY_KEY, v ? '1':'0'); } catch {} });
  watch(earningsHidden, (v) => { try { localStorage.setItem(EARNINGS_HIDE_KEY, v ? '1':'0'); } catch {} });
  watch(() => status.value.sampleCount, () => { /* could add heuristics here */ });
  watch(showViewers, () => { try { renderChart(lastSummaryData.value || []); } catch {} });

  function renderChart(data) { try { renderStreamHistoryChart(chartEl.value, data, { mode: mode.value, period: period.value, showViewers: !!showViewers.value, smoothWindow: 5 }); } catch {} }
  function toggleShowViewers() { showViewers.value = !showViewers.value; }
  async function backfill(hours) { try { await api.post('/api/stream-history/backfill-current', { hours }); await refresh(); try { pushToast({ type: 'success', message: t('streamHistoryBackfilled') }); } catch {} }
    catch { try { pushToast({ type: 'error', message: t('streamHistoryBackFillFailed') }); } catch {} } }

  function openCompactModal() { compactModalOpen.value = true; compactPreview.value = null; }
  function closeCompactModal() { if (compactBusy.value || compactDryBusy.value) return; compactModalOpen.value = false; }
  async function previewCompaction() {
    try {
      compactDryBusy.value = true; compactPreview.value = null;
  const r = await api.post('/api/stream-history/compact', { dryRun: true, maxIntervalSeconds: Math.max(60, Number(compactIntervalMinutes.value) * 60) });
      if (r?.data) {
        compactPreview.value = { before: r.data.before, after: r.data.after, synthetic: r.data.synthetic };
        try { pushToast({ type: 'info', message: t('streamHistoryCompactPreviewReady') }); } catch {}
      }
    } catch { try { pushToast({ type: 'error', message: t('streamHistoryCompactError') }); } catch {} }
    finally { compactDryBusy.value = false; }
  }
  async function runCompaction() {
    try {
      compactBusy.value = true;
  const r = await api.post('/api/stream-history/compact', { dryRun: false, maxIntervalSeconds: Math.max(60, Number(compactIntervalMinutes.value) * 60) });
      if (r?.data) {
        try { pushToast({ type: 'success', message: t('streamHistoryCompactSuccess') }); } catch {}
        compactPreview.value = { before: r.data.before, after: r.data.after, synthetic: r.data.synthetic };
        await refresh();
      }
    } catch { try { pushToast({ type: 'error', message: t('streamHistoryCompactError') }); } catch {} }
    finally { compactBusy.value = false; }
  }

  onMounted(async () => {
    try { const v = localStorage.getItem(OVERLAY_KEY); if (v==='1'||v==='0') overlayCollapsed.value = (v==='1'); } catch {}
    try { const h = localStorage.getItem(EARNINGS_HIDE_KEY); if (h==='1'||h==='0') earningsHidden.value = (h==='1'); } catch {}
    await loadConfig();
    try { const stored = localStorage.getItem(TZ_KEY); if (stored != null && stored !== '') { const parsed = Number(stored); if (Number.isFinite(parsed) && Math.abs(parsed) <= 840) { effectiveTzOffset.value = parsed; if (parsed !== tzOffsetMinutes.value) { previousTzOffset.value = parsed; tzChangeVisible.value = true; } } } else { localStorage.setItem(TZ_KEY, String(effectiveTzOffset.value)); } } catch {}
    await refresh();
    try { const el = chartEl.value; if (el && typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => { try { chartEl.value?.classList.add('reflowing'); } catch {} if (resizeTimer) clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { try { renderChart(lastSummaryData.value || []); } catch {} try { setTimeout(()=>chartEl.value?.classList.remove('reflowing'),120);} catch {} }, 80); }); ro.observe(el); } else { const onR = () => { if (resizeTimer) clearTimeout(resizeTimer); resizeTimer = setTimeout(()=>renderChart(lastSummaryData.value||[]),120); }; window.addEventListener('resize', onR); ro = { disconnect(){ try { window.removeEventListener('resize', onR); } catch {} } }; } } catch {}
    async function pollStatus() {
    try { const r = await api.get('/api/stream-history/status', { timeout: 4000 }); status.value = { connected: !!r?.data?.connected, live: !!r?.data?.live, sampleCount: Number(r?.data?.sampleCount || 0) }; } catch {}
      pollTimer = setTimeout(pollStatus, 10000);
    }
    pollStatus();
    try { clickAwayHandler = (evt) => { try { if (!menuOpen.value) return; const root = overlayMenuEl.value; if (root && !root.contains(evt.target)) menuOpen.value = false; } catch {} }; document.addEventListener('click', clickAwayHandler, true); } catch {}
  });

  function acceptNewTimezone() { try { previousTzOffset.value = effectiveTzOffset.value; effectiveTzOffset.value = tzOffsetMinutes.value; localStorage.setItem(TZ_KEY, String(effectiveTzOffset.value)); tzChangeVisible.value = false; scheduleRefresh(true); try { pushToast({ type: 'success', message: t('streamHistoryUseNewTz') }); } catch {} } catch {} }
  function keepPreviousTimezone() { try { tzChangeVisible.value = false; localStorage.setItem(TZ_KEY, String(effectiveTzOffset.value)); try { pushToast({ type: 'info', message: t('streamHistoryKeepPrevTz') }); } catch {} } catch {} }
  function forceRefreshTimezone() { try { tzOffsetMinutes.value = -new Date().getTimezoneOffset(); if (tzOffsetMinutes.value !== effectiveTzOffset.value) { previousTzOffset.value = effectiveTzOffset.value; tzChangeVisible.value = true; } } catch {} }

  function dispose() { try { if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; } } catch {}; try { if (refreshDebounceTimer) { clearTimeout(refreshDebounceTimer); refreshDebounceTimer = null; } } catch {}; try { if (resizeTimer) { clearTimeout(resizeTimer); resizeTimer = null; } } catch {}; try { if (ro && ro.disconnect) { ro.disconnect(); ro = null; } } catch {}; try { if (clickAwayHandler) { document.removeEventListener('click', clickAwayHandler, true); clickAwayHandler = null; } } catch {} }

  return {
    chartEl, period, span, mode, filterQuick, filterQuickSpan, claimid, saving, showClearModal, showClaimChangeModal, clearBusy, perf, status, overlayCollapsed, totalAR, arUsd, earningsHidden, menuOpen, overlayMenuEl, showBackfill, lastSummaryData, initialClaimid, showViewers, tzDisplay, tzOffsetShort, tzChangeVisible, previousTzDisplay, currentPhysicalTzDisplay,
    acceptNewTimezone, keepPreviousTimezone, forceRefreshTimezone, saveConfig, refresh, onQuickFilterChange, onQuickRangeChange, clearHistory, confirmClear, confirmClearAfterClaimChange, downloadExport, onImport, toggleMenu, onBackfillClick, onBackfillDismiss, toggleEarningsHidden, backfill, toggleShowViewers, dispose,
    fmtHours: formatHours, fmtTotal: formatTotalHours, usdFromAr,
    compactModalOpen, compactBusy, compactDryBusy, compactPreview, compactIntervalMinutes, openCompactModal, closeCompactModal, previewCompaction, runCompaction, recommendedThreshold, sampleCount, compactionRecommended, compactionSavingsPercent
  };
}

export default createStreamHistoryPanel;

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined' && module?.exports) { module.exports = { createStreamHistoryPanel }; }
