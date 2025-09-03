<template>
  <OsCard :title="t('streamHistoryTitle')">
    <div class="status-row">
      <span class="badge" :class="status.connected ? 'ok' : 'err'">
        {{ status.connected ? t('connected') : t('disconnected') }}
      </span>
      <span class="badge" :class="status.live ? 'live' : 'idle'" v-if="status.connected">
        {{ status.live ? t('liveNow') : t('notLive') }}
      </span>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">
      <div class="form-group" style="grid-column:1/-1;">
        <label class="label">{{ t('streamHistoryClaimId') }}</label>
        <input class="input" v-model="claimid" />
        <div class="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs opacity-85 hover:opacity-100 disabled:opacity-60"
            :disabled="saving"
            :title="saving ? (t('commonSaving')||'Saving…') : (t('commonSave')||'Save')"
            @click="saveConfig"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M7 3v6h8V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M7 21v-7h10v7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>{{ saving ? t('commonSaving') : t('commonSave') }}</span>
          </button>

          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs opacity-85 hover:opacity-100"
            :title="t('commonRefresh') || 'Refresh'"
            @click="refresh"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M21 3v6h-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>{{ t('commonRefresh') }}</span>
          </button>

          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs text-red-500 hover:opacity-100"
            :title="t('streamHistoryClear') || 'Clear'"
            @click="clearHistory"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M3 6h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>{{ t('streamHistoryClear') }}</span>
          </button>

          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs opacity-85 hover:opacity-100"
            :title="t('streamHistoryExport') || 'Export'"
            @click="downloadExport"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 3v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M8 11l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M4 21h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            <span>{{ t('streamHistoryExport') }}</span>
          </button>

          <label
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs opacity-85 hover:opacity-100 cursor-pointer"
            :title="t('streamHistoryImport') || 'Import'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 21V9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M16 13l-4-4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M4 21h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            <span>{{ t('streamHistoryImport') }}</span>
            <input type="file" accept="application/json" @change="onImport" style="display:none;" />
          </label>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between -m-2 mt-2">
      <div class="w-auto p-2">
        <h3 class="font-heading text-lg font-semibold">{{ t('activity') }}</h3>
      </div>
      <div class="w-auto p-2">
        <div class="flex items-center gap-2">
          <div class="relative h-full overflow-hidden rounded-full">
            <select
              class="quick-select appearance-none py-1.5 pl-3.5 pr-10 text-sm text-neutral-600 font-medium w-full h-full bg-light outline-none cursor-pointer border border-[var(--card-border)] rounded-full bg-[var(--bg-chat)]"
              v-model="filterQuick"
              @change="onQuickFilterChange"
              aria-label="Quick period"
            >
              <option value="day">{{ t('quickToday') }}</option>
              <option value="week">{{ t('quickThisWeek') }}</option>
              <option value="month">{{ t('quickThisMonth') }}</option>
              <option value="year">{{ t('quickThisYear') }}</option>
            </select>
            <svg class="pointer-events-none absolute top-1/2 right-4 transform -translate-y-1/2" width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.1673 6L8.50065 10.6667L3.83398 6" stroke="#0C1523" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </div>

          <div class="relative h-full overflow-hidden rounded-full">
            <select
              class="quick-select appearance-none py-1.5 pl-3.5 pr-10 text-sm text-neutral-600 font-medium w-full h-full bg-light outline-none cursor-pointer border border-[var(--card-border)] rounded-full bg-[var(--bg-chat)]"
              v-model.number="filterQuickSpan"
              @change="onQuickRangeChange"
              aria-label="Quick range span"
            >
              <option :value="7">7d</option>
              <option :value="14">14d</option>
              <option :value="30">30d</option>
              <option :value="90">90d</option>
              <option :value="180">180d</option>
              <option :value="365">365d</option>
            </select>
            <svg class="pointer-events-none absolute top-1/2 right-4 transform -translate-y-1/2" width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.1673 6L8.50065 10.6667L3.83398 6" stroke="#0C1523" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-4">
      <div class="chart-wrap">
        <div class="chart-overlay" :class="overlayCollapsed ? 'collapsed' : ''" aria-label="viewer-stats">
          <div class="overlay-header">
            <div class="overlay-title">{{ t('activity') }}</div>
            <button type="button" class="overlay-toggle" :aria-expanded="String(!overlayCollapsed)" @click="overlayCollapsed = !overlayCollapsed" aria-label="Toggle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
          <div class="overlay-row">
            <span class="dot dot-teal" aria-hidden="true"></span>
            <span class="ov-label">{{ t('kpiAvgViewers') }}</span>
            <span class="ov-value">{{ Number(perf.range.avgViewers||0).toFixed(1) }}</span>
          </div>
          <div class="overlay-row">
            <span class="dot dot-red" aria-hidden="true"></span>
            <span class="ov-label">{{ t('kpiPeakViewers') }}</span>
            <span class="ov-value">{{ perf.range.peakViewers }}</span>
          </div>
          <div class="overlay-row">
            <span class="dot dot-slate" aria-hidden="true"></span>
            <span class="ov-label">{{ t('kpiHighestViewers') }}</span>
            <span class="ov-value">{{ perf.allTime.highestViewers }}</span>
          </div>
        </div>
        <div ref="chartEl" class="chart-canvas"></div>
      </div>
      <div class="text-xs opacity-80 mt-1 flex items-center gap-2">
        <span>{{ t('streamHistoryHint') }}</span>
        <button
          type="button"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs"
          :aria-pressed="mode==='line' ? 'true' : 'false'"
          :class="mode==='line' ? 'ring-1 ring-[var(--card-border)]' : ''"
          @click="mode='line'"
        >
          {{ t('chartLine') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs"
          :aria-pressed="mode==='candle' ? 'true' : 'false'"
          :class="mode==='candle' ? 'ring-1 ring-[var(--card-border)]' : ''"
          @click="mode='candle'"
        >
          {{ t('chartCandle') }}
        </button>
      </div>
    </div>

    <div class="kpis mt-4">
      <div class="kpi"><div class="kpi-label">{{ t('kpiHoursStreamed') }}</div><div class="kpi-value">{{ fmtHours(perf.range.hoursStreamed) }}</div></div>
      <div class="kpi"><div class="kpi-label">{{ t('kpiAvgViewers') }}</div><div class="kpi-value">{{ perf.range.avgViewers.toFixed(2) }}</div></div>
      <div class="kpi"><div class="kpi-label">{{ t('kpiPeakViewers') }}</div><div class="kpi-value">{{ perf.range.peakViewers }}</div></div>
      <div class="kpi"><div class="kpi-label">{{ t('kpiHoursWatched') }}</div><div class="kpi-value">{{ perf.range.hoursWatched.toFixed(2) }}</div></div>
      <div class="kpi"><div class="kpi-label">{{ t('kpiActiveDays') }}</div><div class="kpi-value">{{ perf.range.activeDays }}</div></div>
      <div class="kpi"><div class="kpi-label">{{ t('kpiTotalHoursStreamed') }}</div><div class="kpi-value">{{ fmtTotal(perf.allTime.totalHoursStreamed) }}</div></div>
      <div class="kpi"><div class="kpi-label">{{ t('kpiHighestViewers') }}</div><div class="kpi-value">{{ perf.allTime.highestViewers }}</div></div>
      <div class="kpi earnings-kpi">
        <div class="kpi-label flex items-center gap-2">
          <span>{{ t('kpiTotalEarnings') || 'Total earnings' }}</span>
          <button type="button" class="earnings-toggle" :aria-pressed="String(!earningsHidden)" @click="toggleEarningsHidden" :title="earningsHidden ? (t('show')||'Show') : (t('hide')||'Hide')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />
            </svg>
          </button>
        </div>
        <div class="kpi-value earnings-values" :class="earningsHidden ? 'blurred' : ''">
          <span>{{ totalAR.toFixed(4) }}</span>
          <span class="unit">AR</span>
          <span class="usd">≈ ${{ usdFromAr(totalAR, arUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
        </div>
      </div>
    </div>
    <div v-if="showBackfill" class="text-xs opacity-80 mt-2 flex gap-2 items-center">
      <span>{{ t('streamHistoryBackfillHint') }}</span>
      <button class="btn btn-xs" @click="backfill(24)">+24h</button>
      <button class="btn btn-xs" @click="backfill(48)">+48h</button>
      <button class="btn btn-xs" @click="backfill(72)">+72h</button>
      <button class="btn btn-xs" @click="backfillDismissed = true">{{ t('commonClose') }}</button>
    </div>

    <teleport to="body">
    <div v-if="showClearModal" class="modal-overlay" @click.self="!clearBusy && (showClearModal=false)" role="dialog" aria-modal="true">
      <div class="modal-card">
        <div class="modal-title">{{ t('streamHistoryClear') }}</div>
        <div class="modal-body">
          <p class="mb-2">{{ t('streamHistoryClearConfirm') }}</p>
          <p class="text-xs opacity-80">{{ t('streamHistoryHint') }}</p>
        </div>
        <div class="modal-actions">
          <button class="btn" :disabled="clearBusy" @click="showClearModal=false">{{ t('commonClose') }}</button>
          <button class="btn" :disabled="clearBusy" @click="downloadExport">{{ t('streamHistoryExport') }}</button>
          <button class="btn btn-danger" :disabled="clearBusy" @click="confirmClear">{{ t('streamHistoryClear') }}</button>
        </div>
      </div>
    </div>
    </teleport>

    <teleport to="body">
    <div v-if="showClaimChangeModal" class="modal-overlay" @click.self="!clearBusy && (showClaimChangeModal=false)" role="dialog" aria-modal="true">
      <div class="modal-card">
        <div class="modal-title">{{ t('streamHistoryClaimId') }}</div>
        <div class="modal-body">
          <p class="mb-2">{{ t('streamHistoryClaimChangeClearConfirm') }}</p>
          <p class="text-xs opacity-80">{{ t('streamHistoryHint') }}</p>
        </div>
        <div class="modal-actions">
          <button class="btn" :disabled="clearBusy" @click="showClaimChangeModal=false">{{ t('commonClose') }}</button>
          <button class="btn" :disabled="clearBusy" @click="downloadExport">{{ t('streamHistoryExport') }}</button>
          <button class="btn btn-danger" :disabled="clearBusy" @click="confirmClearAfterClaimChange">{{ t('streamHistoryClear') }}</button>
        </div>
      </div>
    </div>
    </teleport>
  </OsCard>
  </template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import OsCard from './os/OsCard.vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import { pushToast } from '../services/toast';

const { t } = useI18n();
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
const perf = ref({ range: { hoursStreamed: 0, avgViewers: 0, peakViewers: 0, hoursWatched: 0, activeDays: 0 }, allTime: { totalHoursStreamed: 0, highestViewers: 0 } });
const status = ref({ connected: false, live: false });
const backfillDismissed = ref(false);
const showBackfill = computed(() => status.value.live && !backfillDismissed.value && period.value === 'day' && Number(perf.value?.range?.hoursStreamed || 0) < 2);
const anyModalOpen = computed(() => showClearModal.value || showClaimChangeModal.value);
const overlayCollapsed = ref(false);
const OVERLAY_KEY = 'streamHistory.overlayCollapsed';
const EARNINGS_HIDE_KEY = 'streamHistory.earningsHidden';
const totalAR = ref(0);
const arUsd = ref(null);
const earningsHidden = ref(false);
const lastSummaryData = ref([]);
let ro = null;
let resizeTimer = null;

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

    if (changed) {
      showClaimChangeModal.value = true;
    }
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

function onQuickFilterChange() {
  try {
    if (filterQuick.value === 'day' || filterQuick.value === 'week' || filterQuick.value === 'month' || filterQuick.value === 'year') {
      period.value = filterQuick.value;
      refresh();
    }
  } catch {}
}

function onQuickRangeChange() {
  try {
    const v = Number(filterQuickSpan.value || 30);
    if ([7,14,30,90,180,365].includes(v)) {
      span.value = v;
      refresh();
    }
  } catch {}
}

async function clearHistory() {
  try {
    showClearModal.value = true;
  } catch {
    try { pushToast({ type: 'error', message: t('streamHistoryClearFailed') }); } catch {}
  }
}

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
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
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
  } finally {
    try { e.target.value = ''; } catch {}
  }
}

function renderChart(data) {
  const el = chartEl.value;
  if (!el) return;
  el.innerHTML = '';
  el.style.position = 'relative';
  el.style.background = 'var(--chart-bg, #fefefe)';
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.style.position = 'absolute';
  tip.style.pointerEvents = 'none';
  tip.style.padding = '4px 6px';
  tip.style.fontSize = '12px';
  tip.style.borderRadius = '6px';
  tip.style.border = '1px solid var(--card-border)';
  tip.style.background = 'var(--card-bg, #111827)';
  tip.style.display = 'none';
  el.appendChild(tip);

  const placeTipFromMouse = (evt, preferAbove = false) => {
    try {
      const elRect = el.getBoundingClientRect();
      const margin = 10;
      const tipRect = tip.getBoundingClientRect();
      let left = (evt.clientX - elRect.left) + margin;
      left = Math.max(4, Math.min(left, el.clientWidth - tipRect.width - 4));
      const below = (evt.clientY - elRect.top) + margin;
      let top;
      if (preferAbove || (below + tipRect.height > el.clientHeight - 4)) {
        top = Math.max(4, (evt.clientY - elRect.top) - tipRect.height - 12);
      } else {
        top = Math.min(el.clientHeight - tipRect.height - 4, below);
      }
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    } catch {}
  };

  let source = Array.isArray(data) ? [...data] : [];
  let i = 0;
  while (i < source.length && (!source[i] || !source[i].hours || source[i].hours === 0)) i++;
  let trimmed = source;
  let removed = 0;
  if (i > 0 && i < source.length) {
    trimmed = source.slice(i);
    removed = i;
  }

  const display = [...trimmed];
  for (let k = 0; k < removed; k++) display.push({ hours: 0, date: '' });

  const w = el.clientWidth - 20;
  const h = el.clientHeight - 16;
  const max = Math.max(1, ...trimmed.map(d => d.hours || 0));

  const drawGrid = (svg, withLabels = false, maxVal = 0, axisLeft = 0) => {
    const bottomAxis = 24;
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(w));
    bg.setAttribute('height', String(h));
    bg.setAttribute('fill', 'var(--chart-bg, #fefefe)');
    svg.appendChild(bg);

    const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || '#f3f7fa';
    const lines = 4;
    const padY = 10;
    for (let i = 1; i <= lines; i++) {
      const y = Math.round(padY + ((h - bottomAxis - padY * 2) * i / (lines + 1)));
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1', String(Math.max(0, axisLeft)));
      ln.setAttribute('y1', String(y));
      ln.setAttribute('x2', String(w));
      ln.setAttribute('y2', String(y));
      ln.setAttribute('stroke', gridColor);
      ln.setAttribute('stroke-width', '1');
      ln.setAttribute('stroke-dasharray', '0');
      svg.appendChild(ln);
    }

    if (withLabels && maxVal > 0) {
      const labelColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#94a3b8';
      const ticks = lines + 2;
      for (let i = 0; i <= ticks - 1; i++) {
        const y = Math.round(padY + ((h - bottomAxis - padY * 2) * i / (ticks - 1)));
        const val = maxVal * (1 - (i / (ticks - 1)));
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', '6');

        txt.setAttribute('y', String(Math.max(10, Math.min(h - bottomAxis - 2, y + 3))));
        txt.setAttribute('fill', labelColor);
        txt.setAttribute('font-size', '10');
        txt.setAttribute('text-anchor', 'start');

        try { txt.textContent = fmtHours(val); } catch { txt.textContent = String(Math.round(val)); }
        svg.appendChild(txt);
      }
    }
  };

  const drawXAxis = (svg, axisLeft, positions, labels) => {
    const bottomAxis = 24;
    const labelColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#94a3b8';
    positions.forEach((x, i) => {
      const lbl = labels[i] ?? '';
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', String(x));
      txt.setAttribute('y', String(h - Math.max(6, Math.round(bottomAxis / 3))));
      txt.setAttribute('fill', labelColor);
      txt.setAttribute('font-size', '10');
      txt.setAttribute('text-anchor', 'middle');
      txt.textContent = lbl;
      svg.appendChild(txt);
    });
  };

  const parseLocalFromLabel = (s) => {
    if (!s || typeof s !== 'string') return null;

    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split('-').map(n => parseInt(n, 10));
        return new Date(y, m - 1, d);
      }
      if (/^\d{4}-\d{2}$/.test(s)) {
        const [y, m] = s.split('-').map(n => parseInt(n, 10));
        return new Date(y, m - 1, 1);
      }
      if (/^\d{4}$/.test(s)) {
        const y = parseInt(s, 10);
        return new Date(y, 0, 1);
      }
    } catch {}
    return null;
  };
  const fmtDateTitle = (s) => {
    try {
      const d = parseLocalFromLabel(s) || new Date(s);
      if (!isNaN(d)) return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' });
    } catch {}
    return s || '';
  };
  const fmtXLabel = (s) => {
    try {
      const d = parseLocalFromLabel(s) || new Date(s);
      if (!isNaN(d)) {
        if (period.value === 'day' || period.value === 'week') return String(d.getDate()).padStart(2,'0');
        return d.toLocaleDateString(undefined, { month: 'short' });
      }
    } catch {}
    return (s || '').slice(0, 6);
  };

  if (mode.value === 'line') {
    const axisLeft = 44;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
  svg.style.display = 'block';
    drawGrid(svg, true, max, axisLeft);

    const padX = 6; const padY = 10; const bottomAxis = 24;
    const innerW = Math.max(1, (w - axisLeft - padX * 2));
    const stepX = Math.max(1, innerW / Math.max(1, display.length - 1));
    const toY = (v) => Math.round((h - bottomAxis - padY) - (Math.max(0, v) / max) * (h - bottomAxis - padY * 2));

    let dPath = '';
    display.forEach((p, idx) => {
      const x = Math.round(axisLeft + padX + idx * stepX);
      const y = toY(p.hours || 0);
      dPath += (idx === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    });
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', dPath);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--line-color, #10b981)');
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('class', 'line-path');
    svg.appendChild(path);

    display.forEach((p, idx) => {
      const x = Math.round(axisLeft + padX + idx * stepX);
      const y = toY(p.hours || 0);
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', String(x));
      c.setAttribute('cy', String(y));
      c.setAttribute('r', String(3.0));
      c.setAttribute('fill', (p.hours || 0) > 0 ? 'var(--line-color, #10b981)' : 'rgba(128,128,128,.65)');
      c.setAttribute('class', 'line-point');
      c.style.cursor = 'default';
      c.addEventListener('mouseenter', (e) => {
        const title = fmtDateTitle(p.date);
        tip.innerHTML = `<div style="font-weight:600;margin-bottom:2px;">${title}</div><div style="opacity:.9;">${(p.hours||0)} h</div>`;
        tip.style.display = 'block';
        placeTipFromMouse(e, (p.hours || 0) === 0);
      });
      c.addEventListener('mousemove', (e) => {
        placeTipFromMouse(e, (p.hours || 0) === 0);
      });
      c.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
      svg.appendChild(c);
    });

    const maxLabels = 8;
    const stride = Math.max(1, Math.ceil(display.length / maxLabels));
    const positions = [];
    const labels = [];
    for (let i = 0; i < display.length; i += stride) {
      const x = Math.round(axisLeft + padX + i * stepX);
      positions.push(x);
      labels.push(fmtXLabel(display[i]?.date));
    }
    if (display.length > 1 && (display.length - 1) % stride !== 0) {
      // ensure last label
      const xLast = Math.round(axisLeft + padX + (display.length - 1) * stepX);
      positions.push(xLast);
      labels.push(fmtXLabel(display[display.length - 1]?.date));
    }
    drawXAxis(svg, axisLeft, positions, labels);
    el.appendChild(svg);
    return;
  }

  const axisLeft = 44;
  const barW = Math.max(8, Math.floor((w - axisLeft) / Math.max(1, display.length)) - 6);

  const gridSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  gridSvg.setAttribute('width', String(w));
  gridSvg.setAttribute('height', String(h));
  gridSvg.style.position = 'absolute';
  gridSvg.style.left = '0';
  gridSvg.style.top = '0';
  gridSvg.style.pointerEvents = 'none';
  drawGrid(gridSvg, true, max, axisLeft);
  {
    const padX = 6;
    const innerW = Math.max(1, (w - axisLeft - padX * 2));
    const stepX = Math.max(1, innerW / Math.max(1, display.length - 1));
    const maxLabels = 8;
    const stride = Math.max(1, Math.ceil(display.length / maxLabels));
    const positions = [];
    const labels = [];
    for (let i = 0; i < display.length; i += stride) {
      const x = Math.round(axisLeft + padX + i * stepX);
      positions.push(x);
      labels.push(fmtXLabel(display[i]?.date));
    }
    if (display.length > 1 && (display.length - 1) % stride !== 0) {
      const xLast = Math.round(axisLeft + padX + (display.length - 1) * stepX);
      positions.push(xLast);
      labels.push(fmtXLabel(display[display.length - 1]?.date));
    }
    drawXAxis(gridSvg, axisLeft, positions, labels);
  }
  el.appendChild(gridSvg);

  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.alignItems = 'flex-end';
  container.style.gap = '4px';
  container.style.position = 'relative';
  container.style.zIndex = '1';
  container.style.marginLeft = axisLeft + 'px';

  const bottomAxis = 24;
  const padY = 10;
  const innerHeight = Math.max(1, h - bottomAxis - padY * 2);
  container.style.height = innerHeight + 'px';
  container.style.marginTop = padY + 'px';

  const available = innerHeight;
  display.forEach(d => {
    const v = d.hours || 0;
    const bh = Math.round((v / max) * available);
  const bar = document.createElement('div');
    bar.style.width = barW + 'px';
    bar.style.height = Math.max(2, bh) + 'px';
    bar.title = `${d.date ? d.date + ': ' : ''}${v} h`;
    bar.style.background = v > 0 ? 'var(--bar-positive, #10b981)' : 'rgba(128,128,128,.35)';
    bar.style.borderRadius = '6px';
    bar.style.boxShadow = v > 0 ? '0 1px 0 rgba(0,0,0,.06)' : 'none';
    bar.className = 'bar';
    if (mode.value === 'candle') {
      bar.style.border = '1px solid var(--card-border)';
      bar.style.background = 'transparent';
      const fill = document.createElement('div');
      fill.style.height = Math.max(2, bh) + 'px';
      fill.style.background = v > 0 ? 'var(--bar-positive, #10b981)' : 'rgba(128,128,128,.55)';
      fill.style.width = '100%';
      fill.style.borderRadius = '6px';
      bar.appendChild(fill);
    }

  const show = (e) => {
      try {
        const title = fmtDateTitle(d.date);
        tip.innerHTML = `<div style="font-weight:600;margin-bottom:2px;">${title}</div><div style="opacity:.9;">${v} h</div>`;
        tip.style.display = 'block';
        placeTipFromMouse(e, v === 0);
      } catch {}
    };
    const hide = () => { tip.style.display = 'none'; };
    bar.addEventListener('mouseenter', show);
    bar.addEventListener('mousemove', show);
    bar.addEventListener('mouseleave', hide);
    container.appendChild(bar);
  });
  el.appendChild(container);
}

