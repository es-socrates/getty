import { ref, onMounted, onUnmounted, watch, computed, defineExpose } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';
import { pushToast } from '../../services/toast';

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
const perf = ref({
  range: { hoursStreamed: 0, avgViewers: 0, peakViewers: 0, hoursWatched: 0, activeDays: 0 },
  allTime: { totalHoursStreamed: 0, highestViewers: 0 },
});
const status = ref({ connected: false, live: false });
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
  try {
    window.removeEventListener('keydown', onKeydown);
  } catch {}
  try {
    if (ro && ro.disconnect) ro.disconnect();
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

    if (changed) {
      showClaimChangeModal.value = true;
    }
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
    const r = await api.get(
      `/api/stream-history/summary?period=${encodeURIComponent(period.value)}&span=${span.value}`
    );
    lastSummaryData.value = r?.data?.data || [];
    renderChart(lastSummaryData.value);
    const p = await api.get(
      `/api/stream-history/performance?period=${encodeURIComponent(period.value)}&span=${span.value}`
    );
    perf.value = p?.data ? { range: p.data.range, allTime: p.data.allTime } : perf.value;

    try {
      const pr = await api.get('/api/ar-price');
      arUsd.value = pr?.data?.arweave?.usd || arUsd.value;
    } catch {}

    try {
      const er = await api.get('/api/last-tip/earnings');
      totalAR.value = Number(er?.data?.totalAR || 0);
    } catch {}
  } catch {
    renderChart([]);
  }
}

function onQuickFilterChange() {
  try {
    if (
      filterQuick.value === 'day' ||
      filterQuick.value === 'week' ||
      filterQuick.value === 'month' ||
      filterQuick.value === 'year'
    ) {
      period.value = filterQuick.value;
      refresh();
    }
  } catch {}
}

function onQuickRangeChange() {
  try {
    const v = Number(filterQuickSpan.value || 30);
    if ([7, 14, 30, 90, 180, 365].includes(v)) {
      span.value = v;
      refresh();
    }
  } catch {}
}

