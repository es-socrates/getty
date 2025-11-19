/* global module */
import { buildDisplayData, formatHours } from './streamHistoryUtils.js';

let runtimeLocale = 'en';

const DEFAULT_LABELS = Object.freeze({
  chartTooltipRange: '{start} – {end}',
  chartTooltipHoursStreamed: 'Hours streamed:',
  chartTooltipParticipants: 'Avg viewers:',
  chartTooltipPeakParticipants: 'Peak viewers:',
  streamHistoryViewersTrendEmpty: 'No viewer data yet',
  streamHistoryViewersTrendAverageLabel: 'Avg viewers',
  streamHistoryViewersTrendPeakLabel: 'Peak viewers',
  streamHistoryViewersTrendChangeLabel: 'Change',
});

function formatTemplate(template, params = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{(\w+)\}/g, (match, token) => {
    if (Object.prototype.hasOwnProperty.call(params, token)) {
      const value = params[token];
      return value == null ? '' : String(value);
    }
    return '';
  });
}

function getFallbackTranslator() {
  return (key, params = {}) => {
    const template = DEFAULT_LABELS[key] || key;
    return formatTemplate(template, params);
  };
}

function getTranslatorCandidate(custom) {
  if (typeof custom === 'function') return custom;
  try {
    const globalTranslator = globalThis?.__chartTranslate;
    if (typeof globalTranslator === 'function') return globalTranslator;
  } catch {}
  try {
    const injected = globalThis?.__i18n || globalThis?.i18n;
    if (injected && typeof injected.t === 'function') {
      return injected.t.bind(injected);
    }
  } catch {}
  return getFallbackTranslator();
}

function resolveLocalePreference(locale) {
  if (locale && typeof locale === 'string') return locale;
  try {
    const docLang = document?.documentElement?.getAttribute('lang');
    if (docLang) return docLang;
  } catch {}
  try {
    if (typeof navigator !== 'undefined') {
      if (navigator.language) return navigator.language;
      if (Array.isArray(navigator.languages) && navigator.languages.length) {
        return navigator.languages[0];
      }
    }
  } catch {}
  return 'en';
}