onMounted(async () => {
  try {
    const v = localStorage.getItem(OVERLAY_KEY);
    if (v === '1' || v === '0') overlayCollapsed.value = (v === '1');
  } catch {}
  try {
    const h = localStorage.getItem(EARNINGS_HIDE_KEY);
    if (h === '1' || h === '0') earningsHidden.value = (h === '1');
  } catch {}
  await loadConfig();
  await refresh();

  try {
    const el = chartEl.value;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        try { chartEl.value?.classList.add('reflowing'); } catch {}
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          try { renderChart(lastSummaryData.value || []); } catch {}
          try { setTimeout(() => chartEl.value?.classList.remove('reflowing'), 120); } catch {}
        }, 80);
      });
      ro.observe(el);
    } else {
      const onR = () => { if (resizeTimer) clearTimeout(resizeTimer); resizeTimer = setTimeout(() => renderChart(lastSummaryData.value || []), 120); };
      window.addEventListener('resize', onR);
      ro = { disconnect(){ try { window.removeEventListener('resize', onR); } catch {} } };
    }
  } catch {}
  async function pollStatus() {
    try {
      const r = await axios.get('/api/stream-history/status', { timeout: 4000 });
      status.value = { connected: !!r?.data?.connected, live: !!r?.data?.live };
    } catch { /* keep previous status */ }
  setTimeout(pollStatus, 10000);
  }
  pollStatus();
});
function toggleEarningsHidden() {
  earningsHidden.value = !earningsHidden.value;
}

