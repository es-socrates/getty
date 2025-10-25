const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const zlib = require('zlib');

const STREAM_DB_ENABLED = process.env.GETTY_STREAM_HISTORY_DB === '1';
let streamHistoryDb = null;
let STREAM_DB_READY = false;

if (STREAM_DB_ENABLED) {
  try {
    streamHistoryDb = require('../lib/db/stream-history');
    STREAM_DB_READY = true;
  } catch (err) {
    console.error('[stream-history][db] failed to load Timescale helpers', err);
  }
}

const ensuredTenantCache = new Map();

function tenantIdForNamespace(adminNs) {
  return adminNs || 'global';
}

async function maybeEnsureTenant(adminNs, claimId = null, pubNamespace = null) {
  if (!STREAM_DB_READY) return null;
  const tenantId = tenantIdForNamespace(adminNs);
  const normalizedClaim = claimId && typeof claimId === 'string' ? claimId.trim() : null;
  const normalizedPub = pubNamespace && typeof pubNamespace === 'string' ? pubNamespace.trim() : null;
  const cache = ensuredTenantCache.get(tenantId);
  if (cache && cache.claimId === normalizedClaim && cache.pubNamespace === normalizedPub) {
    return cache.row || null;
  }
  try {
    const row = await streamHistoryDb.ensureTenant({
      tenantId,
      claimId: normalizedClaim,
      adminNamespace: adminNs || null,
      pubNamespace: normalizedPub || null
    });
    ensuredTenantCache.set(tenantId, {
      claimId: row?.claim_id || null,
      pubNamespace: row?.pub_namespace || null,
      row: row || null
    });
    return row || null;
  } catch (err) {
    console.error('[stream-history][db] ensureTenant failed', err);
    ensuredTenantCache.delete(tenantId);
    return null;
  }
}

async function syncHistoryDb(adminNs, hist, opts = {}) {
  if (!STREAM_DB_READY || !hist || typeof hist !== 'object') return true;
  await maybeEnsureTenant(adminNs, opts.claimId || null, opts.pubNamespace || null);

  const replaceAll = hist.__replaceAll === true;
  const segmentsDirty = hist.__segmentsDirty === true;
  const trimmed = Number(hist.__samplesTrimmed || 0) > 0;
  const ingestVersion = opts.ingestVersion || 'v1';
  const source = opts.source || 'sync';
  const tenantId = tenantIdForNamespace(adminNs);
  let ok = true;

  if (replaceAll || segmentsDirty || trimmed) {
    try {
      await streamHistoryDb.replaceTenantHistory({
        tenantId,
        segments: Array.isArray(hist.segments) ? hist.segments : [],
        samples: Array.isArray(hist.samples) ? hist.samples : [],
        source,
        ingestVersion
      });
    } catch (err) {
      console.error('[stream-history][db] replaceTenantHistory failed', err);
      ok = false;
    }
    return ok;
  }

  const pending = Array.isArray(hist.__pendingSamples) ? hist.__pendingSamples : [];
  if (!pending.length) return ok;

  for (const sample of pending) {
    const ts = Number(sample?.ts);
    if (!Number.isFinite(ts)) continue;
    const sampleAt = new Date(ts);
    const rawViewers = Number(sample?.viewers);
    const viewers = Number.isFinite(rawViewers) ? rawViewers : 0;
    try {
      await streamHistoryDb.recordSample({
        tenantId,
        sampleAt,
        live: !!sample?.live,
        viewers,
        payload: sample || null,
        ingestVersion,
        sessionId: null
      });
    } catch (err) {
      console.error('[stream-history][db] recordSample failed', err);
      ok = false;
    }
  }

  return ok;
}

async function maybeSyncHistoryDb(adminNs, hist, opts = {}) {
  try {
    return await syncHistoryDb(adminNs, hist, opts);
  } catch (err) {
    console.error('[stream-history][db] sync error', err);
    return false;
  }
}

const STREAM_HISTORY_DISABLE_TRIM = process.env.GETTY_STREAM_HISTORY_DISABLE_TRIM === '1';

const STREAM_HISTORY_MAX_SAMPLES_OVERRIDE = (() => {
  const raw = Number(process.env.GETTY_STREAM_HISTORY_MAX_SAMPLES);
  if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  return null;
})();
let STREAM_HISTORY_MAX_SAMPLES = STREAM_HISTORY_MAX_SAMPLES_OVERRIDE != null
  ? STREAM_HISTORY_MAX_SAMPLES_OVERRIDE
  : 0;

function setStreamHistorySampleCap(cap) {
  if (!Number.isFinite(cap) || cap < 0) {
    STREAM_HISTORY_MAX_SAMPLES = 0;
    return;
  }
  STREAM_HISTORY_MAX_SAMPLES = Math.floor(cap);
}

function getStreamHistorySampleCap() {
  return STREAM_HISTORY_MAX_SAMPLES;
}

const DEFAULT_STORE_ENCRYPTION_KEY = 'default-insecure-key-change-me';
const STORE_ENCRYPTION_KEY = (() => {
  try {
    const passphrase = process.env.STORE_ENCRYPTION_KEY || DEFAULT_STORE_ENCRYPTION_KEY;
    return crypto.scryptSync(passphrase, 'salt', 32);
  } catch {
    return crypto.scryptSync(DEFAULT_STORE_ENCRYPTION_KEY, 'salt', 32);
  }
})();

function encryptText(text) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', STORE_ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch {
    return null;
  }
}

function decryptText(payload) {
  try {
    const parts = String(payload || '').split(':');
    if (parts.length !== 2) return String(payload || '');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', STORE_ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

function encryptJSON(obj) {
  const json = JSON.stringify(obj == null ? null : obj);
  let payload = json;
  try {
    const compressed = zlib.deflateSync(Buffer.from(json, 'utf8'));
    if (compressed && compressed.length < Buffer.byteLength(json)) {
      payload = `::gz::${compressed.toString('base64')}`;
    }
  } catch {}
  return encryptText(payload);
}

function decryptJSON(payload, fallback) {
  try {
    const text = decryptText(payload);
    if (text == null) return fallback;
    if (text.startsWith('::gz::')) {
      try {
        const buf = Buffer.from(text.slice(6), 'base64');
        const inflated = zlib.inflateSync(buf).toString('utf8');
        return JSON.parse(inflated);
      } catch {
        return fallback;
      }
    }
    return JSON.parse(text);
  } catch {
    try { return JSON.parse(String(payload || '')); } catch { return fallback; }
  }
}

function markSegmentsDirty(hist) {
  if (!hist || typeof hist !== 'object') return;
  hist.__segmentsDirty = true;
}

function markSamplesTrimmed(hist, count) {
  if (!hist || typeof hist !== 'object') return;
  const amt = Number(count);
  if (!Number.isFinite(amt) || amt <= 0) return;
  hist.__samplesTrimmed = (hist.__samplesTrimmed || 0) + Math.floor(amt);
}

function markSampleAppended(hist, sample) {
  if (!hist || typeof hist !== 'object') return;
  if (!hist.__pendingSamples) hist.__pendingSamples = [];
  hist.__pendingSamples.push(sample);
}

function markReplaceAll(hist) {
  if (!hist || typeof hist !== 'object') return;
  hist.__replaceAll = true;
}

function clearPersistenceMarkers(hist) {
  if (!hist || typeof hist !== 'object') return;
  delete hist.__segmentsDirty;
  delete hist.__samplesTrimmed;
  delete hist.__pendingSamples;
  delete hist.__replaceAll;
}

function normalizeHistoryData(raw) {
  const base = raw && typeof raw === 'object' ? raw : {};
  const segments = Array.isArray(base.segments) ? base.segments.filter(Boolean) : [];
  const samples = Array.isArray(base.samples) ? base.samples.filter(Boolean) : [];
  return { segments, samples };
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function loadHistoryFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { segments: [] };
    const j = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!j || typeof j !== 'object' || !Array.isArray(j.segments)) return { segments: [] };
  if (!Array.isArray(j.samples)) j.samples = [];
  return j;
  } catch { return { segments: [] }; }
}

function saveHistoryToFile(filePath, data) {
  try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); } catch {}
}

function startSegment(hist, ts) {
  const last = hist.segments[hist.segments.length - 1];
  if (last && !last.end) return;
  hist.segments.push({ start: ts, end: null });
  markSegmentsDirty(hist);
}

function endSegment(hist, ts) {
  const last = hist.segments[hist.segments.length - 1];
  if (last && !last.end) {
    last.end = ts;
    markSegmentsDirty(hist);
  }
}

function truncateSegments(hist, maxDays = 400) {
  if (STREAM_HISTORY_DISABLE_TRIM) return;
  try {
    const cutoff = Date.now() - maxDays * 86400000;
    if (Array.isArray(hist.segments)) {
      const beforeSegCount = hist.segments.length;
      hist.segments = hist.segments.filter(s => (s.end || s.start) >= cutoff);
      if (hist.segments.length !== beforeSegCount) markSegmentsDirty(hist);
    }
    if (Array.isArray(hist.samples)) {
      const beforeLen = hist.samples.length;
      const filtered = hist.samples.filter(s => s.ts >= cutoff);
      const removedByCutoff = beforeLen - filtered.length;
      if (removedByCutoff > 0) markSamplesTrimmed(hist, removedByCutoff);
      hist.samples = filtered;
      const cap = getStreamHistorySampleCap();
      if (cap > 0 && hist.samples.length > cap) {
        const excess = hist.samples.length - cap;
        hist.samples = hist.samples.slice(excess);
        markSamplesTrimmed(hist, excess);
      }
    }
  } catch {}
}