function getActiveLocale() {
  return typeof runtimeLocale === 'string' && runtimeLocale ? runtimeLocale : 'en';
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

function calcGridLayout(height) {
  const safeHeight = Number(height);
  if (!Number.isFinite(safeHeight) || safeHeight <= 0) {
    return { lines: 4, padY: 10, bottomAxis: 24 };
  }
  if (safeHeight < 140) {
    return { lines: 2, padY: 5, bottomAxis: 16 };
  }
  if (safeHeight < 200) {
    return { lines: 3, padY: 8, bottomAxis: 20 };
  }
  return { lines: 4, padY: 10, bottomAxis: 24 };
}

function shouldAnimate(el, modeLabel, signature) {
  if (!el || prefersReducedMotion()) return false;
  const lastMode = el.dataset.lastAnimatedMode || '';
  const lastSignature = el.dataset.lastAnimatedSignature || '';
  const modeChanged = lastMode !== modeLabel;
  const signatureChanged =
    typeof signature === 'string' ? signature !== lastSignature : false;
  if (modeChanged || signatureChanged) {
    el.dataset.lastAnimatedMode = modeLabel;
    if (typeof signature === 'string') {
      el.dataset.lastAnimatedSignature = signature;
    } else if (el.dataset.lastAnimatedSignature && signature == null) {
      delete el.dataset.lastAnimatedSignature;
    }
    return true;
  }
  return false;
}

function buildAnimationSignature(display, { chartMode, showViewersFlag, period, goalHours }) {
  if (!Array.isArray(display) || display.length === 0) {
    return `${chartMode || 'line'}|empty|${showViewersFlag ? 'v1' : 'v0'}|${period || ''}|${
      Number(goalHours || 0).toFixed(2)
    }`;
  }
  const len = display.length;
  const first = display[0] || {};
  const mid = display[Math.floor(len / 2)] || {};
  const last = display[len - 1] || {};
  const parts = [
    chartMode || 'line',
    showViewersFlag ? 'v1' : 'v0',
    period || '',
    len,
    Number(goalHours || 0).toFixed(2),
    Number(first.hours || 0).toFixed(2),
    Number(first.avgViewers || 0).toFixed(2),
    Number(mid.hours || 0).toFixed(2),
    Number(mid.avgViewers || 0).toFixed(2),
    Number(last.hours || 0).toFixed(2),
    Number(last.avgViewers || 0).toFixed(2),
  ];
  return parts.join('|');
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

function renderStreamHistoryChart(
  el,
  data,
  {
    mode = 'line',
    period = 'day',
    showViewers = true,
    showHours = true,
    smoothWindow = 1,
    goalHours = 0,
    translate,
    locale,
  } = {}
) {
  const translator = getTranslatorCandidate(translate);
  const t = (key, params) => translator(key, params);
  const prevLocale = runtimeLocale;
  runtimeLocale = resolveLocalePreference(locale);
  const showHoursSeries = showHours !== false;
  const chartMode = showHoursSeries ? mode : 'line';
  if (!el) {
    runtimeLocale = prevLocale;
    return;
  }
  try {
    try {
      el.innerHTML = '';
    } catch {}
  el.style.position = 'relative';
  el.style.background = 'var(--chart-bg, #fefefe)';

  const viewersFlag = showViewers ? '1' : '0';
  const viewersStateChanged = el.dataset.lastViewersState !== viewersFlag;
  el.dataset.lastViewersState = viewersFlag;

  const fallbackW = Number(el.dataset.testWidth || 600);
  const fallbackH = Number(el.dataset.testHeight || 260);
  const w = el.clientWidth ? el.clientWidth - 20 : fallbackW - 20;
  const h = el.clientHeight ? el.clientHeight - 16 : fallbackH - 16;
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
    borderRadius: '2px',
    border: '1px solid var(--card-border)',
    background: 'var(--card-bg, #111827)',
    display: 'none',
    zIndex: 10,
  });
  el.appendChild(tip);
  const getTipRect = () => {
    const rect = tip.getBoundingClientRect();
    return {
      width: rect.width || 140,
      height: rect.height || 60,
    };
  };
  const placeTipAtPosition = (coords, preferAbove = false) => {
    try {
      const elRect = el.getBoundingClientRect();
      const margin = 10;
      const tipRect = getTipRect();
      let left = (Number.isFinite(coords?.relX) ? coords.relX : 0) + margin;
      left = Math.max(4, Math.min(left, w - tipRect.width - 4));

      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || h;
      const relBaseline = (Number.isFinite(coords?.relY) ? coords.relY : h / 2) + margin;
      const absoluteBelow = Number.isFinite(coords?.absY)
        ? coords.absY + margin + tipRect.height
        : elRect.top + relBaseline + tipRect.height;
      let top;
      if (preferAbove || absoluteBelow > viewportHeight - 4) {
        const relTarget = Number.isFinite(coords?.relY) ? coords.relY : h / 2;
        top = Math.max(4, relTarget - tipRect.height - 12);
      } else {
        top = Math.min(h - tipRect.height - 4, relBaseline);
      }
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
    } catch {}
  };
  const placeTipFromMouse = (evt, preferAbove = false) => {
    if (!evt) return;
    try {
      const elRect = el.getBoundingClientRect();
      placeTipAtPosition(
        {
          relX: evt.clientX - elRect.left,
          relY: evt.clientY - elRect.top,
          absY: evt.clientY,
        },
        preferAbove
      );
    } catch {}
  };
  const placeTipFromElement = (target, preferAbove = false) => {
    if (!target || !target.getBoundingClientRect) return;
    try {
      const elRect = el.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      placeTipAtPosition(
        {
          relX: rect.left - elRect.left + rect.width / 2,
          relY: rect.top - elRect.top + rect.height / 2,
          absY: rect.top + rect.height / 2,
        },
        preferAbove
      );
    } catch {}
  };
  const showTooltip = (bucket, hoursValue, avgViewersValue, position, preferAbove = false) => {
    tip.innerHTML = buildTooltipHtml(bucket, hoursValue, avgViewersValue);
    tip.style.display = 'block';
    if (position?.event) {
      placeTipFromMouse(position.event, preferAbove);
    } else if (position?.element) {
      placeTipFromElement(position.element, preferAbove);
    } else if (position?.coords) {
      placeTipAtPosition(position.coords, preferAbove);
    }
  };
  const hideTooltip = () => {
    tip.style.display = 'none';
  };

  const displayRaw = buildDisplayData(data).map((d) => ({
    ...d,
    avgViewers: Number(d?.avgViewers || 0),
  }));

  const win = Math.max(1, Number(smoothWindow || 1));
  const display = displayRaw.map((d, i, arr) => {
    if (!showViewers || win <= 1 || arr.length <= 1) return d;
    const effectiveWin = Math.max(1, Math.min(win, arr.length));
    if (effectiveWin <= 1) return d;
    const half = Math.floor(effectiveWin / 2);
    let start = Math.max(0, i - half);
    let end = start + effectiveWin - 1;
    if (end >= arr.length) {
      end = arr.length - 1;
      start = Math.max(0, end - effectiveWin + 1);
    }
    let sum = 0;
    let cnt = 0;
    for (let k = start; k <= end; k++) {
      sum += Number(arr[k].avgViewers || 0);
      cnt++;
    }
    return { ...d, avgViewers: cnt > 0 ? sum / cnt : d.avgViewers };
  });
  const maxHours = Math.max(
    1,
    ...display.filter((d) => d && d.hours != null).map((d) => Number(d.hours || 0))
  );
  const maxViewers = showViewers
    ? Math.max(0, ...display.map((d) => Number(d.avgViewers || 0)))
    : 0;

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
  const animationSignature = buildAnimationSignature(display, {
    chartMode,
    showViewersFlag: showViewers,
    period,
    goalHours: goal,
  });

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
      if (d)
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
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
    const avgVal = Number.isFinite(Number(avgViewersValue))
      ? Number(avgViewersValue)
      : Number(bucket?.avgViewers || 0);
    const peakVal = Number(bucket?.peakViewers || 0);
    const title = formatRangeTitle(bucket);
    const hoursLabel = (() => {
      try {
        return formatHours ? formatHours(hoursSafe) : hoursSafe.toFixed(2);
      } catch {
        return hoursSafe.toFixed(2);
      }
    })();
    let html = `<div class="tip-title">${title}</div>`;
    html += `<div class="tip-subtle">${t('chartTooltipHoursStreamed')} ${hoursLabel}</div>`;
    html += `<div class="tip-viewers">${t('chartTooltipParticipants')} ${formatAverageCount(avgVal)}</div>`;
    if (peakVal > 0) {
      html += `<div class="tip-viewers">${t('chartTooltipPeakParticipants')} ${formatViewerCount(peakVal)}</div>`;
    }
    return html;
  };

  if (chartMode === 'line') {
    const svgNS = 'http://www.w3.org/2000/svg';
    const axisLeft = 44;
    const gridConfig = calcGridLayout(h);
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.style.display = 'block';
    const lineModeLabel = showHoursSeries ? 'line-hours' : 'line-viewers';
    const animateLine = shouldAnimate(el, lineModeLabel, `${animationSignature}|${lineModeLabel}`);
    const gradientPrefix = makeUid('chart-area');
    const defs = document.createElementNS(svgNS, 'defs');
    const createAreaGradient = (id, colorVar, topOpacity = 0.45, bottomOpacity = 0.05) => {
      const gradient = document.createElementNS(svgNS, 'linearGradient');
      gradient.setAttribute('id', id);
      gradient.setAttribute('x1', '0');
      gradient.setAttribute('y1', '0');
      gradient.setAttribute('x2', '0');
      gradient.setAttribute('y2', '1');
      const stopTop = document.createElementNS(svgNS, 'stop');
      stopTop.setAttribute('offset', '5%');
      stopTop.setAttribute('stop-color', colorVar);
      stopTop.setAttribute('stop-opacity', String(topOpacity));
      const stopBottom = document.createElementNS(svgNS, 'stop');
      stopBottom.setAttribute('offset', '95%');
      stopBottom.setAttribute('stop-color', colorVar);
      stopBottom.setAttribute('stop-opacity', String(bottomOpacity));
      gradient.appendChild(stopTop);
      gradient.appendChild(stopBottom);
      return gradient;
    };
    let hoursGradientId = null;
    let viewersGradientId = null;
    if (showHoursSeries) {
      hoursGradientId = `${gradientPrefix}-hours`;
      defs.appendChild(createAreaGradient(hoursGradientId, 'var(--line-color,#2261ee)', 0.35, 0.08));
    }
    if (showViewers && maxViewers > 0) {
      viewersGradientId = `${gradientPrefix}-viewers`;
      defs.appendChild(createAreaGradient(viewersGradientId, 'var(--accent,#553fee)', 0.25, 0.04));
    }
    if (defs.childNodes.length) {
      svg.appendChild(defs);
    }
    const drawGrid = (withLabels = false) => {
      const bg = document.createElementNS(svgNS, 'rect');
      bg.setAttribute('x', '0');
      bg.setAttribute('y', '0');
      bg.setAttribute('width', String(w));
      bg.setAttribute('height', String(h));
      bg.setAttribute('fill', 'var(--chart-bg,#fefefe)');
      svg.appendChild(bg);
      const gridColor =
        getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() ||
        '#f3f7fa';
      const { lines, padY, bottomAxis } = gridConfig;
      const gridValueMax = showHoursSeries ? maxHours : Math.max(1, maxViewers || 1);
      for (let i = 1; i <= lines; i++) {
        const y = Math.round(padY + ((h - bottomAxis - padY * 2) * i) / (lines + 1));
        const ln = document.createElementNS(svgNS, 'line');
        ln.setAttribute('x1', String(Math.max(0, axisLeft)));
        ln.setAttribute('y1', String(y));
        ln.setAttribute('x2', String(w));
        ln.setAttribute('y2', String(y));
        ln.setAttribute('stroke', gridColor);
        ln.setAttribute('stroke-width', '1');
        svg.appendChild(ln);
      }
      if (withLabels && gridValueMax > 0) {
        const labelColor =
          getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() ||
          '#94a3b8';
        const ticks = gridConfig.lines + 2;
        const pad = gridConfig.padY;
        const bottom = gridConfig.bottomAxis;
        for (let i = 0; i <= ticks - 1; i++) {
          const y = Math.round(pad + ((h - bottom - pad * 2) * i) / (ticks - 1));
          const val = gridValueMax * (1 - i / (ticks - 1));
          const txt = document.createElementNS(svgNS, 'text');
          txt.setAttribute('x', '6');
          txt.setAttribute('y', String(Math.max(10, Math.min(h - bottom - 2, y + 3))));
          txt.setAttribute('fill', labelColor);
          txt.setAttribute('font-size', '10');
          txt.setAttribute('text-anchor', 'start');
          try {
            if (showHoursSeries) txt.textContent = formatHours ? formatHours(val) : String(Math.round(val));
            else txt.textContent = formatViewerCount(val);
          } catch {
            txt.textContent = String(Math.round(val));
          }
          svg.appendChild(txt);
        }

        if (showHoursSeries && maxViewers > 0) {
          for (let i = 0; i <= ticks - 1; i++) {
            const y = Math.round(pad + ((h - bottom - pad * 2) * i) / (ticks - 1));
            const v = maxViewers * (1 - i / (ticks - 1));
            const txtR = document.createElementNS(svgNS, 'text');
            txtR.setAttribute('x', String(w - 6));
            txtR.setAttribute('y', String(Math.max(10, Math.min(h - bottom - 2, y + 3))));
            txtR.setAttribute('fill', labelColor);
            txtR.setAttribute('font-size', '10');
            txtR.setAttribute('text-anchor', 'end');
            txtR.textContent = String(Math.round(v));
            svg.appendChild(txtR);
          }
        }
        if (showHoursSeries && goal > 0 && maxHours >= goal) {
          const goalY = Math.round(
            h - bottomAxis - padY - (Math.max(0, goal) / maxHours) * (h - bottomAxis - padY * 2)
          );
          const goalLine = document.createElementNS(svgNS, 'line');
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
    const padX = 6;
    const padY = gridConfig.padY;
    const bottomAxis = gridConfig.bottomAxis;
    const innerW = Math.max(1, w - axisLeft - padX * 2);
    const stepX = Math.max(1, innerW / Math.max(1, display.length - 1));
    const toYHours = (v) =>
      Math.round(h - bottomAxis - padY - (Math.max(0, v) / maxHours) * (h - bottomAxis - padY * 2));
    const toYViewers = (v) => {
      if (maxViewers <= 0) return Math.round(h - bottomAxis - padY);
      return Math.round(
        h - bottomAxis - padY - (Math.max(0, v) / maxViewers) * (h - bottomAxis - padY * 2)
      );
    };
    const points = display.map((bucket, idx) => {
      const hoursValue = Number(bucket?.hours || 0);
      const avgViewersValue = Number(bucket?.avgViewers || 0);
      const x = Math.round(axisLeft + padX + idx * stepX);
      return {
        bucket,
        idx,
        x,
        hoursValue,
        avgViewersValue,
        yHours: toYHours(hoursValue),
        yViewers: toYViewers(avgViewersValue),
      };
    });

    const baseHoursY = toYHours(0);
    if (showHoursSeries && points.length > 0 && hoursGradientId) {
      let areaD = `M ${points[0].x} ${baseHoursY}`;
      points.forEach((pt) => {
        areaD += ` L ${pt.x} ${pt.yHours}`;
      });
      areaD += ` L ${points[points.length - 1].x} ${baseHoursY} Z`;
      const areaPath = document.createElementNS(svgNS, 'path');
      areaPath.setAttribute('d', areaD);
      areaPath.setAttribute('fill', `url(#${hoursGradientId})`);
      areaPath.setAttribute('class', 'line-area hours');
      if (animateLine) {
        areaPath.style.opacity = '0';
        areaPath.style.transition = 'opacity 420ms ease 40ms';
        requestAnimationFrame(() => {
          areaPath.style.opacity = '1';
        });
      } else {
        areaPath.style.opacity = '1';
      }
      svg.appendChild(areaPath);
    }

    if (showViewers && maxViewers > 0 && points.length > 0 && viewersGradientId) {
      const baseViewersY = toYViewers(0);
      let viewersAreaD = `M ${points[0].x} ${baseViewersY}`;
      points.forEach((pt) => {
        viewersAreaD += ` L ${pt.x} ${pt.yViewers}`;
      });
      viewersAreaD += ` L ${points[points.length - 1].x} ${baseViewersY} Z`;
      const viewersArea = document.createElementNS(svgNS, 'path');
      viewersArea.setAttribute('d', viewersAreaD);
      viewersArea.setAttribute('fill', `url(#${viewersGradientId})`);
      viewersArea.setAttribute('class', 'line-area viewers');
      viewersArea.style.mixBlendMode = 'multiply';
      if (animateLine || viewersStateChanged) {
        viewersArea.style.opacity = '0';
        viewersArea.style.transition = 'opacity 420ms ease 80ms';
        requestAnimationFrame(() => {
          viewersArea.style.opacity = '0.95';
        });
      } else {
        viewersArea.style.opacity = '0.95';
      }
      svg.appendChild(viewersArea);
    }

    let path = null;
    if (showHoursSeries && points.length > 0) {
      let dPath = '';
      points.forEach((pt, idx) => {
        dPath += idx === 0 ? `M ${pt.x} ${pt.yHours}` : ` L ${pt.x} ${pt.yHours}`;
      });
      path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', dPath);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'var(--line-color,#2261ee)');
      path.setAttribute('stroke-width', '2.5');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('class', 'line-path');
      if (animateLine) {
        primePathAnimation(path, 40);
      } else {
        path.style.opacity = '1';
        path.style.transition = 'none';
      }
      svg.appendChild(path);
    }

    let pathV = null;
    const animateViewerLine = showViewers && maxViewers > 0 && (animateLine || viewersStateChanged);
    if (showViewers && maxViewers > 0 && points.length > 0) {
      let dPathV = '';
      points.forEach((pt, idx) => {
        dPathV += idx === 0 ? `M ${pt.x} ${pt.yViewers}` : ` L ${pt.x} ${pt.yViewers}`;
      });
      pathV = document.createElementNS(svgNS, 'path');
      pathV.setAttribute('d', dPathV);
      pathV.setAttribute('fill', 'none');
      pathV.setAttribute('stroke', 'var(--accent,#553fee)');
      pathV.setAttribute('stroke-width', '2.5');
      pathV.setAttribute('stroke-linecap', 'round');
      pathV.setAttribute('stroke-linejoin', 'round');
      pathV.setAttribute('class', 'line-path viewers');
      if (animateViewerLine) {
        primePathAnimation(pathV, 100);
      } else {
        pathV.style.opacity = '1';
        pathV.style.transition = 'none';
      }
      svg.appendChild(pathV);
    }

    points.forEach((pt) => {
      const { bucket: p, hoursValue, avgViewersValue, x, yHours, yViewers, idx } = pt;
      if (showHoursSeries) {
        const c = document.createElementNS(svgNS, 'circle');
        c.setAttribute('cx', String(x));
        c.setAttribute('cy', String(yHours));
        c.setAttribute('r', '2.6');
        const meetsGoal = goal > 0 && hoursValue >= goal;
        const hourFill =
          hoursValue > 0
            ? goal > 0
              ? meetsGoal
                ? 'var(--chart-goal-met,#ee2264)'
                : 'var(--line-color,#2261ee)'
              : 'var(--line-color,#2261ee)'
            : 'rgba(148,163,184,.65)';
        c.setAttribute('fill', hourFill);
        c.classList.add('line-point');
        if (animateLine) {
          c.style.opacity = '0';
          c.style.transition = `opacity 360ms ease ${140 + idx * 12}ms`;
        } else {
          c.style.opacity = '1';
        }
        const handleMouse = (e) => {
          showTooltip(p, hoursValue, avgViewersValue, { event: e }, hoursValue === 0);
        };
        c.addEventListener('mouseenter', handleMouse);
        c.addEventListener('mousemove', handleMouse);
        c.addEventListener('mouseleave', hideTooltip);
        c.addEventListener('focus', () => {
          showTooltip(p, hoursValue, avgViewersValue, { element: c }, hoursValue === 0);
        });
        c.addEventListener('blur', hideTooltip);
        c.setAttribute('tabindex', '0');
        c.setAttribute('role', 'img');
        c.setAttribute('aria-label', formatRangeTitle(p));
        svg.appendChild(c);
        if (animateLine) {
          requestAnimationFrame(() => {
            try {
              c.style.opacity = '1';
            } catch {}
          });
        }
      }
      updatePeak({ hours: hoursValue, avgViewers: avgViewersValue, x, y: yHours });

      if (showViewers && maxViewers > 0) {
        const cv = document.createElementNS(svgNS, 'circle');
        cv.setAttribute('cx', String(x));
        cv.setAttribute('cy', String(yViewers));
        cv.setAttribute('r', '2.6');
        cv.setAttribute('fill', 'var(--accent,#553fee)');
        cv.classList.add('line-point-viewers');
        if (animateViewerLine) {
          cv.style.opacity = '0';
          cv.style.transition = `opacity 360ms ease ${170 + idx * 12}ms`;
        } else {
          cv.style.opacity = '1';
        }
        const show = (e) => {
          showTooltip(p, hoursValue, avgViewersValue, { event: e }, hoursValue === 0);
        };
        cv.addEventListener('mouseenter', show);
        cv.addEventListener('mousemove', show);
        cv.addEventListener('mouseleave', hideTooltip);
        cv.addEventListener('focus', () => {
          showTooltip(p, hoursValue, avgViewersValue, { element: cv }, hoursValue === 0);
        });
        cv.addEventListener('blur', hideTooltip);
        cv.setAttribute('tabindex', '0');
        cv.setAttribute('role', 'img');
        cv.setAttribute('aria-label', formatRangeTitle(p));
        svg.appendChild(cv);
        if (animateViewerLine) {
          requestAnimationFrame(() => {
            try {
              cv.style.opacity = '1';
            } catch {}
          });
        }
      }
    });
    const maxLabels = 8;
    const stride = Math.max(1, Math.ceil(display.length / maxLabels));
    const labelColor =
      getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() ||
      '#94a3b8';
    for (let i = 0; i < display.length; i += stride) {
      const x = Math.round(axisLeft + padX + i * stepX);
      const txt = document.createElementNS(svgNS, 'text');
      txt.setAttribute('x', String(x));
      txt.setAttribute('y', String(h - Math.max(6, Math.round(bottomAxis / 3))));
      txt.setAttribute('fill', labelColor);
      txt.setAttribute('font-size', '10');
      txt.setAttribute('text-anchor', 'middle');
      txt.textContent = fmtX(display[i]);
      svg.appendChild(txt);
    }
    el.appendChild(svg);
    return { peak: peakCandidate };
  }

  const axisLeft = 44;
  const gap = 4;
  const series = barDisplay;
  const seriesLength = Math.max(1, series.length);
  const barW = Math.max(
    8,
    Math.floor((w - axisLeft - gap * Math.max(0, seriesLength - 1)) / seriesLength)
  );
  const barModeLabel = chartMode === 'candle' ? 'candle' : 'bar';
  const animateBars = shouldAnimate(el, barModeLabel, `${animationSignature}|${barModeLabel}`);
  const gridConfig = calcGridLayout(h);
  const gridSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  gridSvg.setAttribute('width', String(w));
  gridSvg.setAttribute('height', String(h));
  gridSvg.style.position = 'absolute';
  gridSvg.style.left = '0';
  gridSvg.style.top = '0';
  gridSvg.style.pointerEvents = 'none';
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', String(w));
  bg.setAttribute('height', String(h));
  bg.setAttribute('fill', 'var(--chart-bg,#fefefe)');
  gridSvg.appendChild(bg);

  try {
    const gridColor =
      getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() ||
      '#f3f7fa';
    const labelColor =
      getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() ||
      '#94a3b8';
    const { lines, padY, bottomAxis } = gridConfig;
    for (let i = 1; i <= lines; i++) {
      const y = Math.round(padY + ((h - bottomAxis - padY * 2) * i) / (lines + 1));
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
      const ticks = gridConfig.lines + 2;
      const pad = gridConfig.padY;
      const bottom = gridConfig.bottomAxis;
      for (let i = 0; i <= ticks - 1; i++) {
        const y = Math.round(pad + ((h - bottom - pad * 2) * i) / (ticks - 1));
        const val = maxHours * (1 - i / (ticks - 1));
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', '6');
        txt.setAttribute('y', String(Math.max(10, Math.min(h - bottom - 2, y + 3))));
        txt.setAttribute('fill', labelColor);
        txt.setAttribute('font-size', '10');
        txt.setAttribute('text-anchor', 'start');
        try {
          txt.textContent = formatHours ? formatHours(val) : String(Math.round(val));
        } catch {
          txt.textContent = String(Math.round(val));
        }
        gridSvg.appendChild(txt);
      }
      if (goal > 0 && maxHours >= goal) {
        const goalY = Math.round(gridConfig.padY + (h - gridConfig.bottomAxis - gridConfig.padY * 2) * (1 - goal / maxHours));
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

    const bottomLabelY = h - Math.max(6, Math.round(gridConfig.bottomAxis / 3));
    const maxLabels = 8;
    const stride = Math.max(1, Math.ceil(series.length / maxLabels));
    for (let i = 0; i < series.length; i += stride) {
      const centerX = Math.round(axisLeft + (barW + gap) * i + barW / 2);
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', String(centerX));
      txt.setAttribute('y', String(bottomLabelY));
      txt.setAttribute('fill', labelColor);
      txt.setAttribute('font-size', '10');
      txt.setAttribute('text-anchor', 'middle');
      txt.textContent = fmtX(series[i]);
      gridSvg.appendChild(txt);
    }
  } catch {}
  el.appendChild(gridSvg);
  const container = document.createElement('div');
  Object.assign(container.style, {
    display: 'flex',
    alignItems: 'flex-end',
    gap: gap + 'px',
    position: 'relative',
    zIndex: '1',
    marginLeft: axisLeft + 'px',
  });
  const bottomAxis = gridConfig.bottomAxis;
  const padY = gridConfig.padY;
  const innerHeight = Math.max(1, h - bottomAxis - padY * 2);
  container.style.height = innerHeight + 'px';
  container.style.marginTop = padY + 'px';
  const maxVal = maxHours;
  const available = innerHeight;
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
        fragments.push(
          `${t('chartTooltipParticipants')} ${formatAverageCount(Number(d.avgViewers || 0))}`
        );
        const peakVal = Number(d.peakViewers || 0);
        if (peakVal > 0)
          fragments.push(`${t('chartTooltipPeakParticipants')} ${formatViewerCount(peakVal)}`);
        return fragments.join('. ');
      } catch {
        return '';
      }
    })();
    if (ariaTitle) {
      bar.setAttribute('role', 'img');
      bar.setAttribute('aria-label', ariaTitle);
    }
    const meetsGoal = goal > 0 && v >= goal;
    const positiveColor = meetsGoal
      ? 'var(--chart-goal-met,#ee2264)'
      : 'var(--bar-positive,#2261ee)';
    const neutralColor =
      goal > 0 ? 'var(--chart-goal-base,rgba(148,163,184,0.45))' : 'rgba(128,128,128,.35)';
    bar.style.background = v > 0 ? positiveColor : neutralColor;
    bar.style.borderRadius = '2px';
    bar.className = 'bar';
    if (!animateBars) {
      bar.style.opacity = '1';
      bar.style.transform = 'none';
      bar.style.transition = 'none';
    }
    if (chartMode === 'candle') {
      bar.style.background = 'transparent';
      const wrap = document.createElement('div');
      wrap.style.position = 'relative';
      wrap.style.width = '100%';
      wrap.style.height = Math.max(2, bh) + 'px';
      const fill = document.createElement('div');
      fill.style.height = '100%';
      fill.style.background = v > 0 ? positiveColor : 'rgba(128,128,128,.55)';
      fill.style.width = '100%';
      fill.style.borderRadius = '2px';
      wrap.appendChild(fill);

      if (showViewers && maxViewers > 0) {
        const vh = Math.round((Math.max(0, Number(d.avgViewers || 0)) / maxViewers) * available);
        const viewersLine = document.createElement('div');
        viewersLine.style.position = 'absolute';
        viewersLine.style.left = '0';
        viewersLine.style.right = '0';
        viewersLine.style.bottom = '0';
        viewersLine.style.height = Math.max(2, Math.min(vh, available)) + 'px';
        viewersLine.style.background = 'var(--accent,#553fee)';
        viewersLine.style.opacity = '0.75';
        viewersLine.style.borderRadius = '2px';
        wrap.appendChild(viewersLine);
      }
      bar.appendChild(wrap);
    }
    const show = (e) => {
      showTooltip(d, v, Number(d.avgViewers || 0), { event: e }, v === 0);
    };
    const showFromFocus = () => {
      showTooltip(d, v, Number(d.avgViewers || 0), { element: bar }, v === 0);
    };
    bar.addEventListener('mouseenter', show);
    bar.addEventListener('mousemove', show);
    bar.addEventListener('mouseleave', hideTooltip);
    bar.addEventListener('focus', showFromFocus);
    bar.addEventListener('blur', hideTooltip);
    bar.tabIndex = 0;
    const delay = Math.min(idx * 18, 180);
    if (animateBars) {
      primeGrowAnimation(chartMode === 'candle' ? bar.firstChild : bar, delay + 80);
      primeGrowAnimation(bar, delay);
    }
    container.appendChild(bar);
    const barTop = padY + Math.max(0, available - Math.max(2, bh));
    const centerX = Math.round(axisLeft + (barW + gap) * idx + barW / 2);
    updatePeak({
      hours: Number(v || 0),
      avgViewers: Number(d.avgViewers || 0),
      x: centerX,
      y: barTop,
    });
  });
  el.appendChild(container);

  if (chartMode !== 'candle' && showViewers && maxViewers > 0 && series.length > 0) {
    const overlaySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlaySvg.setAttribute('width', String(w));
    overlaySvg.setAttribute('height', String(h));
    overlaySvg.style.position = 'absolute';
    overlaySvg.style.left = '0';
    overlaySvg.style.top = '0';
    overlaySvg.style.pointerEvents = 'none';
    const toX = (idx) => Math.round(axisLeft + (barW + gap) * idx + barW / 2);
    const toY = (value) => {
      if (maxViewers <= 0) return padY + available;
      const ratio = Math.max(0, Math.min(1, Number(value || 0) / maxViewers));
      return padY + available - ratio * available;
    };
    let pathData = '';
    series.forEach((d, idx) => {
      const x = toX(idx);
      const y = toY(d.avgViewers);
      pathData += idx === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });
    if (pathData) {
      const viewerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      viewerPath.setAttribute('d', pathData);
      viewerPath.setAttribute('fill', 'none');
      viewerPath.setAttribute('stroke', 'var(--accent,#553fee)');
      viewerPath.setAttribute('stroke-width', '3');
      viewerPath.setAttribute('stroke-linecap', 'round');
      viewerPath.setAttribute('stroke-linejoin', 'round');
      viewerPath.classList.add('viewers-overlay-path');
      overlaySvg.appendChild(viewerPath);
      if (animateBars) {
        primePathAnimation(viewerPath, 120);
      } else {
        viewerPath.style.opacity = '1';
      }
      const lastPoint = series[series.length - 1];
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      marker.setAttribute('cx', String(toX(series.length - 1)));
      marker.setAttribute('cy', String(toY(lastPoint.avgViewers)));
      marker.setAttribute('r', '3');
      marker.setAttribute('fill', 'var(--accent,#553fee)');
      overlaySvg.appendChild(marker);
    }
    el.appendChild(overlaySvg);
  }
  return { peak: peakCandidate };
  } finally {
    runtimeLocale = prevLocale;
  }
}

