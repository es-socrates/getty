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
        <div class="mt-2 flex gap-2">
          <button class="btn" :disabled="saving" @click="saveConfig">{{ saving ? t('commonSaving') : t('commonSave') }}</button>
          <button class="btn" @click="refresh">{{ t('commonRefresh') }}</button>
          <button class="btn btn-danger" @click="clearHistory">{{ t('streamHistoryClear') }}</button>
          <button class="btn" @click="downloadExport">{{ t('streamHistoryExport') }}</button>
          <label class="btn" style="cursor:pointer;">
            {{ t('streamHistoryImport') }}
            <input type="file" accept="application/json" @change="onImport" style="display:none;" />
          </label>
        </div>
      </div>
      <div class="form-group">
        <label class="label">{{ t('streamHistoryPeriod') }}</label>
        <select class="input" v-model="period" @change="refresh">
          <option value="day">{{ t('periodDay') }}</option>
          <option value="week">{{ t('periodWeek') }}</option>
          <option value="month">{{ t('periodMonth') }}</option>
          <option value="year">{{ t('periodYear') }}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="label">{{ t('streamHistorySpan') }}</label>
        <select class="input" v-model.number="span" @change="refresh">
          <option :value="7">7</option>
          <option :value="14">14</option>
          <option :value="30">30</option>
          <option :value="90">90</option>
          <option :value="180">180</option>
          <option :value="365">365</option>
        </select>
      </div>
    </div>

    <div class="mt-4">
      <div ref="chartEl" style="width:100%;height:280px;overflow:auto;border:1px solid var(--card-border);border-radius:8px;padding:8px;background:var(--bg-chat);"></div>
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
    renderChart(r?.data?.data || []);
    const p = await axios.get(`/api/stream-history/performance?period=${encodeURIComponent(period.value)}&span=${span.value}`);
    perf.value = p?.data ? { range: p.data.range, allTime: p.data.allTime } : perf.value;
  } catch { renderChart([]); }
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

  if (mode.value === 'line') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.style.display = 'block';

    const padX = 6; const padY = 10;
    const stepX = Math.max(1, (w - padX * 2) / Math.max(1, display.length - 1));
    const toY = (v) => Math.round((h - padY) - (Math.max(0, v) / max) * (h - padY * 2));

    let dPath = '';
    display.forEach((p, idx) => {
      const x = Math.round(padX + idx * stepX);
      const y = toY(p.hours || 0);
      dPath += (idx === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    });
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', dPath);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--accent, #4f36ff)');
    path.setAttribute('stroke-width', '3.0');
    svg.appendChild(path);

    display.forEach((p, idx) => {
      const x = Math.round(padX + idx * stepX);
      const y = toY(p.hours || 0);
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', String(x));
      c.setAttribute('cy', String(y));
      c.setAttribute('r', String(3.0));
      c.setAttribute('fill', (p.hours || 0) > 0 ? 'var(--accent, #4f36ff)' : 'rgba(128,128,128,.65)');
      c.style.cursor = 'default';
      c.addEventListener('mouseenter', (e) => {
        tip.textContent = `${p.date ? p.date + ': ' : ''}${(p.hours || 0)} h`;
        tip.style.display = 'block';
        const rect = el.getBoundingClientRect();
        tip.style.left = (e.clientX - rect.left + 10) + 'px';
        tip.style.top = (e.clientY - rect.top + 10) + 'px';
      });
      c.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        tip.style.left = (e.clientX - rect.left + 10) + 'px';
        tip.style.top = (e.clientY - rect.top + 10) + 'px';
      });
      c.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
      svg.appendChild(c);
    });
    el.appendChild(svg);
    return;
  }

  const barW = Math.max(4, Math.floor(w / Math.max(1, display.length)) - 4);
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.alignItems = 'flex-end';
  container.style.gap = '4px';

  display.forEach(d => {
    const v = d.hours || 0;
    const bh = Math.round((v / max) * (h - 20));
    const bar = document.createElement('div');
    bar.style.width = barW + 'px';
    bar.style.height = Math.max(2, bh) + 'px';
    bar.title = `${d.date ? d.date + ': ' : ''}${v} h`;
    bar.style.background = v > 0 ? 'var(--accent, #4f36ff)' : 'rgba(128,128,128,.45)';
    if (mode.value === 'candle') {
      bar.style.border = '1px solid var(--card-border)';
      bar.style.background = 'transparent';
      const fill = document.createElement('div');
      fill.style.height = Math.max(2, bh) + 'px';
      fill.style.background = v > 0 ? 'var(--accent, #4f36ff)' : 'rgba(128,128,128,.65)';
      fill.style.width = '100%';
      bar.appendChild(fill);
    }

    const show = (e) => {
      try {
        tip.textContent = `${d.date ? d.date + ': ' : ''}${v} h`;
        tip.style.display = 'block';
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) + 10;
        const y = (e.clientY - rect.top) + 10;
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
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
  await loadConfig();
  await refresh();
  async function pollStatus() {
    try {
      const r = await axios.get('/api/stream-history/status', { timeout: 4000 });
      status.value = { connected: !!r?.data?.connected, live: !!r?.data?.live };
    } catch { /* keep previous status */ }
  setTimeout(pollStatus, 10000);
  }
  pollStatus();
});

watch([mode, period, span], () => { refresh(); });

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
</style>