function closeStaleOpenSegment(hist, nowTs = Date.now(), freshMs = 150000) {
  try {
    if (!hist || !Array.isArray(hist.segments)) return;
    const lastSeg = hist.segments[hist.segments.length - 1];
    if (!lastSeg || lastSeg.end) return;
    const samples = Array.isArray(hist.samples) ? hist.samples : [];
    const lastSample = samples.length ? samples[samples.length - 1] : null;
    const lastSampleTs = lastSample ? Number(lastSample.ts || 0) : 0;
    if (!lastSampleTs) {
      const twelveHoursMs = 12 * 3600000;
      const ninetyMinutesMs = 90 * 60000;
      const staleThreshold = Math.min(twelveHoursMs, ninetyMinutesMs);
      if (nowTs - lastSeg.start > staleThreshold) {
        lastSeg.end = nowTs - freshMs;
        markSegmentsDirty(hist);
      }
      return;
    }
    const age = nowTs - lastSampleTs;
    const staleLimit = Math.max(freshMs, 90 * 60000);
    if (age > staleLimit) {
      if (lastSampleTs >= lastSeg.start) {
        lastSeg.end = lastSampleTs;
        markSegmentsDirty(hist);
      }
    }
  } catch {}
}

function dayStartUTC(ts, tzOffsetMinutes) {
  const offsetMs = (tzOffsetMinutes || 0) * 60000;
  return Math.floor((ts + offsetMs) / 86400000) * 86400000 - offsetMs;
}

function splitSpanByDayTz(start, end, tzOffsetMinutes) {
  const out = [];
  let s = start;
  while (s < end) {
    const dayStart = dayStartUTC(s, tzOffsetMinutes);
    const nextDayStart = dayStart + 86400000;
    const e = Math.min(end, nextDayStart);
    out.push({ day: dayStart, ms: Math.max(0, e - s) });
    s = e;
  }
  return out;
}

function sanitizeSegments(rawSegments, nowTs) {
  if (!Array.isArray(rawSegments)) return [];
  return rawSegments
    .map(seg => {
      const start = Number(seg?.start);
      const endRaw = seg?.end == null ? nowTs : Number(seg.end);
      if (!isFinite(start) || !isFinite(endRaw)) return null;
      const end = Math.max(start, endRaw);
      if (end <= start) return null;
      return { start, end };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
}

function sortSamples(rawSamples) {
  if (!Array.isArray(rawSamples)) return [];
  return [...rawSamples]
    .filter(s => Number.isFinite(Number(s?.ts)))
    .sort((a, b) => Number(a.ts) - Number(b.ts));
}

function buildLiveIntervals(samples, nowTs) {
  const intervals = [];
  let currentStart = null;
  let prevSampleForCurrent = null;
  for (let i = 0; i < samples.length; i++) {
    const cur = samples[i];
    const curTs = Number(cur?.ts || 0);
    if (!isFinite(curTs)) continue;
    if (currentStart == null) {
      if (cur && cur.live) {
        currentStart = curTs;
        prevSampleForCurrent = samples[i - 1] || null;
      }
      continue;
    }
    if (cur && cur.live) continue;
    const endTs = curTs;
    if (isFinite(endTs) && endTs > currentStart) {
      intervals.push({
        start: currentStart,
        end: endTs,
        prevSample: prevSampleForCurrent,
        nextSample: cur,
      });
    }
    currentStart = null;
    prevSampleForCurrent = null;
  }
  if (currentStart != null) {
    const endTs = Number(nowTs);
    if (isFinite(endTs) && endTs > currentStart) {
      intervals.push({
        start: currentStart,
        end: endTs,
        prevSample: prevSampleForCurrent,
        nextSample: null,
      });
    }
  }
  return intervals;
}

function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out = [Object.assign({}, sorted[0])];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push(Object.assign({}, cur));
    }
  }
  return out;
}

function extendIntervalsWithSegments(intervals, segments, opts = {}) {
  if (!intervals.length) return [];
  const maxPadMs = Math.max(0, Number(opts.maxPadMs ?? 2 * 3600000));
  const padRatio = Math.max(0, Number(opts.padRatio ?? 0.25));
  const padExtraMs = Math.max(0, Number(opts.padExtraMs ?? 5 * 60000));
  const out = [];
  for (const interval of intervals) {
    let start = interval.start;
    let end = interval.end;
    const duration = Math.max(0, end - start);
    const overlaps = segments.filter(seg => seg.end > (start - maxPadMs) && seg.start < (end + maxPadMs));
    const segStartBound = overlaps.length ? Math.min(...overlaps.map(s => s.start)) : start;
    const segEndBound = overlaps.length ? Math.max(...overlaps.map(s => s.end)) : end;
    const prevOfflineTs = interval.prevSample && interval.prevSample.live === false ? Number(interval.prevSample.ts) : null;
    const nextOfflineTs = interval.nextSample && interval.nextSample.live === false ? Number(interval.nextSample.ts) : null;
    const lowerBound = Math.max(
      isFinite(segStartBound) ? segStartBound : start,
      prevOfflineTs != null && isFinite(prevOfflineTs) ? prevOfflineTs : -Infinity
    );
    const upperBound = Math.min(
      isFinite(segEndBound) ? segEndBound : end,
      nextOfflineTs != null && isFinite(nextOfflineTs) ? nextOfflineTs : Infinity
    );
    const padLimit = Math.min(maxPadMs, duration * padRatio + padExtraMs);
    const backPad = Math.min(Math.max(0, start - lowerBound), padLimit);
    const fwdPad = Math.min(Math.max(0, upperBound - end), padLimit);
    start = Math.max(lowerBound, start - backPad);
    end = Math.min(upperBound, end + fwdPad);
    if (end > start) out.push({ start, end });
  }
  return mergeIntervals(out);
}

function computeSessionStats(segments, samples, nowTs, tzOffsetMinutes = 0, limit = 5) {
  if (!Array.isArray(segments) || !segments.length) return [];
  const sortedSegments = [...segments].sort((a, b) => Number(a.start) - Number(b.start));
  const safeSamples = Array.isArray(samples) ? samples : [];
  const sessions = [];

  for (const seg of sortedSegments) {
    const start = Number(seg?.start);
    const rawEnd = seg?.end == null ? nowTs : seg.end;
    const end = Number(rawEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

    let liveMs = 0;
    let viewerSeconds = 0;
    let peakViewers = 0;

    for (let i = 0; i < safeSamples.length; i++) {
      const sample = safeSamples[i];
      const ts = Number(sample?.ts || 0);
      if (!Number.isFinite(ts)) continue;
      const nextSample = safeSamples[i + 1];
      const nextTsRaw = nextSample ? Number(nextSample.ts || ts) : Number(nowTs);
      const nextTs = Number.isFinite(nextTsRaw) ? nextTsRaw : ts;
      if (nextTs <= start) continue;
      if (ts >= end) break;

      const windowStart = Math.max(start, ts);
      const windowEnd = Math.min(end, nextTs);
      if (windowEnd <= windowStart) continue;

      if (sample?.live) {
        const spanMs = windowEnd - windowStart;
        liveMs += spanMs;
        const viewers = Math.max(0, Number(sample.viewers || 0));
        viewerSeconds += viewers * (spanMs / 1000);
        if (Number.isFinite(viewers)) {
          peakViewers = Math.max(peakViewers, viewers);
        }
      }
    }

    if (liveMs <= 0) {
      liveMs = Math.max(0, end - start);
    }

    const durationHours = liveMs / 3600000;
    const durationSeconds = liveMs / 1000;
    const avgViewers = durationSeconds > 0
      ? Number((viewerSeconds / durationSeconds).toFixed(2))
      : 0;
    const viewerHours = Number((viewerSeconds / 3600).toFixed(2));
    const dayKey = formatLocalDateYMD(start, tzOffsetMinutes) || null;

    sessions.push({
      startEpoch: start,
      endEpoch: end,
      durationMs: liveMs,
      durationHours: Number(durationHours.toFixed(4)),
      avgViewers,
      peakViewers: Number.isFinite(peakViewers) ? peakViewers : 0,
      viewerHours,
      activeDayKey: dayKey,
      tzOffsetMinutes,
    });
  }

  sessions.sort((a, b) => a.startEpoch - b.startEpoch);
  if (!sessions.length) return sessions;
  const cap = Math.max(1, Math.floor(Number(limit) || 0));
  return sessions.slice(-cap);
}

function formatLocalDateParts(epoch, offsetMinutes) {
  if (!Number.isFinite(epoch)) return null;
  const local = new Date(epoch + (offsetMinutes || 0) * 60000);
  if (Number.isNaN(local.getTime())) return null;
  return {
    year: local.getUTCFullYear(),
    month: String(local.getUTCMonth() + 1).padStart(2, '0'),
    day: String(local.getUTCDate()).padStart(2, '0'),
  };
}

function formatLocalDateYMD(epoch, offsetMinutes) {
  const parts = formatLocalDateParts(epoch, offsetMinutes);
  if (!parts) return '';
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatLocalYearMonth(epoch, offsetMinutes) {
  const parts = formatLocalDateParts(epoch, offsetMinutes);
  if (!parts) return '';
  return `${parts.year}-${parts.month}`;
}

function formatLocalYear(epoch, offsetMinutes) {
  const parts = formatLocalDateParts(epoch, offsetMinutes);
  if (!parts) return '';
  return String(parts.year);
}

function parseLocalDateYMD(dateStr, offsetMinutes) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  const m = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!m) return null;
  const year = Number(trimmed.slice(0, 4));
  const month = Number(trimmed.slice(5, 7)) - 1;
  const day = Number(trimmed.slice(8, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 0 || month > 11) return null;
  const utc = Date.UTC(year, month, day);
  if (!Number.isFinite(utc)) return null;
  const offset = (offsetMinutes || 0) * 60000;
  const epoch = utc - offset;
  const checkParts = formatLocalDateParts(epoch, offsetMinutes || 0);
  if (!checkParts) return null;
  if (checkParts.year !== year) return null;
  if (checkParts.month !== String(month + 1).padStart(2, '0')) return null;
  if (checkParts.day !== String(day).padStart(2, '0')) return null;
  return epoch;
}

function computeBucketEndEpoch(bucketStartEpoch, bucketPeriod, offsetMinutes) {
  const offset = offsetMinutes || 0;
  const startLocal = bucketStartEpoch + offset * 60000;
  const startDate = new Date(startLocal);
  const year = startDate.getUTCFullYear();
  const month = startDate.getUTCMonth();
  const day = startDate.getUTCDate();
  let endLocal;
  if (bucketPeriod === 'week') {
    endLocal = Date.UTC(year, month, day + 7);
  } else if (bucketPeriod === 'month') {
    endLocal = Date.UTC(year, month + 1, 1);
  } else if (bucketPeriod === 'year') {
    endLocal = Date.UTC(year + 1, 0, 1);
  } else {
    endLocal = startLocal + 86400000;
  }
  return endLocal - offset * 60000;
}

function computeRangeEndEpoch(bucketStartEpoch, bucketPeriod, offsetMinutes) {
  const offset = offsetMinutes || 0;
  const startLocal = bucketStartEpoch + offset * 60000;
  const startDate = new Date(startLocal);
  const year = startDate.getUTCFullYear();
  const month = startDate.getUTCMonth();
  const day = startDate.getUTCDate();
  let endLocal;
  if (bucketPeriod === 'week') {
    endLocal = Date.UTC(year, month, day + 6);
  } else if (bucketPeriod === 'month') {
    endLocal = Date.UTC(year, month + 1, 0);
  } else if (bucketPeriod === 'year') {
    endLocal = Date.UTC(year, 11, 31);
  } else {
    endLocal = startLocal;
  }
  return endLocal - offset * 60000;
}

function previousBucketStart(bucketStartEpoch, bucketPeriod, offsetMinutes = 0) {
  if (!Number.isFinite(bucketStartEpoch)) return null;
  const offset = offsetMinutes || 0;
  if (bucketPeriod === 'week') {
    return bucketStartEpoch - 7 * 86400000;
  }
  if (bucketPeriod === 'month') {
    const local = new Date(bucketStartEpoch + offset * 60000);
    const prevLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1);
    return prevLocal - offset * 60000;
  }
  if (bucketPeriod === 'year') {
    const local = new Date(bucketStartEpoch + offset * 60000);
    const prevLocal = Date.UTC(local.getUTCFullYear() - 1, 0, 1);
    return prevLocal - offset * 60000;
  }
  return bucketStartEpoch - 86400000;
}