function renderViewersSparkline(
  el,
  data,
  { period: _period = 'day', smoothWindow = 1, translate, locale } = {}
) {
  const translator = getTranslatorCandidate(translate);
  const t = (key, params) => translator(key, params);
  const prevLocale = runtimeLocale;
  runtimeLocale = resolveLocalePreference(locale);
  try {
    if (!el) return;
    try {
      el.innerHTML = '';
    } catch {}
    el.style.position = 'relative';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.gap = '8px';
    const fallbackW = Number(el.dataset.testWidth || 260);
    const fallbackH = Number(el.dataset.testHeight || 70);
    const w = el.clientWidth ? el.clientWidth : fallbackW;
    const h = el.clientHeight ? el.clientHeight : fallbackH;

  const displayRaw = buildDisplayData(data).map((d) => ({
    ...d,
    avgViewers: Number(d?.avgViewers || 0),
  }));
  const win = Math.max(1, Number(smoothWindow || 1));
  const viewers = displayRaw.map((d, i, arr) => {
    if (win <= 1 || arr.length <= 1) return d.avgViewers;
    const effectiveWin = Math.max(1, Math.min(win, arr.length));
    if (effectiveWin <= 1) return d.avgViewers;
    const half = Math.floor(effectiveWin / 2);
    let start = Math.max(0, i - half);
    let end = start + effectiveWin - 1;
    if (end >= arr.length) {
      end = arr.length - 1;
      start = Math.max(0, end - effectiveWin + 1);
    }
    let sum = 0;
    let cnt = 0;
    for (let k = start; k <= end; k++) {
      sum += Number(arr[k].avgViewers || 0);
      cnt++;
    }
    return cnt > 0 ? sum / cnt : d.avgViewers;
  });
  const maxViewers = Math.max(0, ...viewers);
  if (!viewers.length || maxViewers <= 0) {
    const empty = document.createElement('div');
    empty.className = 'sparkline-empty';
    try {
      empty.textContent = t('streamHistoryViewersTrendEmpty');
    } catch {
      empty.textContent = 'No viewer data';
    }
    el.appendChild(empty);
    return;
  }

  const positiveViewers = viewers.filter((v) => v > 0);
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

  const dPath = viewers
    .map((val, idx) => {
      const x = padX + idx * stepX;
      const y = toY(val);
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
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
    const peakLabelOffset = 20;
    peakLabel.setAttribute('x', String(peakX + 6));
    peakLabel.setAttribute('y', String(Math.max(20, peakY - peakLabelOffset)));
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
  } finally {
    runtimeLocale = prevLocale;
  }
}

export { renderStreamHistoryChart, renderViewersSparkline };
if (typeof module !== 'undefined' && module?.exports) {
  module.exports = { renderStreamHistoryChart, renderViewersSparkline };
}
