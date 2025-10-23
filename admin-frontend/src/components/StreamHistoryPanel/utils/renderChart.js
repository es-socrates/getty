import { buildDisplayData, formatHours } from './streamHistoryUtils.js';
import i18n from '../../../i18n';

const t = i18n.global.t;

function getActiveLocale() {
  try {
    const current = i18n.global.locale;
    if (typeof current === 'string') return current;
    if (current && typeof current.value === 'string') return current.value;
  } catch {}
  return 'en';
}

function formatViewerCount(value) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  const rounded = Math.round(safe);
  try {
    return new Intl.NumberFormat(getActiveLocale(), { maximumFractionDigits: 0 }).format(rounded);
  } catch {
    return String(rounded);
  }
}

function formatAverageCount(value) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  const abs = Math.abs(safe);
  const digits = abs >= 10 ? 0 : 1;
  try {
    return new Intl.NumberFormat(getActiveLocale(), {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(safe);
  } catch {
    return safe.toFixed(digits);
  }
}

function formatRangeDateString(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.match(/^\s*(\d{4})-(\d{2})-(\d{2})\s*$/);
  if (!m) return raw;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return raw;
  const utcDate = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(utcDate.getTime())) return raw;
  try {
    return new Intl.DateTimeFormat(getActiveLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short',
      timeZone: 'UTC',
    }).format(utcDate);
  } catch {
    return raw;
  }
}

function formatSignedCount(value) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  const rounded = Math.round(safe);
  if (rounded === 0) return '0';
  const prefix = rounded > 0 ? '+' : '-';
  return `${prefix}${formatViewerCount(Math.abs(rounded))}`;
}

function formatPercentChange(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Number(value);
  if (!Number.isFinite(rounded)) return null;
  const abs = Math.abs(rounded);
  const digits = abs >= 10 ? 0 : 1;
  const base = abs.toFixed(digits);
  if (Number(base) === 0) return null;
  const prefix = rounded > 0 ? '+' : '-';
  return `${prefix}${base}%`;
}