function makeEmptyAggregate(bucketStartEpoch, bucketPeriod, offsetMinutes = 0) {
  if (!Number.isFinite(bucketStartEpoch)) return null;
  const bucketEndEpoch = computeBucketEndEpoch(bucketStartEpoch, bucketPeriod, offsetMinutes);
  const rangeEndEpoch = computeRangeEndEpoch(bucketStartEpoch, bucketPeriod, offsetMinutes);
  let bucketLabel;
  if (bucketPeriod === 'month') {
    bucketLabel = formatLocalYearMonth(bucketStartEpoch, offsetMinutes);
  } else if (bucketPeriod === 'year') {
    bucketLabel = formatLocalYear(bucketStartEpoch, offsetMinutes);
  } else {
    bucketLabel = formatLocalDateYMD(bucketStartEpoch, offsetMinutes);
  }
  const dateLabel = bucketPeriod === 'day'
    ? bucketLabel
    : formatLocalDateYMD(bucketStartEpoch, offsetMinutes);
  return {
    date: dateLabel,
    epoch: bucketStartEpoch,
    bucketStartEpoch,
    bucketEndEpoch,
    bucketLabel,
    tzOffsetMinutes: offsetMinutes,
    hours: 0,
    avgViewers: 0,
    peakViewers: 0,
    rangeStartEpoch: bucketStartEpoch,
    rangeEndEpoch,
    rangeStartDate: formatLocalDateYMD(bucketStartEpoch, offsetMinutes),
    rangeEndDate: formatLocalDateYMD(rangeEndEpoch, offsetMinutes),
  };
}

function aggregateDailyBuckets(hist, spanDays = 30, tzOffsetMinutes = 0, options = {}) {
  const offset = tzOffsetMinutes || 0;
  const windowEndOverride = Number.isFinite(options?.windowEndEpoch)
    ? Number(options.windowEndEpoch)
    : null;
  const runtimeNow = Date.now();
  const anchorNow = windowEndOverride != null ? windowEndOverride : runtimeNow;
  const todayStart = dayStartUTC(anchorNow, offset);
  const span = Math.max(1, Math.floor(Number(spanDays) || 0));
  const buckets = [];
  const fmtYMD = (dayStart) => formatLocalDateYMD(dayStart, offset);
  for (let i = span - 1; i >= 0; i--) {
    const dayStart = todayStart - i * 86400000;
    buckets.push({ key: dayStart, label: fmtYMD(dayStart), ms: 0, vsec: 0, lsec: 0, peak: 0 });
  }
  if (!buckets.length) return [];
  const bmap = new Map(buckets.map(b => [b.key, b]));
  const rangeStart = buckets[0].key;
  const rangeEndCandidate = buckets[buckets.length - 1].key + 86400000;
  const rangeEnd = windowEndOverride != null
    ? Math.min(rangeEndCandidate, windowEndOverride + 1)
    : rangeEndCandidate;

  const clampCandidate = windowEndOverride != null ? Math.min(windowEndOverride, rangeEnd) : rangeEnd;
  const clampNow = Math.max(rangeStart, Math.min(runtimeNow, clampCandidate));

  const segments = sanitizeSegments(hist.segments, clampNow);
  const samples = sortSamples(hist.samples);
  const liveIntervals = buildLiveIntervals(samples, clampNow);
  const paddedIntervals = extendIntervalsWithSegments(liveIntervals, segments, {
    maxPadMs: 2 * 3600000,
    padRatio: 1,
    padExtraMs: 5 * 60000,
  });
  const hasLiveSamples = samples.some(s => s && s.live);

  let liveMsFromIntervals = 0;
  for (const interval of paddedIntervals) {
    const s = Math.max(rangeStart, interval.start);
    const e = Math.min(rangeEnd, interval.end);
    if (e <= s) continue;
    liveMsFromIntervals += (e - s);
    for (const part of splitSpanByDayTz(s, e, offset)) {
      const b = bmap.get(part.day);
      if (b) b.ms += part.ms;
    }
  }

  if (liveMsFromIntervals === 0 && !hasLiveSamples) {
    for (const seg of segments) {
      const s = Math.max(seg.start, rangeStart);
      const e = Math.min(seg.end, rangeEnd);
      if (e <= s) continue;
      for (const part of splitSpanByDayTz(s, e, offset)) {
        const b = bmap.get(part.day);
        if (b) b.ms += part.ms;
      }
    }
  }

  try {
    for (let i = 0; i < samples.length; i++) {
      const cur = samples[i];
      const next = samples[i + 1] || null;
      const curTs = Number(cur?.ts || 0);
  const nextTs = Number(next ? next.ts : clampNow);
      if (!isFinite(curTs) || !isFinite(nextTs)) continue;
      const t0 = Math.max(rangeStart, curTs);
      const t1 = Math.min(rangeEnd, nextTs);
      if (t1 <= t0) continue;
      if (cur && cur.live) {
        const v = Math.max(0, Number(cur.viewers || 0));
        for (const part of splitSpanByDayTz(t0, t1, offset)) {
          const b = bmap.get(part.day);
          if (!b) continue;
          const sec = Math.max(0, part.ms / 1000);
          b.vsec += v * sec;
          b.lsec += sec;
          if (Number.isFinite(v)) b.peak = Math.max(b.peak || 0, v);
        }
      }
    }
  } catch {}

  return buckets.map(b => ({
    date: b.label,
    epoch: b.key,
    tzOffsetMinutes: offset,
    hours: +(b.ms / 3600000).toFixed(2),
    avgViewers: b.lsec > 0 ? +(b.vsec / b.lsec).toFixed(2) : 0,
    peakViewers: Number(b.peak || 0),
    bucketStartEpoch: b.key,
    bucketEndEpoch: computeBucketEndEpoch(b.key, 'day', offset),
    bucketLabel: b.label,
    rangeStartEpoch: b.key,
    rangeEndEpoch: computeRangeEndEpoch(b.key, 'day', offset),
    rangeStartDate: formatLocalDateYMD(b.key, offset),
    rangeEndDate: formatLocalDateYMD(b.key, offset),
  }));
}

