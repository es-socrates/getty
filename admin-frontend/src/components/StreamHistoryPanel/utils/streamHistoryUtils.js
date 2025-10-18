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

function getBucketTimestamp(bucket) {
  if (!bucket) return null;
  const { epoch, date } = bucket;
  const epochNumber = Number(epoch);
  if (Number.isFinite(epochNumber)) return epochNumber;
  if (typeof date === 'string' && date) {
    const parsed = Date.parse(date);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function buildDisplayData(source) {
  const arr = Array.isArray(source) ? source.filter((item) => item != null) : [];
  if (arr.length === 0) return [];

  const withMeta = arr.map((item, idx) => ({ item, idx, ts: getBucketTimestamp(item) }));

  withMeta.sort((a, b) => {
    const { ts: ta } = a;
    const { ts: tb } = b;
    if (ta == null && tb == null) return a.idx - b.idx;
    if (ta == null) return a.idx - b.idx;
    if (tb == null) return a.idx - b.idx;
    if (ta === tb) return a.idx - b.idx;
    return ta - tb;
  });

  const now = Date.now();
  const FUTURE_TOLERANCE_MS = 6 * 3600 * 1000;
  const filtered = withMeta
    .filter(({ ts }) => ts == null || ts <= now + FUTURE_TOLERANCE_MS)
    .map(({ item }) => item);

  if (filtered.length > 0) return filtered;
  return withMeta.map(({ item }) => item);
}

export { formatHours, formatTotalHours, usdFromAr, buildDisplayData };

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined' && module?.exports) {
  // eslint-disable-next-line no-undef
  module.exports = { formatHours, formatTotalHours, usdFromAr, buildDisplayData };
}
