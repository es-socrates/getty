import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import axios from 'axios';
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
  const status = ref({ connected: false, live: false });
  const backfillDismissed = ref(false);
  const showBackfill = computed(
    () => status.value.live && !backfillDismissed.value && period.value === 'day' && Number(perf.value?.range?.hoursStreamed || 0) < 2,
  );
  const anyModalOpen = computed(() => showClearModal.value || showClaimChangeModal.value);
  const overlayCollapsed = ref(false);
  const OVERLAY_KEY = 'streamHistory.overlayCollapsed';
  const EARNINGS_HIDE_KEY = 'streamHistory.earningsHidden';
  const totalAR = ref(0);
  const arUsd = ref(null);
  const earningsHidden = ref(false);
  const lastSummaryData = ref([]);
  const menuOpen = ref(false);
  const overlayMenuEl = ref(null);
  let clickAwayHandler = null;
  let ro = null;
  let resizeTimer = null;
  let refreshDebounceTimer = null;
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
    try { window.removeEventListener('keydown', onKeydown); } catch {}
    try { if (ro && ro.disconnect) ro.disconnect(); } catch {}
    try { if (clickAwayHandler) document.removeEventListener('click', clickAwayHandler, true); } catch {}
    try { if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer); } catch {}
  });

  async function loadConfig() {
    try {
      const r = await axios.get('/config/stream-history-config.json');
      claimid.value = r?.data?.claimid || '';
      initialClaimid.value = claimid.value;
    } catch {}
  }

  async function saveConfig() {
    try {
      saving.value = true;
      const changed = (claimid.value || '') !== (initialClaimid.value || '');
      await axios.post('/config/stream-history-config.json', { claimid: claimid.value });
      try { pushToast({ type: 'success', message: t('savedStreamHistory') }); } catch {}
      if (changed) showClaimChangeModal.value = true;
      initialClaimid.value = claimid.value;
      await refresh();
    } catch (e) {
      const msg = (e && e.response && e.response.data && e.response.data.error === 'session_required')
        ? t('sessionRequiredToast')
        : t('saveFailedStreamHistory');
      try { pushToast({ type: 'error', message: msg }); } catch {}
    } finally { saving.value = false; }
  }

  async function refresh() {
    try {
      const r = await axios.get(`/api/stream-history/summary?period=${encodeURIComponent(period.value)}&span=${span.value}`);
      lastSummaryData.value = r?.data?.data || [];
      renderChart(lastSummaryData.value);
      const p = await axios.get(`/api/stream-history/performance?period=${encodeURIComponent(period.value)}&span=${span.value}`);
      perf.value = p?.data ? { range: p.data.range, allTime: p.data.allTime } : perf.value;
      try {
        const pr = await axios.get('/api/ar-price');
        arUsd.value = pr?.data?.arweave?.usd || arUsd.value;
      } catch {}
      try {
        const er = await axios.get('/api/last-tip/earnings');
        totalAR.value = Number(er?.data?.totalAR || 0);
      } catch {}
    } catch { renderChart([]); }
  }

  function scheduleRefresh(immediate = false) {
    try { if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer); } catch {}
    if (immediate) { refresh(); return; }
    refreshDebounceTimer = setTimeout(() => { refresh(); }, REFRESH_DEBOUNCE_MS);
  }

  function onQuickFilterChange() {
    try {
      if (['day','week','month','year'].includes(filterQuick.value)) {
        period.value = filterQuick.value;
        scheduleRefresh();
      }
    } catch {}
  }
  function onQuickRangeChange() {
    try {
      const v = Number(filterQuickSpan.value || 30);
      if ([7,14,30,90,180,365].includes(v)) { span.value = v; scheduleRefresh(); }
    } catch {}
  }
  function clearHistory() { showClearModal.value = true; }
  async function confirmClear() {
    try {
      clearBusy.value = true;
      await axios.post('/api/stream-history/clear');
      await refresh();
      showClearModal.value = false;
      try { pushToast({ type: 'success', message: t('streamHistoryCleared') }); } catch {}
    } catch {
      try { pushToast({ type: 'error', message: t('streamHistoryClearFailed') }); } catch {}
    } finally { clearBusy.value = false; }
  }
  async function confirmClearAfterClaimChange() {
    try {
      clearBusy.value = true;
      await axios.post('/api/stream-history/clear');
      await refresh();
      showClaimChangeModal.value = false;
      try { pushToast({ type: 'success', message: t('streamHistoryCleared') }); } catch {}
    } catch {
      try { pushToast({ type: 'error', message: t('streamHistoryClearFailed') }); } catch {}
    } finally { clearBusy.value = false; }
  }
  function downloadExport() {
    fetch('/api/stream-history/export', { cache: 'no-cache' })
      .then(r => r.ok ? r.text() : Promise.reject(new Error('export_failed')))
      .then(text => {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `stream-history-${ts}.json`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      })
      .catch(() => { try { pushToast({ type: 'error', message: t('streamHistoryExportFailed') }); } catch {} });
  }
  async function onImport(e) {
    try {
      const file = e?.target?.files?.[0];
      if (!file) return;
      const text = await file.text();
      const json = JSON.parse(text);
      await axios.post('/api/stream-history/import', json);
      await refresh();
      try { pushToast({ type: 'success', message: t('streamHistoryImported') }); } catch {}
    } catch {
      try { pushToast({ type: 'error', message: t('streamHistoryImportFailed') }); } catch {}
    } finally { try { e.target.value = ''; } catch {} }
  }

  function toggleMenu() { menuOpen.value = !menuOpen.value; }
  function onBackfillClick(h) { menuOpen.value = false; backfill(h); }
  function onBackfillDismiss() { menuOpen.value = false; backfillDismissed.value = true; }
  function toggleEarningsHidden() { earningsHidden.value = !earningsHidden.value; }

  watch([mode, period, span], () => { scheduleRefresh(); });
  watch(period, (p) => { if (['day','week','month','year'].includes(p)) filterQuick.value = p; });
  watch(span, (s) => { if ([7,14,30,90,180,365].includes(Number(s))) filterQuickSpan.value = Number(s); });
  watch(overlayCollapsed, (v) => { try { localStorage.setItem(OVERLAY_KEY, v ? '1':'0'); } catch {} });
  watch(earningsHidden, (v) => { try { localStorage.setItem(EARNINGS_HIDE_KEY, v ? '1':'0'); } catch {} });

  function renderChart(data) { try { renderStreamHistoryChart(chartEl.value, data, { mode: mode.value, period: period.value }); } catch {} }

  async function backfill(hours) {
    try { await axios.post('/api/stream-history/backfill-current', { hours }); await refresh(); try { pushToast({ type: 'success', message: t('streamHistoryBackfilled') }); } catch {} }
    catch { try { pushToast({ type: 'error', message: t('streamHistoryBackFillFailed') }); } catch {} }
  }

  onMounted(async () => {
    try { const v = localStorage.getItem(OVERLAY_KEY); if (v==='1'||v==='0') overlayCollapsed.value = (v==='1'); } catch {}
    try { const h = localStorage.getItem(EARNINGS_HIDE_KEY); if (h==='1'||h==='0') earningsHidden.value = (h==='1'); } catch {}
    await loadConfig();
    await refresh();
    try {
      const el = chartEl.value;
      if (el && typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => {
          try { chartEl.value?.classList.add('reflowing'); } catch {}
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => { try { renderChart(lastSummaryData.value || []); } catch {} try { setTimeout(()=>chartEl.value?.classList.remove('reflowing'),120);} catch {} }, 80);
        });
        ro.observe(el);
      } else {
        const onR = () => { if (resizeTimer) clearTimeout(resizeTimer); resizeTimer = setTimeout(()=>renderChart(lastSummaryData.value||[]),120); };
        window.addEventListener('resize', onR);
        ro = { disconnect(){ try { window.removeEventListener('resize', onR); } catch {} } };
      }
    } catch {}
    async function pollStatus() { try { const r = await axios.get('/api/stream-history/status', { timeout: 4000 }); status.value = { connected: !!r?.data?.connected, live: !!r?.data?.live }; } catch {} setTimeout(pollStatus, 10000); }
    pollStatus();
    try {
      clickAwayHandler = (evt) => { try { if (!menuOpen.value) return; const root = overlayMenuEl.value; if (root && !root.contains(evt.target)) menuOpen.value = false; } catch {} };
      document.addEventListener('click', clickAwayHandler, true);
    } catch {}
  });

  return {
    chartEl, period, span, mode, filterQuick, filterQuickSpan, claimid, saving, showClearModal,
    showClaimChangeModal, clearBusy, perf, status, overlayCollapsed, totalAR, arUsd, earningsHidden,
    menuOpen, overlayMenuEl, showBackfill, lastSummaryData, initialClaimid,
    saveConfig, refresh, onQuickFilterChange, onQuickRangeChange, clearHistory, confirmClear,
    confirmClearAfterClaimChange, downloadExport, onImport, toggleMenu, onBackfillClick,
    onBackfillDismiss, toggleEarningsHidden, backfill,
    fmtHours: formatHours, fmtTotal: formatTotalHours, usdFromAr,
  };
}

export default createStreamHistoryPanel;

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined' && module?.exports) {
  // eslint-disable-next-line no-undef
  module.exports = { createStreamHistoryPanel };
}