function usdFromAr(arAmount, usdRate) {
  const a = Number(arAmount || 0);
  const r = Number(usdRate || 0);
  if (!isFinite(a) || !isFinite(r) || r <= 0) return 0;
  return a * r;
}

watch([mode, period, span], () => { refresh(); });
watch(period, (p) => {
  if (p === 'day' || p === 'week' || p === 'month' || p === 'year') {
    filterQuick.value = p;
  }
});
watch(span, (s) => {
  if ([7,14,30,90,180,365].includes(Number(s))) {
    filterQuickSpan.value = Number(s);
  }
});

watch(overlayCollapsed, (v) => {
  try { localStorage.setItem(OVERLAY_KEY, v ? '1' : '0'); } catch {}
});

watch(earningsHidden, (v) => {
  try { localStorage.setItem(EARNINGS_HIDE_KEY, v ? '1' : '0'); } catch {}
});

function fmtHours(h) {
  const v = Number(h || 0);
  if (v >= 24) {
    const snapped = Math.round(v / 24) * 24;
  if (snapped >= 48) return snapped + ' h (' + (snapped / 24) + ' d)';
  return snapped + ' h';
  }
  if (v >= 10) return Math.round(v) + ' h';
  if (v >= 1) return v.toFixed(1) + ' h';
  return v.toFixed(2) + ' h';
}

