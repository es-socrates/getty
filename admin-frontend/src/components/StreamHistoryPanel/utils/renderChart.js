import { buildDisplayData, formatHours } from './streamHistoryUtils.js';

function renderStreamHistoryChart(el, data, { mode = 'line', period = 'day' } = {}) {
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

  const display = buildDisplayData(data);
  const max = Math.max(1, ...display.filter(d => d && d.hours).map(d => d.hours || 0));

  const fmtDate = (s) => {
    try {
      const d = new Date(s);
      if (!isNaN(d)) return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    } catch {}
    return s || '';
  };
  const fmtX = (s) => {
    try {
      const d = new Date(s);
      if (!isNaN(d)) {
        if (['day', 'week'].includes(period)) return String(d.getDate()).padStart(2, '0');
        return d.toLocaleDateString(undefined, { month: 'short' });
      }
    } catch {}
    return (s || '').slice(0, 6);
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
      if (withLabels && max > 0) {
        const labelColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#94a3b8';
        const ticks = lines + 2; const pad = 10; const bottom = 24;
        for (let i = 0; i <= ticks - 1; i++) {
          const y = Math.round(pad + ((h - bottom - pad * 2) * i / (ticks - 1)));
          const val = max * (1 - (i / (ticks - 1)));
          const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          txt.setAttribute('x', '6');
          txt.setAttribute('y', String(Math.max(10, Math.min(h - bottom - 2, y + 3))));
          txt.setAttribute('fill', labelColor);
          txt.setAttribute('font-size', '10');
          txt.setAttribute('text-anchor', 'start');
          try { txt.textContent = formatHours(val); } catch { txt.textContent = String(Math.round(val)); }
          svg.appendChild(txt);
        }
      }
    };
    drawGrid(true);
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
      c.setAttribute('cx', String(x)); c.setAttribute('cy', String(y)); c.setAttribute('r', '3');
      c.setAttribute('fill', (p.hours || 0) > 0 ? 'var(--line-color,#10b981)' : 'rgba(128,128,128,.65)');
      c.classList.add('line-point');
      c.addEventListener('mouseenter', (e) => {
        const title = fmtDate(p.date);
        tip.innerHTML = `<div style="font-weight:600;margin-bottom:2px;">${title}</div><div style="opacity:.9;">${(p.hours||0)} h</div>`;
        tip.style.display = 'block';
        placeTipFromMouse(e, (p.hours || 0) === 0);
      });
      c.addEventListener('mousemove', (e) => placeTipFromMouse(e, (p.hours || 0) === 0));
      c.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
      svg.appendChild(c);
    });
    const maxLabels = 8; const stride = Math.max(1, Math.ceil(display.length / maxLabels));
    const labelColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#94a3b8';
    for (let i = 0; i < display.length; i += stride) {
      const x = Math.round(axisLeft + padX + i * stepX);
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', String(x)); txt.setAttribute('y', String(h - Math.max(6, Math.round(24 / 3))));
      txt.setAttribute('fill', labelColor); txt.setAttribute('font-size', '10'); txt.setAttribute('text-anchor', 'middle');
      txt.textContent = fmtX(display[i]?.date);
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
    if (max > 0) {
      const ticks = lines + 2; const pad = 10; const bottom = 24;
      for (let i = 0; i <= ticks - 1; i++) {
        const y = Math.round(pad + ((h - bottom - pad * 2) * i / (ticks - 1)));
        const val = max * (1 - (i / (ticks - 1)));
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', '6');
        txt.setAttribute('y', String(Math.max(10, Math.min(h - bottom - 2, y + 3))));
        txt.setAttribute('fill', labelColor);
        txt.setAttribute('font-size', '10');
        txt.setAttribute('text-anchor', 'start');
        try { txt.textContent = formatHours(val); } catch { txt.textContent = String(Math.round(val)); }
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
      txt.textContent = fmtX(display[i]?.date);
      gridSvg.appendChild(txt);
    }
  } catch {}
  el.appendChild(gridSvg);
  const container = document.createElement('div');
  Object.assign(container.style, { display: 'flex', alignItems: 'flex-end', gap: gap + 'px', position: 'relative', zIndex: '1', marginLeft: axisLeft + 'px' });
  const bottomAxis = 24; const padY = 10; const innerHeight = Math.max(1, h - bottomAxis - padY * 2); container.style.height = innerHeight + 'px'; container.style.marginTop = padY + 'px';
  const maxVal = max; const available = innerHeight;
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
      const fill = document.createElement('div'); fill.style.height = Math.max(2, bh) + 'px'; fill.style.background = v > 0 ? 'var(--bar-positive,#10b981)' : 'rgba(128,128,128,.55)'; fill.style.width = '100%'; fill.style.borderRadius = '6px'; bar.appendChild(fill);
    }
  const show = (e) => { try { const title = fmtDate(d.date); tip.innerHTML = `<div style="font-weight:600;margin-bottom:2px;">${title}</div><div style="opacity:.9;">${v} h</div>`; tip.style.display = 'block'; placeTipFromMouse(e, v === 0); } catch {} };
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
if (typeof module !== 'undefined' && module?.exports) {
  // eslint-disable-next-line no-undef
  module.exports = { renderStreamHistoryChart };
}