async function clearHistory() {
  try {
    showClearModal.value = true;
  } catch {
    try {
      pushToast({ type: 'error', message: t('streamHistoryClearFailed') });
    } catch {}
  }
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
      let left = evt.clientX - elRect.left + margin;
      left = Math.max(4, Math.min(left, el.clientWidth - tipRect.width - 4));
      const below = evt.clientY - elRect.top + margin;
      let top;
      if (preferAbove || below + tipRect.height > el.clientHeight - 4) {
        top = Math.max(4, evt.clientY - elRect.top - tipRect.height - 12);
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
  const max = Math.max(1, ...trimmed.map((d) => d.hours || 0));

  const drawGrid = (svg, withLabels = false, maxVal = 0, axisLeft = 0) => {
    const bottomAxis = 24;
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(w));
    bg.setAttribute('height', String(h));
    bg.setAttribute('fill', 'var(--chart-bg, #fefefe)');
    svg.appendChild(bg);

    const gridColor =
      getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() ||
      '#f3f7fa';
    const lines = 4;
    const padY = 10;
    for (let i = 1; i <= lines; i++) {
      const y = Math.round(padY + ((h - bottomAxis - padY * 2) * i) / (lines + 1));
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
      const labelColor =
        getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() ||
        '#94a3b8';
      const ticks = lines + 2;
      for (let i = 0; i <= ticks - 1; i++) {
        const y = Math.round(padY + ((h - bottomAxis - padY * 2) * i) / (ticks - 1));
        const val = maxVal * (1 - i / (ticks - 1));
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', '6');

        txt.setAttribute('y', String(Math.max(10, Math.min(h - bottomAxis - 2, y + 3))));
        txt.setAttribute('fill', labelColor);
        txt.setAttribute('font-size', '10');
        txt.setAttribute('text-anchor', 'start');

        try {
          txt.textContent = fmtHours(val);
        } catch {
          txt.textContent = String(Math.round(val));
        }
        svg.appendChild(txt);
      }
    }
  };

  const drawXAxis = (svg, axisLeft, positions, labels) => {
    const bottomAxis = 24;
    const labelColor =
      getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() ||
      '#94a3b8';
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
        const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
        return new Date(y, m - 1, d);
      }
      if (/^\d{4}-\d{2}$/.test(s)) {
        const [y, m] = s.split('-').map((n) => parseInt(n, 10));
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
      if (!isNaN(d))
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    } catch {}
    return s || '';
  };
  const fmtXLabel = (s) => {
    try {
      const d = parseLocalFromLabel(s) || new Date(s);
      if (!isNaN(d)) {
        if (period.value === 'day' || period.value === 'week')
          return String(d.getDate()).padStart(2, '0');
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

    const padX = 6;
    const padY = 10;
    const bottomAxis = 24;
    const innerW = Math.max(1, w - axisLeft - padX * 2);
    const stepX = Math.max(1, innerW / Math.max(1, display.length - 1));
    const toY = (v) =>
      Math.round(h - bottomAxis - padY - (Math.max(0, v) / max) * (h - bottomAxis - padY * 2));

    const gradId = 'sh-grad-' + Math.random().toString(36).slice(2);
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const lg = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    lg.setAttribute('id', gradId);
    lg.setAttribute('x1', '0');
    lg.setAttribute('y1', '0');
    lg.setAttribute('x2', '0');
    lg.setAttribute('y2', '1');
    const st0 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    st0.setAttribute('offset', '0%');
    st0.setAttribute('stop-color', '#2261ee');
    st0.setAttribute('stop-opacity', '0.24');
    const st1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    st1.setAttribute('offset', '100%');
    st1.setAttribute('stop-color', '#2261ee');
    st1.setAttribute('stop-opacity', '0');
    lg.appendChild(st0);
    lg.appendChild(st1);
    defs.appendChild(lg);
    svg.appendChild(defs);

    let dPath = '';
    display.forEach((p, idx) => {
      const x = Math.round(axisLeft + padX + idx * stepX);
      const y = toY(p.hours || 0);
      dPath += idx === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });

    try {
      const x0 = Math.round(axisLeft + padX + 0 * stepX);
      const xN = Math.round(axisLeft + padX + Math.max(0, display.length - 1) * stepX);
      const yBase = toY(0);
      const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      areaPath.setAttribute('d', `${dPath} L ${xN} ${yBase} L ${x0} ${yBase} Z`);
      areaPath.setAttribute('fill', `url(#${gradId})`);
      areaPath.setAttribute('stroke', 'none');
      svg.appendChild(areaPath);
    } catch {}
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', dPath);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--line-color, #2261ee)');
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
      c.setAttribute(
        'fill',
        (p.hours || 0) > 0 ? 'var(--line-color, #10b981)' : 'rgba(128,128,128,.65)'
      );
      c.setAttribute(
        'fill',
        (p.hours || 0) > 0 ? 'var(--line-color, #2261ee)' : 'rgba(128,128,128,.65)'
      );
      c.setAttribute('class', 'line-point');
      c.style.cursor = 'default';
      c.addEventListener('mouseenter', (e) => {
        const title = fmtDateTitle(p.date);
        tip.innerHTML = `<div class="tip-title">${title}</div><div class="tip-subtle">${p.hours || 0} h</div>`;
        tip.style.display = 'block';
        placeTipFromMouse(e, (p.hours || 0) === 0);
      });
      c.addEventListener('mousemove', (e) => {
        placeTipFromMouse(e, (p.hours || 0) === 0);
      });
      c.addEventListener('mouseleave', () => {
        tip.style.display = 'none';
      });
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
    const innerW = Math.max(1, w - axisLeft - padX * 2);
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
  display.forEach((d) => {
    const v = d.hours || 0;
    const bh = Math.round((v / max) * available);
    const bar = document.createElement('div');
    bar.style.width = barW + 'px';
    bar.style.height = Math.max(2, bh) + 'px';
    bar.title = `${d.date ? d.date + ': ' : ''}${v} h`;
    bar.style.background = v > 0 ? 'var(--bar-positive, #2261ee)' : 'rgba(128,128,128,.35)';
    bar.style.borderRadius = '6px';
    bar.style.boxShadow = v > 0 ? '0 1px 0 rgba(0,0,0,.06)' : 'none';
    bar.className = 'bar';
    if (mode.value === 'candle') {
      bar.style.border = '1px solid var(--card-border)';
      bar.style.background = 'transparent';
      const fill = document.createElement('div');
      fill.style.height = Math.max(2, bh) + 'px';
      fill.style.background = v > 0 ? 'var(--bar-positive, #2261ee)' : 'rgba(128,128,128,.55)';
      fill.style.width = '100%';
      fill.style.borderRadius = '6px';
      bar.appendChild(fill);
    }

    const show = (e) => {
      try {
        const title = fmtDateTitle(d.date);
        tip.innerHTML = `<div class="tip-title">${title}</div><div class="tip-subtle">${v} h</div>`;
        tip.style.display = 'block';
        placeTipFromMouse(e, v === 0);
      } catch {}
    };
    const hide = () => {
      tip.style.display = 'none';
    };
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
    if (v === '1' || v === '0') overlayCollapsed.value = v === '1';
  } catch {}
  try {
    const h = localStorage.getItem(EARNINGS_HIDE_KEY);
    if (h === '1' || h === '0') earningsHidden.value = h === '1';
  } catch {}
  await loadConfig();
  await refresh();

  try {
    const el = chartEl.value;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        try {
          chartEl.value?.classList.add('reflowing');
        } catch {}
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          try {
            renderChart(lastSummaryData.value || []);
          } catch {}
          try {
            setTimeout(() => chartEl.value?.classList.remove('reflowing'), 120);
          } catch {}
        }, 80);
      });
      ro.observe(el);
    } else {
      const onR = () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => renderChart(lastSummaryData.value || []), 120);
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
      status.value = { connected: !!r?.data?.connected, live: !!r?.data?.live };
    } catch {
      /* keep previous status */
    }
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

watch([mode, period, span], () => {
  refresh();
});
watch(period, (p) => {
  if (p === 'day' || p === 'week' || p === 'month' || p === 'year') {
    filterQuick.value = p;
  }
});
watch(span, (s) => {
  if ([7, 14, 30, 90, 180, 365].includes(Number(s))) {
    filterQuickSpan.value = Number(s);
  }
});

watch(overlayCollapsed, (v) => {
  try {
    localStorage.setItem(OVERLAY_KEY, v ? '1' : '0');
  } catch {}
});

watch(earningsHidden, (v) => {
  try {
    localStorage.setItem(EARNINGS_HIDE_KEY, v ? '1' : '0');
  } catch {}
});

function fmtHours(h) {
  const v = Number(h || 0);
  if (v >= 24) {
    const snapped = Math.round(v / 24) * 24;
    if (snapped >= 48) return snapped + ' h (' + snapped / 24 + ' d)';
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

defineExpose({
  chartEl,
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
  usdFromAr,
  fmtHours,
  fmtTotal,
  lastSummaryData,
  initialClaimid,
});