function fmtTotal(h) {
  const v = Number(h || 0);
  if (v >= 24) return (v / 24).toFixed(v / 24 >= 10 ? 0 : 1) + ' d';
  if (v >= 10) return Math.round(v) + ' h';
  if (v >= 1) return v.toFixed(1) + ' h';
  return v.toFixed(2) + ' h';
}

async function backfill(hours) {
  try {
    await axios.post('/api/stream-history/backfill-current', { hours });
    await refresh();
    try { pushToast({ type: 'success', message: t('streamHistoryBackfilled') }); } catch {}
  } catch {
    try { pushToast({ type: 'error', message: t('streamHistoryBackfillFailed') }); } catch {}
  }
}
</script>

<style scoped>
.chart-wrap { position: relative; }
.chart-canvas { width:100%; height:280px; overflow:auto; border:1px solid var(--card-border); border-radius:10px; padding:8px; background:var(--bg-chat); }
.chart-canvas.reflowing .line-path { transition: d 160ms ease-out; }
.chart-canvas.reflowing .line-point { transition: cx 160ms ease-out, cy 160ms ease-out; }
.chart-canvas.reflowing .bar { transition: height 160ms ease-out; }
.chart-overlay { position:absolute; top:10px; right:12px; background: var(--card-bg, #ffffff); color: var(--text-primary, #0f172a); border:1px solid var(--card-border); border-radius:10px; padding:8px 10px; box-shadow: 0 10px 25px rgba(0,0,0,.06); z-index:2; min-width: 160px; }
.chart-overlay .overlay-title { font-size:12px; font-weight:600; opacity:.85; margin-bottom:6px; }
.chart-overlay .overlay-row { display:flex; align-items:center; gap:8px; font-size:12px; line-height:1; padding:3px 0; }
.chart-overlay .ov-label { opacity:.8; }
.chart-overlay .ov-value { margin-left:auto; font-weight:600; }
.dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
.dot-teal { background:#10b981; }
.dot-red { background:#ef4444; }
.dot-slate { background:#64748b; }
@media (prefers-color-scheme: dark) {
  .chart-overlay { background: var(--card-bg, #111827); color: var(--text-primary, #e5e7eb); box-shadow: 0 10px 25px rgba(0,0,0,.25); }
}
.kpis { display:grid; grid-template-columns: repeat(auto-fill, minmax(180px,1fr)); gap:12px; }
.kpi { border:1px solid var(--card-border); border-radius:8px; padding:10px; background: var(--card-bg, #111827); }
.kpi-label { font-size:12px; opacity:.75; margin-bottom:6px; }
.kpi-value { font-size:22px; font-weight:700; }
.status-row { display:flex; gap:8px; align-items:center; margin-bottom:10px; }
.badge { display:inline-block; padding:4px 8px; font-size:12px; border:1px solid var(--card-border); background: var(--card-bg, #111827); }
.badge.ok { color:#10b981; background: rgba(16,185,129,.08); }
.badge.err { color:#f59e0b; background: rgba(239,68,68,.08); }
.badge.live { color:#f50b0b; background: rgba(245,158,11,.08); }
.badge.idle { opacity:.8; }
.chart-tip { z-index: 10; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); backdrop-filter: blur(2px); display:flex; align-items:center; justify-content:center; z-index: 9999; }
.modal-card { width: min(520px, 92vw); background: var(--card-bg, #111827); border: 1px solid var(--card-border); border-radius: 10px; padding: 14px; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
.modal-title { font-weight: 700; margin-bottom: 8px; }
.modal-body { font-size: 14px; }
.modal-actions { display:flex; gap:8px; justify-content:flex-end; margin-top: 12px; }
select.quick-select { -webkit-appearance: none; -moz-appearance: none; appearance: none; background-image: none; }
select.quick-select::-ms-expand { display: none; }
.overlay-header { display:flex; align-items:center; gap:8px; }
.overlay-toggle { margin-left:auto; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; border:0; background:transparent; color:inherit; cursor:pointer; border-radius:6px; }
.overlay-toggle:hover { background: rgba(0,0,0,.06); }
@media (prefers-color-scheme: dark) { .overlay-toggle:hover { background: rgba(255,255,255,.06); } }
.chart-overlay.collapsed { padding:6px 8px; min-width:auto; }
.chart-overlay.collapsed .overlay-title { margin-bottom:0; }
.chart-overlay.collapsed .overlay-row { display:none; }
.chart-overlay.collapsed .overlay-toggle svg { transform: rotate(180deg); }
.earnings-kpi .earnings-values { display:flex; gap:6px; align-items:baseline; }
.earnings-kpi .earnings-values.blurred { filter: blur(6px); }
.earnings-kpi .unit { font-size:14px; opacity:.8; }
.earnings-kpi .usd { font-size:14px; opacity:.85; margin-left:6px; }
.earnings-toggle { margin-left:auto; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; border:0; background:transparent; color:inherit; cursor:pointer; border-radius:6px; }
.earnings-toggle:hover { background: rgba(0,0,0,.06); }
@media (prefers-color-scheme: dark) { .earnings-toggle:hover { background: rgba(255,255,255,.06); } }
</style>