function makeUid(prefix = 'spark') {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function prefersReducedMotion() {
  try {
    return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function shouldAnimate(el, modeLabel) {
  if (!el || prefersReducedMotion()) return false;
  const last = el.dataset.lastAnimatedMode || '';
  el.dataset.lastAnimatedMode = modeLabel;
  return last !== modeLabel;
}

function primePathAnimation(path, delayMs = 0) {
  try {
    const totalLen = path.getTotalLength();
    path.style.strokeDasharray = `${totalLen}`;
    path.style.strokeDashoffset = `${totalLen}`;
    path.style.opacity = '0';
    path.style.transition = `stroke-dashoffset 600ms ease ${delayMs}ms, opacity 600ms ease ${delayMs}ms`;
    path.getBoundingClientRect();
    requestAnimationFrame(() => {
      path.style.strokeDashoffset = '0';
      path.style.opacity = '1';
    });
  } catch {}
}

function primeGrowAnimation(el, delayMs = 0) {
  if (!el || prefersReducedMotion()) return;
  try {
    el.style.transformOrigin = 'center bottom';
    el.style.transform = 'scaleY(0.001)';
    el.style.opacity = '0';
    el.style.transition = `transform 420ms cubic-bezier(0.22, 0.68, 0, 1) ${delayMs}ms, opacity 320ms ease ${delayMs}ms`;
    requestAnimationFrame(() => {
      el.style.transform = 'scaleY(1)';
      el.style.opacity = '1';
    });
  } catch {}
}

function renderStreamHistoryChart(el, data, {
  mode = 'line',
  period = 'day',
  showViewers = true,
  smoothWindow = 1,
  goalHours = 0,
} = {}) {
  if (!el) return;
  try { el.innerHTML = ''; } catch {}
  el.style.position = 'relative';
  el.style.background = 'var(--chart-bg, #fefefe)';

  const viewersFlag = showViewers ? '1' : '0';
  const viewersStateChanged = el.dataset.lastViewersState !== viewersFlag;
  el.dataset.lastViewersState = viewersFlag;

  const fallbackW = Number(el.dataset.testWidth || 600);
  const fallbackH = Number(el.dataset.testHeight || 260);
  const w = el.clientWidth ? (el.clientWidth - 20) : (fallbackW - 20);
  const h = el.clientHeight ? (el.clientHeight - 16) : (fallbackH - 16);
  const goal = Number.isFinite(Number(goalHours)) ? Math.max(0, Number(goalHours)) : 0;
  let peakCandidate = null;
  const updatePeak = (candidate) => {
    if (!candidate || !candidate.hours || candidate.hours <= 0) return;
    if (!peakCandidate || candidate.hours > peakCandidate.hours) peakCandidate = candidate;
  };

  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  Object.assign(tip.style, {
    position: 'absolute',
    pointerEvents: 'none',
    padding: '4px 6px',
    fontSize: '12px',
    borderRadius: '4px',
    border: '1px solid var(--card-border)',
    background: 'var(--card-bg, #111827)',
    display: 'none',
    zIndex: 10,
  });
  el.appendChild(tip);
  const placeTipFromMouse = (evt, preferAbove = false) => {
    try {
      const elRect = el.getBoundingClientRect();
      const margin = 10;
      const tipRect = tip.getBoundingClientRect();
      let left = (evt.clientX - elRect.left) + margin;
      left = Math.max(4, Math.min(left, w - tipRect.width - 4));
      const below = (evt.clientY - elRect.top) + margin;
      let top;
      if (preferAbove || (below + tipRect.height > h - 4)) {
        top = Math.max(4, (evt.clientY - elRect.top) - tipRect.height - 12);
      } else {
        top = Math.min(h - tipRect.height - 4, below);
      }
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    } catch {}
  };

  const displayRaw = buildDisplayData(data).map(d => ({ ...d, avgViewers: Number(d?.avgViewers || 0) }));

  const win = Math.max(1, Number(smoothWindow || 1));
  const display = displayRaw.map((d, i, arr) => {
  if (!showViewers || win <= 1) return d;
    let sum = 0; let cnt = 0;
  const half = Math.floor(win / 2);
    const start = Math.max(0, i - half);
    const end = Math.min(arr.length - 1, i + half);
    for (let k = start; k <= end; k++) { sum += Number(arr[k].avgViewers || 0); cnt++; }
    return { ...d, avgViewers: cnt > 0 ? (sum / cnt) : d.avgViewers };
  });
  const maxHours = Math.max(1, ...display.filter(d => d && d.hours != null).map(d => Number(d.hours || 0)));
  const maxViewers = showViewers ? Math.max(0, ...display.map(d => Number(d.avgViewers || 0))) : 0;

  const trimTrailingEmptyBuckets = (source) => {
    const copy = Array.isArray(source) ? [...source] : [];
    while (copy.length > 1) {
      const last = copy[copy.length - 1] || {};
      const hoursVal = Number(last.hours || 0);
      const avgVal = Number(last.avgViewers || 0);
      const peakVal = Number(last.peakViewers || 0);
      if (hoursVal > 0 || avgVal > 0 || peakVal > 0) break;
      copy.pop();
    }
    return copy;
  };
  const barDisplay = trimTrailingEmptyBuckets(display);

  function parseBucketDateString(str) {
    if (typeof str !== 'string') return null;
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const da = Number(m[3]);
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    return new Date(y, mo - 1, da, 0, 0, 0, 0);
  }
  function dateFromBucket(b) {
    if (!b) return null;
    if (Number.isFinite(b.epoch)) {
      const d = new Date(Number(b.epoch));
      if (!isNaN(d)) return d;
    }
    if (b.date) {
      const pd = parseBucketDateString(b.date);
      if (pd) return pd;
      try {
        const d = new Date(b.date);
        if (!isNaN(d)) return d;
      } catch {}
    }
    return null;
  }
  const fmtDate = (bucket) => {
    try {
      const d = dateFromBucket(bucket);
      if (d) return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    } catch {}
    return (bucket && bucket.date) || '';
  };
  const fmtX = (bucket) => {
    try {
      if (period === 'week' && Number.isFinite(Number(bucket?.rangeStartEpoch))) {
        const offset = Number(bucket?.tzOffsetMinutes || 0);
        const startDate = new Date(Number(bucket.rangeStartEpoch) + offset * 60000);
        if (!Number.isNaN(startDate.getTime())) return String(startDate.getDate()).padStart(2, '0');
      }
      const d = dateFromBucket(bucket);
      if (d) {
        if (period === 'day') return String(d.getDate()).padStart(2, '0');
        if (period === 'week') return String(d.getDate()).padStart(2, '0');
        return d.toLocaleDateString(undefined, { month: 'short' });
      }
    } catch {}
    const s = bucket && bucket.date ? bucket.date : '';
    return s.slice(0, 6);
  };

  const getBucketOffset = (bucket) => {
    const offsetVal = Number(bucket?.tzOffsetMinutes || 0);
    return Number.isFinite(offsetVal) ? offsetVal : 0;
  };
  const formatEpochWithOffset = (epoch, bucket, fallbackDate) => {
    const offsetMinutes = getBucketOffset(bucket);
    if (Number.isFinite(epoch)) {
      try {
        const d = new Date(Number(epoch) + offsetMinutes * 60000);
        if (!Number.isNaN(d.getTime())) {
          try {
            return new Intl.DateTimeFormat(getActiveLocale(), {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              weekday: 'short',
            }).format(d);
          } catch {
            return d.toDateString();
          }
        }
      } catch {}
    }
    if (typeof fallbackDate === 'string' && fallbackDate) {
      const formatted = formatRangeDateString(fallbackDate);
      if (formatted) return formatted;
    }
    return null;
  };
  const formatRangeTitle = (bucket) => {
    let startLabel = null;
    let endLabel = null;

    if (typeof bucket?.rangeStartDate === 'string' && bucket.rangeStartDate) {
      startLabel = formatRangeDateString(bucket.rangeStartDate);
    }
    if (!startLabel) {
      startLabel = formatEpochWithOffset(bucket?.rangeStartEpoch, bucket, null);
    }
    if (typeof bucket?.rangeEndDate === 'string' && bucket.rangeEndDate) {
      endLabel = formatRangeDateString(bucket.rangeEndDate);
    }
    if (!endLabel) {
      endLabel = formatEpochWithOffset(bucket?.rangeEndEpoch, bucket, null);
    }
    if (startLabel && endLabel) {
      if (startLabel === endLabel) return startLabel;
      try {
        return t('chartTooltipRange', { start: startLabel, end: endLabel });
      } catch {
        return `${startLabel} – ${endLabel}`;
      }
    }
    return startLabel || endLabel || fmtDate(bucket);
  };
  const buildTooltipHtml = (bucket, hoursValue, avgViewersValue) => {
    const hoursSafe = Number(hoursValue || 0);
    const avgVal = Number.isFinite(Number(avgViewersValue)) ? Number(avgViewersValue) : Number(bucket?.avgViewers || 0);
    const peakVal = Number(bucket?.peakViewers || 0);
    const title = formatRangeTitle(bucket);
    const hoursLabel = (() => {
      try { return formatHours ? formatHours(hoursSafe) : hoursSafe.toFixed(2); } catch { return hoursSafe.toFixed(2); }
    })();
    let html = `<div class="tip-title">${title}</div>`;
    html += `<div class="tip-subtle">${t('chartTooltipHoursStreamed')} ${hoursLabel}</div>`;
    html += `<div class="tip-viewers">${t('chartTooltipParticipants')} ${formatAverageCount(avgVal)}</div>`;
    if (peakVal > 0) {
      html += `<div class="tip-viewers">${t('chartTooltipPeakParticipants')} ${formatViewerCount(peakVal)}</div>`;
    }
    return html;
  };

  if (mode === 'line') {
    const axisLeft = 44;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.style.display = 'block';
    const animateLine = shouldAnimate(el, 'line');
    const drawGrid = (withLabels = false) => {
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', '0'); bg.setAttribute('y', '0');
      bg.setAttribute('width', String(w)); bg.setAttribute('height', String(h));
      bg.setAttribute('fill', 'var(--chart-bg,#fefefe)');
      svg.appendChild(bg);
      const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || '#f3f7fa';
      const lines = 4; const padY = 10; const bottomAxis = 24;
      for (let i = 1; i <= lines; i++) {
        const y = Math.round(padY + ((h - bottomAxis - padY * 2) * i / (lines + 1)));
        const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        ln.setAttribute('x1', String(Math.max(0, axisLeft)));
        ln.setAttribute('y1', String(y));
        ln.setAttribute('x2', String(w));
        ln.setAttribute('y2', String(y));
        ln.setAttribute('stroke', gridColor);
        ln.setAttribute('stroke-width', '1');
        svg.appendChild(ln);
      }
      if (withLabels && maxHours > 0) {
        const labelColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#94a3b8';
        const ticks = lines + 2; const pad = 10; const bottom = 24;
        for (let i = 0; i <= ticks - 1; i++) {
          const y = Math.round(pad + ((h - bottom - pad * 2) * i / (ticks - 1)));
          const val = maxHours * (1 - (i / (ticks - 1)));
          const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          txt.setAttribute('x', '6');
          txt.setAttribute('y', String(Math.max(10, Math.min(h - bottom - 2, y + 3))));
          txt.setAttribute('fill', labelColor);
          txt.setAttribute('font-size', '10');
          txt.setAttribute('text-anchor', 'start');
          try { txt.textContent = formatHours ? formatHours(val) : String(Math.round(val)); } catch { txt.textContent = String(Math.round(val)); }
          svg.appendChild(txt);
        }

        if (maxViewers > 0) {
          for (let i = 0; i <= ticks - 1; i++) {
            const y = Math.round(pad + ((h - bottom - pad * 2) * i / (ticks - 1)));
            const v = maxViewers * (1 - (i / (ticks - 1)));
            const txtR = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            txtR.setAttribute('x', String(w - 6));
            txtR.setAttribute('y', String(Math.max(10, Math.min(h - bottom - 2, y + 3))));
            txtR.setAttribute('fill', labelColor);
            txtR.setAttribute('font-size', '10');
            txtR.setAttribute('text-anchor', 'end');
            txtR.textContent = String(Math.round(v));
            svg.appendChild(txtR);
          }
        }
        const zeroTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        zeroTxt.setAttribute('x', '6');
        zeroTxt.setAttribute('y', String(h - bottom + 12));
        zeroTxt.setAttribute('fill', labelColor);
        zeroTxt.setAttribute('font-size', '10');
        zeroTxt.setAttribute('text-anchor', 'start');
        try { zeroTxt.textContent = formatHours ? formatHours(0) : '0 h'; } catch { zeroTxt.textContent = '0 h'; }
        svg.appendChild(zeroTxt);

        if (goal > 0 && maxHours >= goal) {
          const goalY = Math.round((h - bottomAxis - padY) - (Math.max(0, goal) / maxHours) * (h - bottomAxis - padY * 2));
          const goalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          goalLine.setAttribute('x1', String(axisLeft));
          goalLine.setAttribute('y1', String(goalY));
          goalLine.setAttribute('x2', String(w));
          goalLine.setAttribute('y2', String(goalY));
          goalLine.setAttribute('stroke', 'var(--chart-goal-met,#ee2264)');
          goalLine.setAttribute('stroke-width', '2');
          goalLine.setAttribute('stroke-dasharray', '6 4');
          goalLine.setAttribute('stroke-linecap', 'round');
          goalLine.setAttribute('opacity', '0.75');
          svg.appendChild(goalLine);
        }
      }
    };
    drawGrid(true);
    const padX = 6; const padY = 10; const bottomAxis = 24;
    const innerW = Math.max(1, (w - axisLeft - padX * 2));
    const stepX = Math.max(1, innerW / Math.max(1, display.length - 1));
    const toYHours = (v) => Math.round((h - bottomAxis - padY) - (Math.max(0, v) / maxHours) * (h - bottomAxis - padY * 2));
    const toYViewers = (v) => {
      if (maxViewers <= 0) return Math.round(h - bottomAxis - padY);
      return Math.round((h - bottomAxis - padY) - (Math.max(0, v) / maxViewers) * (h - bottomAxis - padY * 2));
    };
    let dPath = '';
    display.forEach((p, idx) => {
      const hoursValue = Number(p.hours || 0);
      const x = Math.round(axisLeft + padX + idx * stepX);
      const y = toYHours(hoursValue);
      dPath += (idx === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    });
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', dPath);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--line-color, #10b981)');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('class', 'line-path');
    if (animateLine) {
      primePathAnimation(path, 40);
    } else {
      path.style.opacity = '1';
      path.style.transition = 'none';
    }
    svg.appendChild(path);

    let pathV = null;
    const animateViewerLine = showViewers && maxViewers > 0 && (animateLine || viewersStateChanged);
    if (showViewers && maxViewers > 0) {
      let dPathV = '';
      display.forEach((p, idx) => {
        const x = Math.round(axisLeft + padX + idx * stepX);
        const y = toYViewers(Number(p.avgViewers || 0));
        dPathV += (idx === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
      });
      pathV = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathV.setAttribute('d', dPathV);
      pathV.setAttribute('fill', 'none');
      pathV.setAttribute('stroke', 'var(--accent,#553fee)');
      pathV.setAttribute('stroke-width', '3');
      pathV.setAttribute('stroke-linecap', 'round');
      pathV.setAttribute('class', 'line-path viewers');
      if (animateViewerLine) {
        primePathAnimation(pathV, 100);
      } else {
        pathV.style.opacity = '1';
        pathV.style.transition = 'none';
      }
      svg.appendChild(pathV);
    }

    display.forEach((p, idx) => {
      const hoursValue = Number(p.hours || 0);
      const avgViewersValue = Number(p.avgViewers || 0);
      const x = Math.round(axisLeft + padX + idx * stepX);
      const y = toYHours(hoursValue);
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', String(x)); c.setAttribute('cy', String(y)); c.setAttribute('r', '3');
      const meetsGoal = goal > 0 && hoursValue >= goal;
      const hourFill = hoursValue > 0
        ? (goal > 0 ? (meetsGoal ? 'var(--chart-goal-met,#ee2264)' : 'var(--line-color,#10b981)') : 'var(--line-color,#10b981)')
        : 'rgba(128,128,128,.65)';
      c.setAttribute('fill', hourFill);
      c.classList.add('line-point');
      if (animateLine) {
        c.style.opacity = '0';
        c.style.transition = `opacity 360ms ease ${140 + idx * 12}ms`;
      } else {
        c.style.opacity = '1';
      }
      const showTip = (e) => {
        tip.innerHTML = buildTooltipHtml(p, hoursValue, avgViewersValue);
        tip.style.display = 'block';
        placeTipFromMouse(e, hoursValue === 0);
      };
      c.addEventListener('mouseenter', showTip);
      c.addEventListener('mousemove', showTip);
      c.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
      svg.appendChild(c);
      if (animateLine) {
        requestAnimationFrame(() => { try { c.style.opacity = '1'; } catch {} });
      }
  updatePeak({ hours: hoursValue, avgViewers: avgViewersValue, x, y });

      if (showViewers && maxViewers > 0) {
        const yv = toYViewers(avgViewersValue);
        const cv = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        cv.setAttribute('cx', String(x)); cv.setAttribute('cy', String(yv)); cv.setAttribute('r', '3');
        cv.setAttribute('fill', 'var(--accent,#553fee)');
        cv.classList.add('line-point-viewers');
        if (animateViewerLine) {
          cv.style.opacity = '0';
          cv.style.transition = `opacity 360ms ease ${170 + idx * 12}ms`;
        } else {
          cv.style.opacity = '1';
        }
        const show = (e) => {
          tip.innerHTML = buildTooltipHtml(p, hoursValue, avgViewersValue);
          tip.style.display = 'block';
          placeTipFromMouse(e, hoursValue === 0);
        };
        cv.addEventListener('mouseenter', show);
        cv.addEventListener('mousemove', show);
        cv.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
        svg.appendChild(cv);
        if (animateViewerLine) {
          requestAnimationFrame(() => { try { cv.style.opacity = '1'; } catch {} });
        }
      }
    });
  const maxLabels = 8; const stride = Math.max(1, Math.ceil(display.length / maxLabels));
    const labelColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#94a3b8';
    for (let i = 0; i < display.length; i += stride) {
  const x = Math.round(axisLeft + padX + i * stepX);
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', String(x)); txt.setAttribute('y', String(h - Math.max(6, Math.round(24 / 3))));
      txt.setAttribute('fill', labelColor); txt.setAttribute('font-size', '10'); txt.setAttribute('text-anchor', 'middle');
  txt.textContent = fmtX(display[i]);
      svg.appendChild(txt);
    }
  el.appendChild(svg);
  return { peak: peakCandidate };
  }

  const axisLeft = 44; const gap = 4;
  const series = barDisplay;
  const seriesLength = Math.max(1, series.length);
  const barW = Math.max(8, Math.floor((w - axisLeft - gap * Math.max(0, seriesLength - 1)) / seriesLength));
  const animateBars = shouldAnimate(el, mode === 'candle' ? 'candle' : 'bar');
  const gridSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  gridSvg.setAttribute('width', String(w)); gridSvg.setAttribute('height', String(h));
  gridSvg.style.position = 'absolute'; gridSvg.style.left = '0'; gridSvg.style.top = '0'; gridSvg.style.pointerEvents = 'none';
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', '0'); bg.setAttribute('y', '0'); bg.setAttribute('width', String(w)); bg.setAttribute('height', String(h)); bg.setAttribute('fill', 'var(--chart-bg,#fefefe)');
  gridSvg.appendChild(bg);

  try {
    const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || '#f3f7fa';
    const labelColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#94a3b8';
    const lines = 4; const padY = 10; const bottomAxis = 24;
    for (let i = 1; i <= lines; i++) {
      const y = Math.round(padY + ((h - bottomAxis - padY * 2) * i / (lines + 1)));
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1', String(Math.max(0, axisLeft)));
      ln.setAttribute('y1', String(y));
      ln.setAttribute('x2', String(w));
      ln.setAttribute('y2', String(y));
      ln.setAttribute('stroke', gridColor);
      ln.setAttribute('stroke-width', '1');
      gridSvg.appendChild(ln);
    }
  if (maxHours > 0) {
      const ticks = lines + 2; const pad = 10; const bottom = 24;
      for (let i = 0; i <= ticks - 1; i++) {
        const y = Math.round(pad + ((h - bottom - pad * 2) * i / (ticks - 1)));
    const val = maxHours * (1 - (i / (ticks - 1)));
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', '6');
        txt.setAttribute('y', String(Math.max(10, Math.min(h - bottom - 2, y + 3))));
        txt.setAttribute('fill', labelColor);
        txt.setAttribute('font-size', '10');
        txt.setAttribute('text-anchor', 'start');
  try { txt.textContent = formatHours ? formatHours(val) : String(Math.round(val)); } catch { txt.textContent = String(Math.round(val)); }
        gridSvg.appendChild(txt);
      }
      const zeroTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      zeroTxt.setAttribute('x', '6');
      zeroTxt.setAttribute('y', String(h - bottom + 12));
      zeroTxt.setAttribute('fill', labelColor);
      zeroTxt.setAttribute('font-size', '10');
      zeroTxt.setAttribute('text-anchor', 'start');
      try { zeroTxt.textContent = formatHours ? formatHours(0) : '0 h'; } catch { zeroTxt.textContent = '0 h'; }
      gridSvg.appendChild(zeroTxt);

      if (goal > 0 && maxHours >= goal) {
        const goalY = Math.round(padY + ((h - bottomAxis - padY * 2) * (1 - (goal / maxHours))));
        const goalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        goalLine.setAttribute('x1', String(axisLeft));
        goalLine.setAttribute('y1', String(goalY));
        goalLine.setAttribute('x2', String(w));
        goalLine.setAttribute('y2', String(goalY));
        goalLine.setAttribute('stroke', 'var(--chart-goal-met,#ee2264)');
        goalLine.setAttribute('stroke-width', '2');
        goalLine.setAttribute('stroke-dasharray', '6 4');
        goalLine.setAttribute('stroke-linecap', 'round');
        goalLine.setAttribute('opacity', '0.75');
        gridSvg.appendChild(goalLine);
      }
    }

    const bottomLabelY = h - Math.max(6, Math.round(24 / 3));
    const maxLabels = 8; const stride = Math.max(1, Math.ceil(series.length / maxLabels));
    for (let i = 0; i < series.length; i += stride) {
      const centerX = Math.round(axisLeft + (barW + gap) * i + barW / 2);
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', String(centerX)); txt.setAttribute('y', String(bottomLabelY));
      txt.setAttribute('fill', labelColor); txt.setAttribute('font-size', '10'); txt.setAttribute('text-anchor', 'middle');
      txt.textContent = fmtX(series[i]);
      gridSvg.appendChild(txt);
    }
  } catch {}
  el.appendChild(gridSvg);
  const container = document.createElement('div');
  Object.assign(container.style, { display: 'flex', alignItems: 'flex-end', gap: gap + 'px', position: 'relative', zIndex: '1', marginLeft: axisLeft + 'px' });
  const bottomAxis = 24; const padY = 10; const innerHeight = Math.max(1, h - bottomAxis - padY * 2); container.style.height = innerHeight + 'px'; container.style.marginTop = padY + 'px';
  const maxVal = maxHours; const available = innerHeight;
  series.forEach((d, idx) => {
    const v = d.hours || 0;
    const bh = Math.round((v / maxVal) * available);
    const bar = document.createElement('div');
    bar.style.width = barW + 'px';
    bar.style.height = Math.max(2, bh) + 'px';
    const ariaTitle = (() => {
      try {
        const fragments = [];
        const rangeTitle = formatRangeTitle(d);
        if (rangeTitle) fragments.push(rangeTitle);
        fragments.push(`${t('chartTooltipHoursStreamed')} ${formatHours ? formatHours(v) : v}`);
        fragments.push(`${t('chartTooltipParticipants')} ${formatAverageCount(Number(d.avgViewers || 0))}`);
        const peakVal = Number(d.peakViewers || 0);
        if (peakVal > 0) fragments.push(`${t('chartTooltipPeakParticipants')} ${formatViewerCount(peakVal)}`);
        return fragments.join('. ');
      } catch {
        return '';
      }
    })();
    if (ariaTitle) { bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', ariaTitle); }
    const meetsGoal = goal > 0 && v >= goal;
  const positiveColor = meetsGoal ? 'var(--chart-goal-met,#ee2264)' : 'var(--bar-positive,#10b981)';
    const neutralColor = goal > 0 ? 'var(--chart-goal-base,rgba(148,163,184,0.45))' : 'rgba(128,128,128,.35)';
    bar.style.background = v > 0 ? positiveColor : neutralColor;
    bar.style.borderRadius = '4px';
    bar.className = 'bar';
    if (!animateBars) {
      bar.style.opacity = '1';
      bar.style.transform = 'none';
      bar.style.transition = 'none';
    }
    if (mode === 'candle') {
      bar.style.background = 'transparent';
      const wrap = document.createElement('div'); wrap.style.position = 'relative'; wrap.style.width = '100%'; wrap.style.height = Math.max(2, bh) + 'px';
      const fill = document.createElement('div'); fill.style.height = '100%'; fill.style.background = v > 0 ? positiveColor : 'rgba(128,128,128,.55)'; fill.style.width = '100%'; fill.style.borderRadius = '4px'; wrap.appendChild(fill);

      if (showViewers && maxViewers > 0) {
        const vh = Math.round((Math.max(0, Number(d.avgViewers || 0)) / maxViewers) * available);
        const viewersLine = document.createElement('div');
        viewersLine.style.position = 'absolute'; viewersLine.style.left = '0'; viewersLine.style.right = '0';
        viewersLine.style.bottom = '0'; viewersLine.style.height = Math.max(2, Math.min(vh, available)) + 'px';
        viewersLine.style.background = 'var(--accent,#553fee)'; viewersLine.style.opacity = '0.75';
        viewersLine.style.borderRadius = '4px';
        wrap.appendChild(viewersLine);
      }
      bar.appendChild(wrap);
    }
    const show = (e) => {
      try {
        tip.innerHTML = buildTooltipHtml(d, v, Number(d.avgViewers || 0));
        tip.style.display = 'block';
        placeTipFromMouse(e, v === 0);
      } catch {}
    };
    const hide = () => { tip.style.display = 'none'; };
    bar.addEventListener('mouseenter', show);
    bar.addEventListener('mousemove', show);
    bar.addEventListener('mouseleave', hide);
    const delay = Math.min(idx * 18, 180);
    if (animateBars) {
      primeGrowAnimation(mode === 'candle' ? bar.firstChild : bar, delay + 80);
      primeGrowAnimation(bar, delay);
    }
    container.appendChild(bar);
    const barTop = padY + Math.max(0, available - Math.max(2, bh));
    const centerX = Math.round(axisLeft + (barW + gap) * idx + barW / 2);
    updatePeak({ hours: Number(v || 0), avgViewers: Number(d.avgViewers || 0), x: centerX, y: barTop });
  });
  el.appendChild(container);
  return { peak: peakCandidate };
}

function renderViewersSparkline(el, data, { period: _period = 'day', smoothWindow = 1 } = {}) {
  if (!el) return;
  try { el.innerHTML = ''; } catch {}
  el.style.position = 'relative';
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.gap = '8px';
  const fallbackW = Number(el.dataset.testWidth || 260);
  const fallbackH = Number(el.dataset.testHeight || 70);
  const w = el.clientWidth ? el.clientWidth : fallbackW;
  const h = el.clientHeight ? el.clientHeight : fallbackH;

  const displayRaw = buildDisplayData(data).map(d => ({ ...d, avgViewers: Number(d?.avgViewers || 0) }));
  const win = Math.max(1, Number(smoothWindow || 1));
  const viewers = displayRaw.map((d, i, arr) => {
    if (win <= 1) return d.avgViewers;
    let sum = 0; let cnt = 0;
    const half = Math.floor(win / 2);
    const start = Math.max(0, i - half);
    const end = Math.min(arr.length - 1, i + half);
    for (let k = start; k <= end; k++) { sum += Number(arr[k].avgViewers || 0); cnt++; }
    return cnt > 0 ? sum / cnt : d.avgViewers;
  });
  const maxViewers = Math.max(0, ...viewers);
  if (!viewers.length || maxViewers <= 0) {
    const empty = document.createElement('div');
    empty.className = 'sparkline-empty';
    try { empty.textContent = t('streamHistoryViewersTrendEmpty'); } catch { empty.textContent = 'No viewer data'; }
    el.appendChild(empty);
    return;
  }

  const positiveViewers = viewers.filter(v => v > 0);
  const minPositiveViewers = positiveViewers.length ? Math.min(...positiveViewers) : 0;
  const avgViewers = viewers.reduce((acc, cur) => acc + cur, 0) / viewers.length;
  const firstValue = viewers[0];
  const lastValue = viewers[viewers.length - 1];
  const changeValue = lastValue - firstValue;
  const changePercent = firstValue > 0 ? (changeValue / firstValue) * 100 : null;
  const peakIndex = viewers.indexOf(maxViewers);
  const hasAvgBand = avgViewers > 0 && avgViewers < maxViewers;

  const uid = makeUid();

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.style.display = 'block';

  const padX = 4;
  const padY = 6;
  const innerW = Math.max(1, w - padX * 2);
  const innerH = Math.max(1, h - padY * 2);
  const stepX = viewers.length === 1 ? 0 : innerW / (viewers.length - 1);
  const toY = (v) => padY + innerH - (Math.max(0, v) / maxViewers) * innerH;

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  gradient.setAttribute('id', `${uid}-fill`);
  gradient.setAttribute('x1', '0');
  gradient.setAttribute('x2', '0');
  gradient.setAttribute('y1', '0');
  gradient.setAttribute('y2', '1');
  const stopTop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stopTop.setAttribute('offset', '0%');
  stopTop.setAttribute('stop-color', 'var(--accent,#553fee)');
  stopTop.setAttribute('stop-opacity', '0.35');
  const stopBottom = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stopBottom.setAttribute('offset', '100%');
  stopBottom.setAttribute('stop-color', 'var(--accent,#553fee)');
  stopBottom.setAttribute('stop-opacity', '0.04');
  gradient.appendChild(stopTop);
  gradient.appendChild(stopBottom);
  defs.appendChild(gradient);
  svg.appendChild(defs);

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', String(w));
  bg.setAttribute('height', String(h));
  bg.setAttribute('fill', 'var(--chart-bg,#fefefe)');
  bg.setAttribute('rx', '6');
  svg.appendChild(bg);

  const areaPathD = (() => {
    let dStr = `M ${padX} ${padY + innerH}`;
    viewers.forEach((val, idx) => {
      const x = padX + idx * stepX;
      const y = toY(val);
      dStr += ` L ${x} ${y}`;
    });
    dStr += ` L ${padX + (viewers.length - 1) * stepX} ${padY + innerH} Z`;
    return dStr;
  })();
  const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  areaPath.setAttribute('d', areaPathD);
  areaPath.setAttribute('fill', `url(#${uid}-fill)`);
  areaPath.setAttribute('opacity', '1');
  svg.appendChild(areaPath);

  const dPath = viewers.map((val, idx) => {
    const x = padX + idx * stepX;
    const y = toY(val);
    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', dPath);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'var(--accent,#553fee)');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  svg.appendChild(path);

  if (hasAvgBand) {
    const avgY = toY(avgViewers);
    const avgLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    avgLine.setAttribute('d', `M ${padX} ${avgY} L ${padX + innerW} ${avgY}`);
    avgLine.setAttribute('stroke', 'var(--sparkline-avg-line,#1d4ed8)');
    avgLine.setAttribute('stroke-width', '1');
    avgLine.setAttribute('stroke-dasharray', '4 4');
    avgLine.setAttribute('opacity', '0.65');
    svg.appendChild(avgLine);

    const avgLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    avgLabel.setAttribute('x', String(padX + 6));
    avgLabel.setAttribute('y', String(Math.max(12, avgY - 6)));
    avgLabel.setAttribute('fill', 'var(--sparkline-avg-line,#1d4ed8)');
    avgLabel.setAttribute('font-size', '10');
    avgLabel.setAttribute('font-weight', '600');
    avgLabel.textContent = `${t('streamHistoryViewersTrendAverageLabel')} · ${formatViewerCount(avgViewers)}`;
    svg.appendChild(avgLabel);
  }

  const lastX = padX + (viewers.length - 1) * stepX;
  const lastY = toY(viewers[viewers.length - 1]);
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('cx', String(lastX));
  dot.setAttribute('cy', String(lastY));
  dot.setAttribute('r', '3');
  dot.setAttribute('fill', 'var(--accent,#553fee)');
  svg.appendChild(dot);

  const lastLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  lastLabel.setAttribute('x', String(lastX));
  lastLabel.setAttribute('y', String(Math.max(10, lastY - 6)));
  lastLabel.setAttribute('fill', 'var(--text-secondary,#475569)');
  lastLabel.setAttribute('font-size', '10');
  lastLabel.setAttribute('text-anchor', 'end');
  lastLabel.textContent = formatViewerCount(lastValue);
  svg.appendChild(lastLabel);

  if (peakIndex >= 0) {
    const peakX = padX + peakIndex * stepX;
    const peakY = toY(maxViewers);
    const peakMarker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    peakMarker.setAttribute('cx', String(peakX));
    peakMarker.setAttribute('cy', String(peakY));
    peakMarker.setAttribute('r', '4');
    peakMarker.setAttribute('fill', 'var(--sparkline-peak-color,#dc2626)');
    peakMarker.setAttribute('opacity', '0.9');
    svg.appendChild(peakMarker);

    const peakLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    peakLabel.setAttribute('x', String(peakX + 6));
    peakLabel.setAttribute('y', String(Math.max(12, peakY - 8)));
    peakLabel.setAttribute('fill', 'var(--sparkline-peak-color,#dc2626)');
    peakLabel.setAttribute('font-size', '10');
    peakLabel.setAttribute('font-weight', '600');
    peakLabel.textContent = `${t('streamHistoryViewersTrendPeakLabel')} · ${formatViewerCount(maxViewers)}`;
    svg.appendChild(peakLabel);
  }

  el.appendChild(svg);

  const meta = document.createElement('div');
  meta.className = 'sparkline-meta';

  const peakBadge = document.createElement('div');
  peakBadge.className = 'sparkline-badge sparkline-badge--peak';
  peakBadge.innerHTML = `
    <span class="sparkline-dot" aria-hidden="true"></span>
    <span class="sparkline-badge-label">${t('streamHistoryViewersTrendPeakLabel')}</span>
    <span class="sparkline-badge-value">${formatViewerCount(maxViewers)}</span>
  `;
  meta.appendChild(peakBadge);

  const avgBadge = document.createElement('div');
  avgBadge.className = 'sparkline-badge sparkline-badge--avg';
  avgBadge.innerHTML = `
    <span class="sparkline-dot" aria-hidden="true"></span>
    <span class="sparkline-badge-label">${t('streamHistoryViewersTrendAverageLabel')}</span>
    <span class="sparkline-badge-value">${formatViewerCount(avgViewers)}</span>
  `;
  meta.appendChild(avgBadge);

  const changeBadge = document.createElement('div');
  const trendClasses = ['sparkline-badge', 'sparkline-badge--trend'];
  const changeThreshold = minPositiveViewers > 0 ? Math.max(1, minPositiveViewers * 0.02) : 1;
  if (changeValue > changeThreshold) trendClasses.push('sparkline-badge--trend-up');
  else if (changeValue < -changeThreshold) trendClasses.push('sparkline-badge--trend-down');
  else trendClasses.push('sparkline-badge--trend-flat');
  changeBadge.className = trendClasses.join(' ');
  const percentText = formatPercentChange(changePercent);
  const changeValueText = formatSignedCount(changeValue);
  changeBadge.innerHTML = `
    <span class="sparkline-dot" aria-hidden="true"></span>
    <span class="sparkline-badge-label">${t('streamHistoryViewersTrendChangeLabel')}</span>
    <span class="sparkline-badge-value">${changeValueText}</span>
    ${percentText ? `<span class="sparkline-badge-note">${percentText}</span>` : ''}
  `;
  meta.appendChild(changeBadge);

  el.appendChild(meta);
}

export { renderStreamHistoryChart, renderViewersSparkline };
// eslint-disable-next-line no-undef
if (typeof module !== 'undefined' && module?.exports) { module.exports = { renderStreamHistoryChart, renderViewersSparkline }; }