function aggregate(hist, period = 'day', span = 30, tzOffsetMinutes = 0, options = {}) {
  const offset = tzOffsetMinutes || 0;
  const bucketPeriod = options.bucketPeriod || period;
  const normalizedSpan = Math.max(1, Math.floor(Number(span) || 0));
  if (bucketPeriod === 'day' && period === 'day') {
    return aggregateDailyBuckets(hist, normalizedSpan, offset, options);
  }

  const daysPerUnit = period === 'day' ? 1 : (period === 'week' ? 7 : (period === 'month' ? 30 : 365));
  const totalDays = normalizedSpan * daysPerUnit;
  const daily = aggregateDailyBuckets(hist, totalDays, offset, options);
  if (bucketPeriod === 'day') {
    return daily;
  }

  const map = new Map();
  const localFromEpoch = (epoch) => new Date(epoch + offset * 60000);

  for (const item of daily) {
    const dayEpoch = Number(item?.epoch);
    if (!Number.isFinite(dayEpoch)) continue;
    const dLocal = localFromEpoch(dayEpoch);
    if (Number.isNaN(dLocal.getTime())) continue;

    let bucketStartLocal;
    let bucketStartEpoch;
    let bucketLabel;

    const year = dLocal.getUTCFullYear();
    const month = dLocal.getUTCMonth();
    const date = dLocal.getUTCDate();

    if (bucketPeriod === 'week') {
      const dow = dLocal.getUTCDay();
      bucketStartLocal = Date.UTC(year, month, date - dow);
      bucketStartEpoch = bucketStartLocal - offset * 60000;
      bucketLabel = formatLocalDateYMD(bucketStartEpoch, offset);
    } else if (bucketPeriod === 'month') {
      bucketStartLocal = Date.UTC(year, month, 1);
      bucketStartEpoch = bucketStartLocal - offset * 60000;
      bucketLabel = formatLocalYearMonth(bucketStartEpoch, offset);
    } else {
      bucketStartLocal = Date.UTC(year, 0, 1);
      bucketStartEpoch = bucketStartLocal - offset * 60000;
      bucketLabel = formatLocalYear(bucketStartEpoch, offset);
    }

    const bucketEndEpoch = computeBucketEndEpoch(bucketStartEpoch, bucketPeriod, offset);
    const rangeEndEpoch = computeRangeEndEpoch(bucketStartEpoch, bucketPeriod, offset);

    const key = bucketStartEpoch;
    const entry = map.get(key) || {
      bucketStartEpoch,
      bucketEndEpoch,
      bucketLabel,
      rangeStartEpoch: bucketStartEpoch,
      rangeEndEpoch,
      hours: 0,
      vsec: 0,
      lsec: 0,
      peakViewers: 0,
      firstActiveEpoch: null,
      lastActiveEpoch: null,
    };

    const hoursVal = Number(item?.hours || 0);
    if (Number.isFinite(hoursVal)) entry.hours += hoursVal;
    const positiveHours = Math.max(0, hoursVal);
    if (positiveHours > 0) {
      if (!Number.isFinite(entry.firstActiveEpoch) || dayEpoch < entry.firstActiveEpoch) {
        entry.firstActiveEpoch = dayEpoch;
      }
      if (!Number.isFinite(entry.lastActiveEpoch) || dayEpoch > entry.lastActiveEpoch) {
        entry.lastActiveEpoch = dayEpoch;
      }
    }

    const inferredLsec = positiveHours * 3600;
    if (inferredLsec > 0 && Number.isFinite(Number(item?.avgViewers || 0))) {
      const viewers = Number(item.avgViewers);
      entry.vsec += viewers * inferredLsec;
      entry.lsec += inferredLsec;
    }

    const peakCandidate = Number(item?.peakViewers || 0);
    if (Number.isFinite(peakCandidate)) {
      entry.peakViewers = Math.max(entry.peakViewers, peakCandidate);
    }

    map.set(key, entry);
  }

  const aggregates = Array.from(map.values())
    .sort((a, b) => a.bucketStartEpoch - b.bucketStartEpoch)
    .map((entry) => {
      const anchorEpoch = Number.isFinite(entry.lastActiveEpoch)
        ? entry.lastActiveEpoch
        : (Number.isFinite(entry.firstActiveEpoch) ? entry.firstActiveEpoch : entry.bucketStartEpoch);
      const totalHours = Number(entry.hours || 0);
      return {
        date: formatLocalDateYMD(anchorEpoch, offset) || entry.bucketLabel,
        epoch: anchorEpoch,
        bucketStartEpoch: entry.bucketStartEpoch,
        bucketEndEpoch: entry.bucketEndEpoch,
        bucketLabel: entry.bucketLabel,
        tzOffsetMinutes: offset,
        hours: +totalHours.toFixed(2),
        avgViewers: entry.lsec > 0 ? +Number(entry.vsec / entry.lsec).toFixed(2) : 0,
        peakViewers: Number(entry.peakViewers || 0),
        rangeStartEpoch: entry.rangeStartEpoch,
        rangeEndEpoch: entry.rangeEndEpoch,
        rangeStartDate: formatLocalDateYMD(entry.rangeStartEpoch, offset),
        rangeEndDate: formatLocalDateYMD(entry.rangeEndEpoch, offset),
      };
    });

  if (!aggregates.length) return aggregates;

  const lastActiveIndex = aggregates.reduce((acc, entry, i) => (entry.hours > 0 ? i : acc), -1);
  let window;
  if (lastActiveIndex >= 0) {
    const cap = normalizedSpan;
    const startIndex = Math.max(0, lastActiveIndex - cap + 1);
    window = aggregates.slice(startIndex, lastActiveIndex + 1);
  } else {
    window = aggregates.slice(-normalizedSpan);
    if (!window.length && aggregates.length) {
      window = [aggregates[aggregates.length - 1]];
    }
  }

  if (window.length && window.length < normalizedSpan) {
    let cursor = window[0].bucketStartEpoch;
    for (let i = window.length; i < normalizedSpan; i++) {
      cursor = previousBucketStart(cursor, bucketPeriod, offset);
      if (!Number.isFinite(cursor)) break;
      const placeholder = makeEmptyAggregate(cursor, bucketPeriod, offset);
      if (!placeholder) break;
      window.unshift(placeholder);
    }
  }

  return window;
}

function rangeWindow(period = 'day', span = 30, tzOffsetMinutes = 0, options = {}) {
  const offset = tzOffsetMinutes || 0;
  const windowEndOverride = Number.isFinite(options?.windowEndEpoch)
    ? Number(options.windowEndEpoch)
    : null;
  const anchorNow = windowEndOverride != null ? windowEndOverride : Date.now();
  const todayStart = dayStartUTC(anchorNow, offset);
  const days = period === 'day' ? span : (period === 'week' ? span * 7 : (period === 'month' ? span * 30 : span * 365));
  const start = todayStart - (days - 1) * 86400000;
  const rangeEndCandidate = todayStart + 86400000;
  const windowEndExclusive = windowEndOverride != null ? (windowEndOverride + 1) : rangeEndCandidate;
  const end = Math.max(start, Math.min(rangeEndCandidate, windowEndExclusive));
  return { start, end };
}

function computePerformance(hist, period = 'day', span = 30, tzOffsetMinutes = 0, options = {}) {
  const { start, end } = rangeWindow(period, span, tzOffsetMinutes, options);
  const windowEndOverride = Number.isFinite(options?.windowEndEpoch)
    ? Number(options.windowEndEpoch)
    : null;
  const runtimeNow = Date.now();
  const clampCandidate = windowEndOverride != null ? Math.min(windowEndOverride, end) : end;
  const nowTs = Math.max(start, Math.min(runtimeNow, clampCandidate));

  const segments = sanitizeSegments(hist.segments, nowTs);
  const sortedSamples = sortSamples(hist.samples);
  const liveIntervals = buildLiveIntervals(sortedSamples, nowTs);
  const paddedIntervals = extendIntervalsWithSegments(liveIntervals, segments, {
    maxPadMs: 2 * 3600000,
    padRatio: 1,
    padExtraMs: 5 * 60000,
  });
  const hasLiveSamples = sortedSamples.some(s => s && s.live);

  let liveMsInRange = 0;
  for (const interval of paddedIntervals) {
    const s = Math.max(start, interval.start);
    const e = Math.min(end, interval.end);
    if (e > s) liveMsInRange += (e - s);
  }
  if (liveMsInRange === 0 && !hasLiveSamples) {
    for (const seg of segments) {
      const s = Math.max(start, seg.start);
      const e = Math.min(end, seg.end);
      if (e > s) liveMsInRange += (e - s);
    }
  }
  const hoursStreamed = +(liveMsInRange / 3600000).toFixed(2);

  const daily = aggregate(hist, 'day', Math.round((end - start) / 86400000), tzOffsetMinutes, options);
  const activeDays = daily.filter(d => (d.hours || 0) > 0).length;

  let peakViewers = 0;
  let rangeWatchedHours = 0;
  let liveWeightedSeconds = 0;
  for (let i = 0; i < sortedSamples.length; i++) {
    const cur = sortedSamples[i];
    const next = sortedSamples[i + 1] || null;
    const curTs = Number(cur?.ts || 0);
    const nextTs = Number(next ? next.ts : nowTs);
    if (!isFinite(curTs) || !isFinite(nextTs)) continue;
    if (curTs >= start && curTs <= end) {
      peakViewers = Math.max(peakViewers, Number(cur.viewers || 0));
    }
    const t0 = Math.max(start, curTs);
    const t1 = Math.min(end, nextTs);
    if (t1 <= t0 || !cur?.live) continue;
    const dtSec = (t1 - t0) / 1000;
    const v = Math.max(0, Number(cur.viewers || 0));
    rangeWatchedHours += v * (dtSec / 3600);
    liveWeightedSeconds += dtSec;
  }
  const avgViewers = liveWeightedSeconds > 0 ? +(rangeWatchedHours / (liveWeightedSeconds / 3600)).toFixed(2) : 0;
  const watchedHours = +rangeWatchedHours.toFixed(2);

  let totalLiveMs = 0;
  if (paddedIntervals.length) {
    for (const interval of paddedIntervals) {
      const span = Math.max(0, interval.end - interval.start);
      totalLiveMs += span;
    }
  } else {
    for (const seg of segments) {
      const span = Math.max(0, seg.end - seg.start);
      totalLiveMs += span;
    }
  }
  const totalHoursStreamed = +(totalLiveMs / 3600000).toFixed(2);
  const highestViewers = Array.isArray(hist.samples) && hist.samples.length ? Math.max(...hist.samples.map(s => Number(s.viewers || 0))) : 0;
  const recentStreams = computeSessionStats(segments, sortedSamples, nowTs, tzOffsetMinutes, 6);

  return {
    range: {
      hoursStreamed,
      avgViewers,
      peakViewers,
      hoursWatched: watchedHours,
      activeDays
    },
    allTime: {
      totalHoursStreamed,
      highestViewers
    },
    recentStreams,
    tzOffsetMinutes
  };
}

