import { buildDisplayData, formatHours } from './streamHistoryUtils.js';

function renderStreamHistoryChart(el, data, { mode = 'line', period = 'day', showViewers = true, smoothWindow = 1 } = {}) {
  if (!el) return;
  try { el.innerHTML = ''; } catch {}
  el.style.position = 'relative';
  el.style.background = 'var(--chart-bg, #fefefe)';

  const fallbackW = Number(el.dataset.testWidth || 600);
  const fallbackH = Number(el.dataset.testHeight || 260);
  const w = el.clientWidth ? (el.clientWidth - 20) : (fallbackW - 20);
  const h = el.clientHeight ? (el.clientHeight - 16) : (fallbackH - 16);

  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  Object.assign(tip.style, {
    position: 'absolute',
    pointerEvents: 'none',
    padding: '4px 6px',
    fontSize: '12px',
    borderRadius: '6px',
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
      const d = dateFromBucket(bucket);
      if (d) {
        if (['day', 'week'].includes(period)) return String(d.getDate()).padStart(2, '0');
        return d.toLocaleDateString(undefined, { month: 'short' });
      }
    } catch {}
    const s = bucket && bucket.date ? bucket.date : '';
    return s.slice(0, 6);
  };

  if (mode === 'line') {
    const axisLeft = 44;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.style.display = 'block';
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
      const x = Math.round(axisLeft + padX + idx * stepX);
      const y = toYHours(p.hours || 0);
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

    let pathV = null;
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
      pathV.setAttribute('stroke', 'var(--viewers-line-color, #e11d48)');
      pathV.setAttribute('stroke-width', '2');
      pathV.setAttribute('stroke-linecap', 'round');
      pathV.setAttribute('class', 'line-path viewers');
      svg.appendChild(pathV);
    }

    try {
      if (pathV) {
        const totalLenV = pathV.getTotalLength();
        pathV.style.strokeDasharray = String(totalLenV);
        pathV.style.strokeDashoffset = String(totalLenV);
        pathV.style.transition = 'stroke-dashoffset 600ms ease, opacity 600ms ease';
        pathV.getBoundingClientRect();
        setTimeout(() => { pathV.style.strokeDashoffset = '0'; pathV.style.opacity = '1'; }, 30);
      }
      const totalLenV = pathV.getTotalLength();
      pathV.style.strokeDasharray = String(totalLenV);
      pathV.style.strokeDashoffset = String(totalLenV);
      pathV.style.transition = 'stroke-dashoffset 600ms ease, opacity 600ms ease';
      pathV.getBoundingClientRect();
      setTimeout(() => { pathV.style.strokeDashoffset = '0'; pathV.style.opacity = '1'; }, 30);
    } catch {}

    display.forEach((p, idx) => {
      const x = Math.round(axisLeft + padX + idx * stepX);
      const y = toYHours(p.hours || 0);
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', String(x)); c.setAttribute('cy', String(y)); c.setAttribute('r', '3');
      c.setAttribute('fill', (p.hours || 0) > 0 ? 'var(--line-color,#10b981)' : 'rgba(128,128,128,.65)');
      c.classList.add('line-point');
      c.style.opacity = '0';
      c.style.transition = 'opacity 450ms ease 120ms';
      c.addEventListener('mouseenter', (e) => {
      const title = fmtDate(p);
        tip.innerHTML = `<div class="tip-title">${title}</div><div class="tip-subtle">${(p.hours||0)} h</div><div class="tip-viewers">${Number(p.avgViewers||0).toFixed(1)} avg</div>`;
        tip.style.display = 'block';
        placeTipFromMouse(e, (p.hours || 0) === 0);
      });
      c.addEventListener('mousemove', (e) => placeTipFromMouse(e, (p.hours || 0) === 0));
      c.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
      svg.appendChild(c);
      requestAnimationFrame(() => { try { c.style.opacity = '1'; } catch {} });

  if (showViewers && maxViewers > 0) {
        const yv = toYViewers(Number(p.avgViewers || 0));
        const cv = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        cv.setAttribute('cx', String(x)); cv.setAttribute('cy', String(yv)); cv.setAttribute('r', '2.5');
        cv.setAttribute('fill', 'var(--viewers-line-color,#e11d48)');
        cv.classList.add('line-point-viewers');
        cv.style.opacity = '0';
        cv.style.transition = 'opacity 450ms ease 180ms';
        const show = (e) => {
          const title = fmtDate(p);
          tip.innerHTML = `<div class="tip-title">${title}</div><div class="tip-subtle">${(p.hours||0)} h</div><div class="tip-viewers">${Number(p.avgViewers||0).toFixed(1)} avg</div>`;
          tip.style.display = 'block'; placeTipFromMouse(e, (p.hours || 0) === 0);
        };
        cv.addEventListener('mouseenter', show);
        cv.addEventListener('mousemove', show);
        cv.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
        svg.appendChild(cv);
        requestAnimationFrame(() => { try { cv.style.opacity = '1'; } catch {} });
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
    return;
  }

  const axisLeft = 44; const gap = 4; const barW = Math.max(8, Math.floor((w - axisLeft) / Math.max(1, display.length)) - (gap + 2));
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
    }

    const bottomLabelY = h - Math.max(6, Math.round(24 / 3));
    const maxLabels = 8; const stride = Math.max(1, Math.ceil(display.length / maxLabels));
    for (let i = 0; i < display.length; i += stride) {
      const centerX = Math.round(axisLeft + (barW + gap) * i + barW / 2);
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', String(centerX)); txt.setAttribute('y', String(bottomLabelY));
      txt.setAttribute('fill', labelColor); txt.setAttribute('font-size', '10'); txt.setAttribute('text-anchor', 'middle');
      txt.textContent = fmtX(display[i]);
      gridSvg.appendChild(txt);
    }
  } catch {}
  el.appendChild(gridSvg);
  const container = document.createElement('div');
  Object.assign(container.style, { display: 'flex', alignItems: 'flex-end', gap: gap + 'px', position: 'relative', zIndex: '1', marginLeft: axisLeft + 'px' });
  const bottomAxis = 24; const padY = 10; const innerHeight = Math.max(1, h - bottomAxis - padY * 2); container.style.height = innerHeight + 'px'; container.style.marginTop = padY + 'px';
  const maxVal = maxHours; const available = innerHeight;
  display.forEach(d => {
    const v = d.hours || 0; const bh = Math.round((v / maxVal) * available);
    const bar = document.createElement('div');
    bar.style.width = barW + 'px'; bar.style.height = Math.max(2, bh) + 'px';
    bar.title = `${d.date ? d.date + ': ' : ''}${v} h`;
    bar.style.background = v > 0 ? 'var(--bar-positive,#10b981)' : 'rgba(128,128,128,.35)';
    bar.style.borderRadius = '6px';
    bar.className = 'bar';
    if (mode === 'candle') {
      bar.style.border = '1px solid var(--card-border)'; bar.style.background = 'transparent';
      const wrap = document.createElement('div'); wrap.style.position = 'relative'; wrap.style.width = '100%'; wrap.style.height = Math.max(2, bh) + 'px';
      const fill = document.createElement('div'); fill.style.height = '100%'; fill.style.background = v > 0 ? 'var(--bar-positive,#10b981)' : 'rgba(128,128,128,.55)'; fill.style.width = '100%'; fill.style.borderRadius = '6px'; wrap.appendChild(fill);

      if (showViewers && maxViewers > 0) {
        const vh = Math.round((Math.max(0, Number(d.avgViewers || 0)) / maxViewers) * available);
        const viewersLine = document.createElement('div');
        viewersLine.style.position = 'absolute'; viewersLine.style.left = '0'; viewersLine.style.right = '0';
        viewersLine.style.bottom = '0'; viewersLine.style.height = Math.max(2, Math.min(vh, available)) + 'px';
        viewersLine.style.background = 'var(--viewers-line-color,#e11d48)'; viewersLine.style.opacity = '0.75';
        viewersLine.style.borderRadius = '6px';
        wrap.appendChild(viewersLine);
      }
      bar.appendChild(wrap);
    }
  const show = (e) => { try { const title = fmtDate(d); const vv = Number(d.avgViewers||0).toFixed(1); tip.innerHTML = `<div class="tip-title">${title}</div><div class="tip-subtle">${v} h</div>${showViewers ? `<div class="tip-viewers">${vv} avg</div>`:''}`; tip.style.display = 'block'; placeTipFromMouse(e, v === 0); } catch {} };
    const hide = () => { tip.style.display = 'none'; };
    bar.addEventListener('mouseenter', show);
    bar.addEventListener('mousemove', show);
    bar.addEventListener('mouseleave', hide);
    container.appendChild(bar);
  });
  el.appendChild(container);
}

export { renderStreamHistoryChart };
// eslint-disable-next-line no-undef
if (typeof module !== 'undefined' && module?.exports) { module.exports = { renderStreamHistoryChart }; }
