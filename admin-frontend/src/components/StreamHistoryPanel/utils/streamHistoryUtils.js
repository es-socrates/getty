function formatHours(h) {
  const v = Number(h || 0);
  const minutes = v * 60;
  
  if (minutes < 60) {
    return Math.round(minutes) + ' min';
  }
  
  if (v >= 24) {
    const snapped = Math.round(v / 24) * 24;
    if (snapped >= 48) return snapped + ' h (' + (snapped / 24) + ' d)';
    return snapped + ' h';
  }
  if (v >= 10) return Math.round(v) + ' h';
  if (v >= 1) return v.toFixed(1) + ' h';

  return v.toFixed(2) + ' h';
}

function formatTotalHours(h) {
  const v = Number(h || 0);
  if (v >= 24) return (v / 24).toFixed(v / 24 >= 10 ? 0 : 1) + ' d';
  if (v >= 10) return Math.round(v) + ' h';
  if (v >= 1) return (Number.isInteger(v) ? v : v.toFixed(1)) + ' h';
  return v.toFixed(2) + ' h';
}

function usdFromAr(arAmount, usdRate) {
  const a = Number(arAmount || 0);
  const r = Number(usdRate || 0);
  if (!isFinite(a) || !isFinite(r) || r <= 0) return 0;
  return a * r;
}

function buildDisplayData(source) {
  const arr = Array.isArray(source) ? [...source] : [];
  let i = 0;
  while (i < arr.length && (!arr[i] || !arr[i].hours || arr[i].hours === 0)) i++;
  if (i === 0) return arr;
  if (i >= arr.length) return arr;
  const trimmed = arr.slice(i);
  const removed = i;
  const display = [...trimmed];
  for (let k = 0; k < removed; k++) display.push({ hours: 0, date: '' });
  return display;
}

export { formatHours, formatTotalHours, usdFromAr, buildDisplayData };

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined' && module?.exports) {
  // eslint-disable-next-line no-undef
  module.exports = { formatHours, formatTotalHours, usdFromAr, buildDisplayData };
}