function registerStreamHistoryRoutes(app, limiter, options = {}) {
  const store = options.store || null;
  const historyStore = options.historyStore || null;
  const forceFileStore = process.env.GETTY_STREAM_HISTORY_FORCE_FILE === '1' || options.forceFileStore === true;
  const configStore = forceFileStore ? null : store;
  const redisStore = (!forceFileStore && historyStore && historyStore.redis)
    ? historyStore
    : (!forceFileStore && store && store.redis ? store : null);
  const redis = redisStore ? redisStore.redis : null;
  const storeTtlSeconds = redisStore && typeof redisStore.ttl === 'number'
    ? Math.max(0, Math.floor(redisStore.ttl))
    : null;
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const CONFIG_FILE = path.join(process.cwd(), 'config', 'stream-history-config.json');
  const DATA_DIR = path.join(process.cwd(), 'data');
  const DATA_FILE = path.join(DATA_DIR, 'stream-history.json');
  ensureDir(path.join(process.cwd(), 'config'));
  ensureDir(DATA_DIR);
  const TENANT_ROOT = path.join(process.cwd(), 'tenant');

  function redisKey(ns, key) {
    return `getty:${ns}:${key}`;
  }

  function redisSamplesKey(ns) {
    return redisKey(ns, 'stream-history:samples');
  }

  function redisSegmentsKey(ns) {
    return redisKey(ns, 'stream-history:segments');
  }

  function redisLegacyKey(ns) {
    return redisKey(ns, 'stream-history-data');
  }

  function getHistoryFilePath(adminNs) {
    if (!adminNs) return DATA_FILE;
    const safe = adminNs.replace(/[^a-zA-Z0-9_-]/g, '');
    const tenantDataDir = path.join(TENANT_ROOT, safe, 'data');
    ensureDir(tenantDataDir);
    return path.join(tenantDataDir, 'stream-history.json');
  }

  async function persistHistoryToRedis(adminNs, hist, opts = {}) {
    if (!redis || !adminNs) return false;
    const data = normalizeHistoryData(hist);
    const samplesKey = redisSamplesKey(adminNs);
    const segmentsKey = redisSegmentsKey(adminNs);
    const legacyKey = redisLegacyKey(adminNs);
    const pendingSamples = Array.isArray(hist.__pendingSamples) ? hist.__pendingSamples : [];
    const replaceAll = opts.forceReplace === true || hist.__replaceAll === true;
    const segmentsDirty = replaceAll || opts.forceSegments === true || hist.__segmentsDirty === true;
    const trimmedCount = replaceAll ? 0 : Number(hist.__samplesTrimmed || 0);
    const totalSamples = Array.isArray(data.samples) ? data.samples.length : 0;
    let wrote = false;

    try {
      if (replaceAll) {
        await redis.del(samplesKey);
        if (totalSamples > 0) {
          const payloads = data.samples
            .map(sample => encryptJSON(sample))
            .filter(Boolean);
          if (payloads.length) {
            await redis.rpush(samplesKey, ...payloads);
            wrote = true;
          }
        } else {
          wrote = true;
        }
      } else {
        if (pendingSamples.length) {
          const payloads = pendingSamples
            .map(sample => encryptJSON(sample))
            .filter(Boolean);
          if (payloads.length) {
            await redis.rpush(samplesKey, ...payloads);
            wrote = true;
          }
        }
        if (trimmedCount > 0) {
          if (totalSamples > 0) {
            await redis.ltrim(samplesKey, -totalSamples, -1);
          } else {
            await redis.del(samplesKey);
          }
          wrote = true;
        }
      }

      if (segmentsDirty) {
        const payload = encryptJSON(data.segments);
        if (payload != null) {
          if (storeTtlSeconds && storeTtlSeconds > 0) await redis.set(segmentsKey, payload, 'EX', storeTtlSeconds);
          else await redis.set(segmentsKey, payload);
        } else {
          await redis.del(segmentsKey);
        }
        wrote = true;
      }

      if (replaceAll) {
        await redis.del(legacyKey);
      }

      if (storeTtlSeconds && storeTtlSeconds > 0 && wrote) {
        await redis.expire(samplesKey, storeTtlSeconds);
        await redis.expire(segmentsKey, storeTtlSeconds);
      }

      return true;
    } catch {
      return false;
    }
  }

  async function loadHistoryFromRedis(adminNs) {
    if (!redis || !adminNs) return null;
    try {
      const segmentsRaw = await redis.get(redisSegmentsKey(adminNs));
      const samplesRaw = await redis.lrange(redisSamplesKey(adminNs), 0, -1);
      let segments = [];
      if (segmentsRaw) {
        const parsed = decryptJSON(segmentsRaw, null);
        if (Array.isArray(parsed)) segments = parsed;
      }
      let samples = [];
      if (Array.isArray(samplesRaw) && samplesRaw.length) {
        samples = samplesRaw
          .map(item => decryptJSON(item, null))
          .filter(v => v && typeof v === 'object' && Number.isFinite(Number(v.ts)));
      }

      if (!segmentsRaw && (!samplesRaw || samplesRaw.length === 0)) {
        const legacy = await (store ? store.get(adminNs, 'stream-history-data', null) : null);
        if (legacy && typeof legacy === 'object') {
          const normalized = normalizeHistoryData(legacy);
          markReplaceAll(normalized);
          await persistHistoryToRedis(adminNs, normalized, { forceReplace: true });
          if (store) {
            try { await store.del(adminNs, 'stream-history-data'); } catch {}
          }
          clearPersistenceMarkers(normalized);
          return normalized;
        }
      }

      return normalizeHistoryData({ segments, samples });
    } catch {
      return { segments: [], samples: [] };
    }
  }

  async function resolveAdminNs(req) {
    try {
      if (!store) return null;
      if (req?.ns?.admin) return req.ns.admin;
      if (req?.ns?.pub) {
        const admin = await store.get(req.ns.pub, 'adminToken', null);
        return typeof admin === 'string' && admin ? admin : null;
      }
      const token = (req.query?.token || '').toString();
      if (token) {
        const mapped = await store.get(token, 'adminToken', null);
        return mapped ? mapped : token;
      }
    } catch {}
    return null;
  }

  let loadTenantConfig = null, saveTenantConfig = null;
  try { ({ loadTenantConfig, saveTenantConfig } = require('../lib/tenant-config')); } catch {}

  async function loadConfigNS(req) {
    if (loadTenantConfig) {
      try {
        const wrapped = await loadTenantConfig(req, configStore, CONFIG_FILE, 'stream-history-config.json');
        if (wrapped && wrapped.data && typeof wrapped.data.claimid === 'string') {
          return { claimid: wrapped.data.claimid };
        }
      } catch {}
    }

    try {
      const adminNs = await resolveAdminNs(req);
      if (store && adminNs) {
        const legacy = await store.get(adminNs, 'stream-history-config', null);
        if (legacy && typeof legacy.claimid === 'string') {
          if (saveTenantConfig) {
            try { await saveTenantConfig(req, store, CONFIG_FILE, 'stream-history-config.json', { claimid: legacy.claimid }); } catch {}
          }
          return { claimid: legacy.claimid };
        }
      }
    } catch {}

    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const c = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        if (c && typeof c.claimid === 'string') {
            if (saveTenantConfig && !store) {
              try { await saveTenantConfig(req, store, CONFIG_FILE, 'stream-history-config.json', { claimid: c.claimid }); } catch {}
            }
          return { claimid: c.claimid };
        }
      }
    } catch {}
    return { claimid: '' };
  }

  async function saveConfigNS(req, cfg) {
    const claimid = (cfg.claimid || '').trim();
    const adminNs = await resolveAdminNs(req);
    let saved = false;

    if (saveTenantConfig && !saved) {
      try {
        await saveTenantConfig(req, configStore, CONFIG_FILE, 'stream-history-config.json', { claimid });
        saved = true;
      } catch {}
    }

    if (!saved && !forceFileStore && store && adminNs) {
      try {
        await store.set(adminNs, 'stream-history-config', { claimid });
        await rememberNamespace(adminNs, claimid);
        saved = true;
      } catch {
        return false;
      }
    }

    if (!saved) {
      try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({ claimid }, null, 2));
        saved = true;
      } catch {
        return false;
      }
    }

    if (saved) {
      await maybeEnsureTenant(adminNs, claimid);
      return true;
    }
    return false;
  }

  async function loadHistoryNS(req) {
    const adminNs = await resolveAdminNs(req);
    if (!forceFileStore && redis && adminNs) {
      const hist = await loadHistoryFromRedis(adminNs);
      closeStaleOpenSegment(hist);
      clearPersistenceMarkers(hist);
      return hist;
    }
    if (!forceFileStore && store && adminNs) {
      try {
        const j = await store.get(adminNs, 'stream-history-data', null);
        const hist = j && typeof j === 'object' ? j : { segments: [], samples: [] };
        if (!Array.isArray(hist.segments)) hist.segments = [];
        if (!Array.isArray(hist.samples)) hist.samples = [];

        closeStaleOpenSegment(hist);
        clearPersistenceMarkers(hist);
        return hist;
      } catch { return { segments: [], samples: [] }; }
    }
    const historyFile = getHistoryFilePath(adminNs);
    const fileHist = loadHistoryFromFile(historyFile);
    closeStaleOpenSegment(fileHist);
    clearPersistenceMarkers(fileHist);
    return fileHist;
  }

  async function saveHistoryNS(req, data, syncOptions = {}) {
    const adminNs = await resolveAdminNs(req);
    let persisted = false;

    if (!forceFileStore && redis && adminNs) {
      const ok = await persistHistoryToRedis(adminNs, data);
      if (!ok) return false;
      persisted = true;
    } else if (!forceFileStore && store && adminNs) {
      try {
        await store.set(adminNs, 'stream-history-data', data);
        persisted = true;
      } catch {
        return false;
      }
    } else {
      const historyFile = getHistoryFilePath(adminNs);
      try {
        saveHistoryToFile(historyFile, data);
        persisted = true;
      } catch {
        return false;
      }
    }

    if (!persisted) return false;

    const dbOk = await maybeSyncHistoryDb(adminNs, data, syncOptions);
    if (dbOk) {
      clearPersistenceMarkers(data);
    }
    return true;
  }

  const DEFAULT_POLL_EVERY_MS = 5000;
  const MIN_BACKGROUND_POLL_MS = DEFAULT_POLL_EVERY_MS;
  const DEFAULT_BACKGROUND_POLL_MS = 15000;
  const envBackgroundMs = Number(process.env.GETTY_STREAM_HISTORY_BACKGROUND_MS);
  const optionBackgroundMs = Number(options.backgroundPollMs);
  const requestedBackgroundMs = Number.isFinite(envBackgroundMs)
    ? envBackgroundMs
    : (Number.isFinite(optionBackgroundMs) ? optionBackgroundMs : NaN);
  const BACKGROUND_POLL_MS = Number.isFinite(requestedBackgroundMs)
    ? Math.max(MIN_BACKGROUND_POLL_MS, Math.floor(requestedBackgroundMs))
    : DEFAULT_BACKGROUND_POLL_MS;
  if (STREAM_HISTORY_MAX_SAMPLES_OVERRIDE == null) {
    setStreamHistorySampleCap(Math.ceil(86400000 / BACKGROUND_POLL_MS));
  }
  const bgPollers = new Map();
  const STREAM_HISTORY_NS_SET = 'getty:stream-history:namespaces';
  const STREAM_HISTORY_HEALTH_KEY = 'getty:stream-history:health';
  const HEALTH_CHECK_MS = Math.max(20000, BACKGROUND_POLL_MS);
  const STALE_THRESHOLD_MS = Math.max(HEALTH_CHECK_MS * 3, BACKGROUND_POLL_MS * 4);

  function makeReqLike(adminNs, pubNs = null) {
    const reqLike = {
      ns: { admin: adminNs || null, pub: pubNs || null },
      query: {},
      headers: {}
    };
    if (adminNs) reqLike.__forceWalletHash = adminNs;
    return reqLike;
  }

  function stopBackgroundPoller(key) {
    const existing = bgPollers.get(key);
    if (existing) {
      try { clearInterval(existing.timer); } catch {}
      bgPollers.delete(key);
      recordHealth(key, { ts: Date.now(), claimId: existing.claimId || null, live: false, stopped: true }).catch(() => {});
    }
  }

  async function rememberNamespace(adminNs, claimId) {
    if (forceFileStore || !store || !store.redis) return;
    if (!adminNs) return;
    const trimmed = typeof claimId === 'string' ? claimId.trim() : '';
    try {
      if (trimmed) await store.redis.sadd(STREAM_HISTORY_NS_SET, adminNs);
      else await store.redis.srem(STREAM_HISTORY_NS_SET, adminNs);
    } catch {}
  }

  async function recordHealth(key, info) {
    if (forceFileStore || !store || !store.redis || !key) return;
    try {
      await store.redis.hset(STREAM_HISTORY_HEALTH_KEY, key, JSON.stringify(info));
    } catch {}
  }

  async function pollLiveStatus(reqLike, adminNs, claimId, opts = {}) {
    const cfgClaim = typeof claimId === 'string' ? claimId.trim() : '';
    if (!cfgClaim) return null;
    const key = adminNs ? `ns:${adminNs}` : 'single';
    const nowTs = Date.now();
    const force = !!opts.force;
    if (!app.__shLastFetch) app.__shLastFetch = {};
    const lastTs = app.__shLastFetch[key] || 0;
    if (!force && (nowTs - lastTs) < DEFAULT_POLL_EVERY_MS) return null;
    app.__shLastFetch[key] = nowTs;
    try {
      const url = `https://api.odysee.live/livestream/is_live?channel_claim_id=${encodeURIComponent(cfgClaim)}`;
      const resp = await axios.get(url, { timeout: 5000 });
      const nowLive = !!resp?.data?.data?.Live;
      const viewerCount = typeof resp?.data?.data?.ViewerCount === 'number' ? resp.data.data.ViewerCount : 0;
      const hist = await loadHistoryNS(reqLike);
      const last = hist.segments[hist.segments.length - 1];
      if (nowLive) {
        if (!(last && !last.end)) startSegment(hist, nowTs);
      } else if (last && !last.end) {
        endSegment(hist, nowTs);
      }
      if (!Array.isArray(hist.samples)) hist.samples = [];
      const sample = { ts: nowTs, live: nowLive, viewers: viewerCount };
      try {
        hist.samples.push(sample);
        markSampleAppended(hist, sample);
      } catch {}
      truncateSegments(hist);
      await saveHistoryNS(reqLike, hist, {
        claimId: cfgClaim,
        source: 'poller'
      });
      const successTs = Date.now();
      const entry = bgPollers.get(key);
      if (entry) entry.lastSuccess = successTs;
      recordHealth(key, { ts: successTs, claimId: cfgClaim, live: nowLive, viewers: viewerCount }).catch(() => {});
      try {
        const nsToken = reqLike?.ns?.admin || reqLike?.ns?.pub || null;
        if (options.wss && nsToken) {
          options.wss.broadcast(nsToken, {
            type: 'stream-history-update',
            data: { sampleCount: hist.samples.length, live: nowLive, viewerCount }
          });
        }
      } catch {}
      return { nowLive, viewerCount };
    } catch {
      recordHealth(key, { ts: Date.now(), claimId: cfgClaim, live: false, error: true }).catch(() => {});
      return null;
    }
  }

  async function ensureBackgroundPoller(adminNs, claimId, sourceReq = null) {
    const trimmed = typeof claimId === 'string' ? claimId.trim() : '';
    const key = adminNs ? `ns:${adminNs}` : 'single';
    if (!trimmed) {
      await rememberNamespace(adminNs, '');
      stopBackgroundPoller(key);
      return null;
    }
    const existing = bgPollers.get(key);
    if (existing && existing.claimId === trimmed) return existing;
    stopBackgroundPoller(key);
    const reqLike = sourceReq && sourceReq.ns
      ? {
          ns: { admin: adminNs || null, pub: sourceReq.ns.pub || null },
          query: sourceReq.query || {},
          headers: sourceReq.headers || {},
          __forceWalletHash: sourceReq.__forceWalletHash || adminNs || null
        }
      : makeReqLike(adminNs);
    try {
      const entry = {
        claimId: trimmed,
        timer: null,
        reqLike,
        adminNs: adminNs || null,
        lastSuccess: 0,
        lastAttempt: 0
      };
      const tick = () => {
        entry.lastAttempt = Date.now();
        pollLiveStatus(reqLike, adminNs, trimmed).catch(() => {});
      };
      const timer = setInterval(tick, BACKGROUND_POLL_MS);
      entry.timer = timer;
      bgPollers.set(key, entry);
      await rememberNamespace(adminNs, trimmed);
      tick();
      return entry;
    } catch {
      return null;
    }
  }

  async function bootstrapBackgroundPollers() {
    try {
      const globalReq = makeReqLike(null);
      try {
        const cfg = await loadConfigNS(globalReq);
        const claim = cfg && typeof cfg.claimid === 'string' ? cfg.claimid.trim() : '';
        if (claim) ensureBackgroundPoller(null, claim, globalReq).catch(() => {});
      } catch {}

      const seen = new Set();
      if (!forceFileStore && store && store.redis) {
        try {
          const nsFromSet = await store.redis.smembers(STREAM_HISTORY_NS_SET);
          if (Array.isArray(nsFromSet)) nsFromSet.forEach(ns => { if (ns && ns !== 'local') seen.add(ns); });
        } catch {}
      }
      try {
        const tenantRoot = path.join(process.cwd(), 'tenant');
        if (fs.existsSync(tenantRoot)) {
          const dirs = fs.readdirSync(tenantRoot, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name)
            .slice(0, 500);
          dirs.forEach(ns => { if (ns && ns !== 'local') seen.add(ns); });
        }
      } catch {}

      for (const ns of seen) {
        if (!ns || ns === 'local') continue;
        const reqLike = makeReqLike(ns);
        reqLike.__forceWalletHash = reqLike.__forceWalletHash || ns;
        try {
          const cfg = await loadConfigNS(reqLike);
          const claim = cfg && typeof cfg.claimid === 'string' ? cfg.claimid.trim() : '';
          if (claim) ensureBackgroundPoller(ns, claim, reqLike).catch(() => {});
          else await rememberNamespace(ns, '');
        } catch {}
      }
    } catch {}
  }

  function scheduleBackgroundHealth() {
    if (app.__shHealthScheduled) return;
    app.__shHealthScheduled = true;
    setInterval(() => {
      try {
        const now = Date.now();
        bgPollers.forEach((entry) => {
          if (!entry || !entry.claimId) return;
          const lastOk = entry.lastSuccess || 0;
          if (!lastOk || (now - lastOk) > STALE_THRESHOLD_MS) {
            try {
              const claimPreview = typeof entry.claimId === 'string' ? `${entry.claimId.slice(0, 8)}…` : null;
              console.warn('[stream-history][health] forcing poller refresh', {
                ns: entry.adminNs || 'global',
                claimId: claimPreview,
                staleMs: now - lastOk
              });
            } catch {}
            pollLiveStatus(entry.reqLike, entry.adminNs, entry.claimId, { force: true }).catch(() => {});
          }
        });
        if (!bgPollers.has('single')) {
          const reqLike = makeReqLike(null);
          loadConfigNS(reqLike)
            .then((cfg) => {
              const claim = cfg && typeof cfg.claimid === 'string' ? cfg.claimid.trim() : '';
              if (claim) ensureBackgroundPoller(null, claim, reqLike).catch(() => {});
            })
            .catch(() => {});
        }
        if (!forceFileStore && store && store.redis) {
          store.redis.smembers(STREAM_HISTORY_NS_SET)
            .then((nsList) => {
              if (!Array.isArray(nsList)) return;
              nsList.forEach((ns) => {
                if (!ns || ns === 'local') return;
                const key = `ns:${ns}`;
                if (bgPollers.has(key)) return;
                const reqLike = makeReqLike(ns);
                reqLike.__forceWalletHash = reqLike.__forceWalletHash || ns;
                loadConfigNS(reqLike)
                  .then((cfg) => {
                    const claim = cfg && typeof cfg.claimid === 'string' ? cfg.claimid.trim() : '';
                    if (claim) ensureBackgroundPoller(ns, claim, reqLike).catch(() => {});
                  })
                  .catch(() => {});
              });
            })
            .catch(() => {});
        }
      } catch {}
    }, HEALTH_CHECK_MS);
  }

  app.get('/config/stream-history-config.json', async (req, res) => {
    try {
  let cfg = await loadConfigNS(req);

      if (!cfg.claimid) {
        try {
          const lvPath = path.join(process.cwd(), 'config', 'liveviews-config.json');
          if (fs.existsSync(lvPath)) {
            const lv = JSON.parse(fs.readFileSync(lvPath, 'utf8'));
            if (typeof lv.claimid === 'string') cfg.claimid = lv.claimid;
          }
        } catch {}
      }

      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
      const hostedWithNamespaces = !!(store && store.redis);
      if (hostedWithNamespaces && !hasNs) {
        return res.json({ claimid: '' });
      }
      try {
        const { canReadSensitive } = require('../lib/authz');
        const allowSensitive = canReadSensitive(req);
        if (hostedWithNamespaces && !allowSensitive) {
          return res.json({ claimid: '' });
        }
      } catch {}
      return res.json(cfg);
    } catch { return res.json({ claimid: '' }); }
  });

  app.post('/config/stream-history-config.json', limiter, async (req, res) => {
    try {
      if (((store && store.redis) || requireSessionFlag)) {
        const nsCheck = req?.ns?.admin || req?.ns?.pub || null;
        if (!nsCheck) return res.status(401).json({ error: 'session_required' });
      }
      try {
        const { canWriteConfig } = require('../lib/authz');
        const hosted = !!(store && store.redis);
        if ((hosted || requireSessionFlag) && !canWriteConfig(req)) {
          return res.status(403).json({ error: 'forbidden_untrusted_remote_write' });
        }
      } catch {}
  const body = req.body || {};
  const claimid = (typeof body.claimid === 'string') ? body.claimid : '';
  const cfg = { claimid };
  const adminNsForPoll = await resolveAdminNs(req);
  const ok = await saveConfigNS(req, cfg);
  if (!ok) return res.status(500).json({ error: 'failed_to_save' });
  ensureBackgroundPoller(adminNsForPoll, claimid, req).catch(() => {});
  return res.json({ success: true, config: cfg });
    } catch (e) { return res.status(500).json({ error: 'failed_to_save', details: e?.message }); }
  });

  app.post('/api/stream-history/event', limiter, async (req, res) => {
    try {
      let nsCheck = req?.ns?.admin || req?.ns?.pub || null;
      if (((store && store.redis) || requireSessionFlag) && !nsCheck) {

        try {
          const token = (req.query?.token || '').toString();
          if (token && store) {
            const mapped = await store.get(token, 'adminToken', null);
            nsCheck = mapped ? mapped : token;
          }
        } catch {}
        if (!nsCheck) return res.status(401).json({ error: 'session_required' });
      }
      const live = !!req.body?.live;
      const at = typeof req.body?.at === 'number' ? req.body.at : Date.now();
      const viewers = (() => { const v = Number(req.body?.viewers); return isNaN(v) || v < 0 ? 0 : Math.floor(v); })();
      const hist = await loadHistoryNS(req);
      if (!Array.isArray(hist.samples)) hist.samples = [];
      const last = hist.segments[hist.segments.length - 1];
      const isOpen = last && !last.end;
      if (live) {
        if (!isOpen) startSegment(hist, at);
      } else if (isOpen) {
        endSegment(hist, at);
      }

      const sample = { ts: at, live: !!live, viewers };
      try {
        hist.samples.push(sample);
        markSampleAppended(hist, sample);
      } catch {}
      truncateSegments(hist);
      await saveHistoryNS(req, hist, { source: 'event-api' });
      return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ error: 'failed_to_record', details: e?.message }); }
  });

  app.get('/api/stream-history/summary', async (req, res) => {
    try {
      let period = (req.query?.period || 'day').toString();
      let span = Math.max(1, Math.min(365, parseInt(req.query?.span || '30', 10)));
      let tz = parseInt(req.query?.tz ?? '0', 10); if (isNaN(tz)) tz = 0; tz = Math.max(-840, Math.min(840, tz));
      const startDateRaw = (req.query?.startDate || '').toString().trim();
      const endDateRaw = (req.query?.endDate || '').toString().trim();
      let rangeOverride = null;
      if (startDateRaw && endDateRaw) {
        const startEpochRaw = parseLocalDateYMD(startDateRaw, tz);
        const endEpochRaw = parseLocalDateYMD(endDateRaw, tz);
        if (Number.isFinite(startEpochRaw) && Number.isFinite(endEpochRaw)) {
          let startEpoch = Math.min(startEpochRaw, endEpochRaw);
          let endEpoch = Math.max(startEpochRaw, endEpochRaw) + 86400000 - 1;
          const nowTs = Date.now();
          endEpoch = Math.max(startEpoch, Math.min(endEpoch, nowTs));
          const totalDays = Math.max(1, Math.floor((endEpoch - startEpoch) / 86400000) + 1);
          if (totalDays <= 120) {
            period = 'day';
            span = Math.min(365, totalDays);
          } else {
            period = 'week';
            span = Math.min(365, Math.ceil(totalDays / 7));
          }
          rangeOverride = {
            startEpoch,
            endEpoch,
            startDate: formatLocalDateYMD(startEpoch, tz),
            endDate: formatLocalDateYMD(endEpoch, tz),
          };
        }
      }
      const hist = await loadHistoryNS(req);
      const options = rangeOverride ? { windowEndEpoch: rangeOverride.endEpoch } : {};
      const data = aggregate(hist, period, span, tz, options);
      const appliedRange = rangeOverride
        ? {
            startDate: rangeOverride.startDate,
            endDate: rangeOverride.endDate,
            startEpoch: rangeOverride.startEpoch,
            endEpoch: rangeOverride.endEpoch,
          }
        : null;
      return res.json({ period, span, tzOffsetMinutes: tz, data, appliedRange });
    } catch (e) { return res.status(500).json({ error: 'failed_to_summarize', details: e?.message }); }
  });

  app.get('/api/stream-history/performance', async (req, res) => {
    try {
      let period = (req.query?.period || 'day').toString();
      let span = Math.max(1, Math.min(365, parseInt(req.query?.span || '30', 10)));
      let tz = parseInt(req.query?.tz ?? '0', 10); if (isNaN(tz)) tz = 0; tz = Math.max(-840, Math.min(840, tz));
      const startDateRaw = (req.query?.startDate || '').toString().trim();
      const endDateRaw = (req.query?.endDate || '').toString().trim();
      let rangeOverride = null;
      if (startDateRaw && endDateRaw) {
        const startEpochRaw = parseLocalDateYMD(startDateRaw, tz);
        const endEpochRaw = parseLocalDateYMD(endDateRaw, tz);
        if (Number.isFinite(startEpochRaw) && Number.isFinite(endEpochRaw)) {
          let startEpoch = Math.min(startEpochRaw, endEpochRaw);
          let endEpoch = Math.max(startEpochRaw, endEpochRaw) + 86400000 - 1;
          const nowTs = Date.now();
          endEpoch = Math.max(startEpoch, Math.min(endEpoch, nowTs));
          const totalDays = Math.max(1, Math.floor((endEpoch - startEpoch) / 86400000) + 1);
          if (totalDays <= 120) {
            period = 'day';
            span = Math.min(365, totalDays);
          } else {
            period = 'week';
            span = Math.min(365, Math.ceil(totalDays / 7));
          }
          rangeOverride = {
            startEpoch,
            endEpoch,
            startDate: formatLocalDateYMD(startEpoch, tz),
            endDate: formatLocalDateYMD(endEpoch, tz),
          };
        }
      }
      const hist = await loadHistoryNS(req);
      const options = rangeOverride ? { windowEndEpoch: rangeOverride.endEpoch } : {};
      const perf = computePerformance(hist, period, span, tz, options);
      const appliedRange = rangeOverride
        ? {
            startDate: rangeOverride.startDate,
            endDate: rangeOverride.endDate,
            startEpoch: rangeOverride.startEpoch,
            endEpoch: rangeOverride.endEpoch,
          }
        : null;
      return res.json({ period, span, tzOffsetMinutes: tz, appliedRange, ...perf });
    } catch (e) { return res.status(500).json({ error: 'failed_to_compute_performance', details: e?.message }); }
  });

  app.post('/api/stream-history/backfill-current', limiter, async (req, res) => {
    try {
      let nsCheck = req?.ns?.admin || req?.ns?.pub || null;
      if (((store && store.redis) || requireSessionFlag) && !nsCheck) {

        try {
          const token = (req.query?.token || '').toString();
          if (token && store) {
            const mapped = await store.get(token, 'adminToken', null);
            nsCheck = mapped ? mapped : token;
          }
        } catch {}
        if (!nsCheck) return res.status(401).json({ error: 'session_required' });
      }
      const hours = Math.max(1, Math.min(24 * 30, parseInt(req.body?.hours || '0', 10)));

  const hist = await loadHistoryNS(req);
      let last = hist.segments && hist.segments[hist.segments.length - 1];
      if (!last || last.end) {

        try {
          const samples = Array.isArray(hist.samples) ? hist.samples : [];
          const ls = samples.length ? samples[samples.length - 1] : null;
          const lastTs = ls ? Number(ls.ts || 0) : 0;
          const FRESH_MS = 150000;
          const isFreshLive = !!(ls && ls.live && lastTs > 0 && (Date.now() - lastTs) <= FRESH_MS);
          if (isFreshLive) {
            startSegment(hist, Date.now());
            last = hist.segments[hist.segments.length - 1];
          }
        } catch {}
      }
      if (!last || last.end) return res.status(400).json({ error: 'no_open_segment' });
      const targetStart = Date.now() - hours * 3600000;
      if (typeof last.start !== 'number' || isNaN(last.start)) last.start = Date.now();
      const prevStart = last.start;
      last.start = Math.min(last.start, targetStart);
      if (last.start !== prevStart) markSegmentsDirty(hist);
    truncateSegments(hist);
  await saveHistoryNS(req, hist, { source: 'backfill' });
      return res.json({ ok: true, start: last.start });
    } catch (e) {
      return res.status(500).json({ error: 'failed_to_backfill', details: e?.message });
    }
  });

  app.post('/api/stream-history/clear', limiter, async (req, res) => {
    try {
      let nsCheck = req?.ns?.admin || req?.ns?.pub || null;
      if (((store && store.redis) || requireSessionFlag) && !nsCheck) {
        try {
          const token = (req.query?.token || '').toString();
          if (token && store) {
            const mapped = await store.get(token, 'adminToken', null);
            nsCheck = mapped ? mapped : token;
          }
        } catch {}
        if (!nsCheck) return res.status(401).json({ error: 'session_required' });
      }
  const empty = { segments: [], samples: [] };
  markReplaceAll(empty);
  await saveHistoryNS(req, empty, { source: 'clear' });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'failed_to_clear', details: e?.message });
    }
  });

  app.get('/api/stream-history/export', async (req, res) => {
    try {
  const hist = await loadHistoryNS(req);
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(JSON.stringify(hist, null, 2));
    } catch (e) {
      return res.status(500).json({ error: 'failed_to_export', details: e?.message });
    }
  });

  app.post('/api/stream-history/import', limiter, async (req, res) => {
    try {
      let nsCheck = req?.ns?.admin || req?.ns?.pub || null;
      if (((store && store.redis) || requireSessionFlag) && !nsCheck) {
        try {
          const token = (req.query?.token || '').toString();
          if (token && store) {
            const mapped = await store.get(token, 'adminToken', null);
            nsCheck = mapped ? mapped : token;
          }
        } catch {}
        if (!nsCheck) return res.status(401).json({ error: 'session_required' });
      }
      const incoming = req.body || {};
      if (!incoming || typeof incoming !== 'object') return res.status(400).json({ error: 'invalid_payload' });
      const segments = Array.isArray(incoming.segments) ? incoming.segments : [];
      const samples = Array.isArray(incoming.samples) ? incoming.samples : [];

      const safeSegments = segments
        .map(s => ({ start: Number(s.start), end: (s.end == null ? null : Number(s.end)) }))
        .filter(s => !isNaN(s.start) && (s.end == null || (!isNaN(s.end) && s.end >= s.start)));
      const safeSamples = samples
        .map(s => ({ ts: Number(s.ts), live: !!s.live, viewers: Math.max(0, Number(s.viewers || 0)) }))
        .filter(s => !isNaN(s.ts));
      const data = { segments: safeSegments, samples: safeSamples };
      const hadSegments = data.segments.length;
      const hadSamples = data.samples.length;
      truncateSegments(data);
      if (!data.segments.length && hadSegments) data.segments = safeSegments;
      if (!data.samples.length && hadSamples) data.samples = safeSamples;
      markReplaceAll(data);
  await saveHistoryNS(req, data, { source: 'import-api' });
      return res.json({ ok: true, segments: data.segments.length, samples: data.samples.length });
    } catch (e) {
      return res.status(500).json({ error: 'failed_to_import', details: e?.message });
    }
  });

  app.get('/api/stream-history/status', async (req, res) => {
    try {
      let cfg = await loadConfigNS(req);
      if (!cfg.claimid) {
        try {
          const lvPath = path.join(process.cwd(), 'config', 'liveviews-config.json');
          if (fs.existsSync(lvPath)) {
            const lv = JSON.parse(fs.readFileSync(lvPath, 'utf8'));
            if (typeof lv.claimid === 'string') cfg.claimid = lv.claimid;
          }
        } catch {}
      }

      let adminNs = null;
      try { adminNs = await resolveAdminNs(req); } catch {}
      try { await pollLiveStatus(req, adminNs, cfg.claimid); } catch {}
      ensureBackgroundPoller(adminNs, cfg.claimid, req).catch(() => {});

  const hist = await loadHistoryNS(req);
      const samples = Array.isArray(hist.samples) ? hist.samples : [];
      const lastSample = samples.length ? samples[samples.length - 1] : null;
      const lastTs = lastSample ? Number(lastSample.ts || 0) : 0;
      let avgSampleIntervalSec = null;
      let latestSampleIntervalSec = null;
      try {
        if (samples.length >= 2) {
          const consider = samples.slice(-200);
          const deltas = [];
          for (let i = 1; i < consider.length; i++) {
            const prevTs = Number(consider[i - 1]?.ts || 0);
            const curTs = Number(consider[i]?.ts || 0);
            if (!isFinite(prevTs) || !isFinite(curTs)) continue;
            const diff = curTs - prevTs;
            if (diff > 0 && diff < 3600000) deltas.push(diff);
          }
          if (deltas.length) {
            const avgMs = deltas.reduce((acc, ms) => acc + ms, 0) / deltas.length;
            avgSampleIntervalSec = Math.round((avgMs / 1000) * 10) / 10;
            const lastDiff = deltas[deltas.length - 1];
            latestSampleIntervalSec = Math.round((lastDiff / 1000) * 10) / 10;
          }
        }
      } catch {}
      const now = Date.now();
      const FRESH_MS = 150000;
      const hasClaim = !!(cfg.claimid && String(cfg.claimid).trim());
      const connected = hasClaim && lastTs > 0 && (now - lastTs) <= FRESH_MS;

      try {
        const seg = hist.segments && hist.segments[hist.segments.length - 1];
        if (seg && !seg.end && !connected) {
          const closeAt = lastTs > 0 ? lastTs : (now - FRESH_MS);
          if (typeof seg.start === 'number' && closeAt >= seg.start) {
            seg.end = closeAt;
            markSegmentsDirty(hist);
            await saveHistoryNS(req, hist, {
              claimId: cfg.claimid,
              source: 'status-auto-close'
            });
          }
        }
      } catch {}

      let live = false;
      try {
        const seg = hist.segments && hist.segments[hist.segments.length - 1];
        live = (!!seg && !seg.end) || (!!lastSample && !!lastSample.live);
      } catch {}
      const reason = hasClaim ? (connected ? 'ok' : 'stale') : 'no_claimid';
      const sampleCount = Array.isArray(hist.samples) ? hist.samples.length : 0;
      return res.json({
        connected,
        live,
        lastSampleTs: lastTs || null,
        reason,
        sampleCount,
        avgSampleIntervalSec,
        latestSampleIntervalSec,
      });
    } catch (e) {
      return res.status(500).json({ error: 'failed_to_compute_status', details: e?.message });
    }
  });

  if (!app.__shBootstrapScheduled) {
    app.__shBootstrapScheduled = true;
    setTimeout(() => {
      bootstrapBackgroundPollers().catch(() => {});
      scheduleBackgroundHealth();
    }, 2500);
  } else {
    scheduleBackgroundHealth();
  }
}

module.exports = registerStreamHistoryRoutes;
module.exports._testHooks = { aggregate, aggregateDailyBuckets };

