const fs = require('fs');
const path = require('path');
const axios = require('axios');

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
}

function endSegment(hist, ts) {
  const last = hist.segments[hist.segments.length - 1];
  if (last && !last.end) last.end = ts;
}

function truncateSegments(hist, maxDays = 400) {
  try {
    const cutoff = Date.now() - maxDays * 86400000;
    hist.segments = hist.segments.filter(s => (s.end || s.start) >= cutoff);
    if (Array.isArray(hist.samples)) {
      hist.samples = hist.samples.filter(s => s.ts >= cutoff);

      if (hist.samples.length > 200000) hist.samples.splice(0, hist.samples.length - 200000);
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
      }
      return;
    }
    const age = nowTs - lastSampleTs;
    const staleLimit = Math.max(freshMs, 90 * 60000);
    if (age > staleLimit) {
      if (lastSampleTs >= lastSeg.start) lastSeg.end = lastSampleTs;
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

function aggregate(hist, period = 'day', span = 30, tzOffsetMinutes = 0) {
  const offset = tzOffsetMinutes || 0;
  const nowTs = Date.now();
  const todayStart = dayStartUTC(nowTs, offset);
  if (period === 'day') {
    const buckets = [];
    const fmtYMD = (dayStart) => {
      const dLocal = new Date(dayStart + offset * 60000);
      const y = dLocal.getFullYear();
      const m = String(dLocal.getMonth() + 1).padStart(2, '0');
      const dd = String(dLocal.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    for (let i = span - 1; i >= 0; i--) {
      const dayStart = todayStart - i * 86400000;
      buckets.push({ key: dayStart, label: fmtYMD(dayStart), ms: 0, vsec: 0, lsec: 0 });
    }
    const bmap = new Map(buckets.map(b => [b.key, b]));
    const rangeStart = buckets[0]?.key ?? todayStart;
    const rangeEnd = (buckets[buckets.length - 1]?.key ?? todayStart) + 86400000;

    const segments = sanitizeSegments(hist.segments, nowTs);
    const samples = sortSamples(hist.samples);
    const liveIntervals = buildLiveIntervals(samples, nowTs);
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
        const nextTs = Number(next ? next.ts : nowTs);
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
    }));
  }

  const dailySpan = span * (period === 'week' ? 7 : period === 'month' ? 30 : 365);
  const daily = aggregate(hist, 'day', dailySpan, offset);

  const map = new Map();
  function localDateFromEpoch(epoch) { return new Date(epoch + offset * 60000); }
  for (const item of daily) {
    const dLocal = localDateFromEpoch(item.epoch);
    let keyEpoch;
    let label;
    if (period === 'week') {
      // Monday start (ISO) in user local time
      const dow = (dLocal.getDay() + 6) % 7; // 0=Mon
      const weekStartLocal = new Date(dLocal.getFullYear(), dLocal.getMonth(), dLocal.getDate() - dow).getTime();
      keyEpoch = weekStartLocal - offset * 60000; // store UTC epoch representing that local midnight
      const wd = new Date(weekStartLocal); // local timeline date object
      const y = wd.getFullYear(); const m = String(wd.getMonth() + 1).padStart(2, '0'); const dd = String(wd.getDate()).padStart(2, '0');
      label = `${y}-${m}-${dd}`; // week start label
    } else if (period === 'month') {
      const monthStartLocal = new Date(dLocal.getFullYear(), dLocal.getMonth(), 1).getTime();
      keyEpoch = monthStartLocal - offset * 60000;
      const ms = new Date(monthStartLocal);
      const y = ms.getFullYear(); const m = String(ms.getMonth() + 1).padStart(2, '0');
      label = `${y}-${m}`;
    } else { // year
      const yearStartLocal = new Date(dLocal.getFullYear(), 0, 1).getTime();
      keyEpoch = yearStartLocal - offset * 60000;
      const ys = new Date(yearStartLocal);
      label = `${ys.getFullYear()}`;
    }
    const cur = map.get(keyEpoch) || { hours: 0, vsec: 0, lsec: 0, label, epoch: keyEpoch };
    cur.hours += Number(item.hours || 0);
    const inferredLsec = Math.max(0, Number(item.hours || 0)) * 3600;
    if (inferredLsec > 0 && isFinite(Number(item.avgViewers || 0))) {
      cur.vsec += Number(item.avgViewers) * inferredLsec;
      cur.lsec += inferredLsec;
    }
    map.set(keyEpoch, cur);
  }
  const arr = Array.from(map.values()).map(v => ({
    date: v.label,
    epoch: v.epoch,
    tzOffsetMinutes: offset,
    hours: +Number(v.hours || 0).toFixed(2),
    avgViewers: v.lsec > 0 ? +Number(v.vsec / v.lsec).toFixed(2) : 0,
  }));
  arr.sort((a, b) => a.epoch - b.epoch);
  return arr.slice(-span);
}

function rangeWindow(period = 'day', span = 30, tzOffsetMinutes = 0) {
  const offset = tzOffsetMinutes || 0;
  const nowTs = Date.now();
  const todayStart = dayStartUTC(nowTs, offset);
  const days = period === 'day' ? span : (period === 'week' ? span * 7 : (period === 'month' ? span * 30 : span * 365));
  const start = todayStart - (days - 1) * 86400000;
  const end = todayStart + 86400000;
  return { start, end };
}

function computePerformance(hist, period = 'day', span = 30, tzOffsetMinutes = 0) {
  const { start, end } = rangeWindow(period, span, tzOffsetMinutes);
  const nowTs = Date.now();

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

  const daily = aggregate(hist, 'day', Math.round((end - start) / 86400000), tzOffsetMinutes);
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
    tzOffsetMinutes
  };
}

function registerStreamHistoryRoutes(app, limiter, options = {}) {
  const store = options.store || null;
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const CONFIG_FILE = path.join(process.cwd(), 'config', 'stream-history-config.json');
  const DATA_DIR = path.join(process.cwd(), 'data');
  const DATA_FILE = path.join(DATA_DIR, 'stream-history.json');
  ensureDir(path.join(process.cwd(), 'config'));
  ensureDir(DATA_DIR);

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
        const wrapped = await loadTenantConfig(req, store, CONFIG_FILE, 'stream-history-config.json');
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
    if (saveTenantConfig) {
      try {
        await saveTenantConfig(req, store, CONFIG_FILE, 'stream-history-config.json', { claimid });
        return true;
      } catch {}
    }
    const adminNs = await resolveAdminNs(req);
    if (store && adminNs) {
      try { await store.set(adminNs, 'stream-history-config', { claimid }); return true; } catch { return false; }
    }
    try { fs.writeFileSync(CONFIG_FILE, JSON.stringify({ claimid }, null, 2)); return true; } catch { return false; }
  }

  async function loadHistoryNS(req) {
    const adminNs = await resolveAdminNs(req);
    if (store && adminNs) {
      try {
        const j = await store.get(adminNs, 'stream-history-data', null);
        const hist = j && typeof j === 'object' ? j : { segments: [], samples: [] };
        if (!Array.isArray(hist.segments)) hist.segments = [];
        if (!Array.isArray(hist.samples)) hist.samples = [];

        closeStaleOpenSegment(hist);
        return hist;
      } catch { return { segments: [], samples: [] }; }
    }
    const fileHist = loadHistoryFromFile(DATA_FILE);
    closeStaleOpenSegment(fileHist);
    return fileHist;
  }

  async function saveHistoryNS(req, data) {
    const adminNs = await resolveAdminNs(req);
    if (store && adminNs) {
      try { await store.set(adminNs, 'stream-history-data', data); return true; } catch { return false; }
    }
    try { saveHistoryToFile(DATA_FILE, data); return true; } catch { return false; }
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
  const ok = await saveConfigNS(req, cfg);
  if (!ok) return res.status(500).json({ error: 'failed_to_save' });
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
      } else {
        if (isOpen) endSegment(hist, at);
      }

  try { hist.samples.push({ ts: at, live: !!live, viewers }); } catch {}
      truncateSegments(hist);
  await saveHistoryNS(req, hist);
      return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ error: 'failed_to_record', details: e?.message }); }
  });

  app.get('/api/stream-history/summary', async (req, res) => {
    try {
      const period = (req.query?.period || 'day').toString();
      const span = Math.max(1, Math.min(365, parseInt(req.query?.span || '30', 10)));
      let tz = parseInt(req.query?.tz ?? '0', 10); if (isNaN(tz)) tz = 0; tz = Math.max(-840, Math.min(840, tz));
      const hist = await loadHistoryNS(req);
      const data = aggregate(hist, period, span, tz);
      return res.json({ period, span, tzOffsetMinutes: tz, data });
    } catch (e) { return res.status(500).json({ error: 'failed_to_summarize', details: e?.message }); }
  });

  app.get('/api/stream-history/performance', async (req, res) => {
    try {
      const period = (req.query?.period || 'day').toString();
      const span = Math.max(1, Math.min(365, parseInt(req.query?.span || '30', 10)));
      let tz = parseInt(req.query?.tz ?? '0', 10); if (isNaN(tz)) tz = 0; tz = Math.max(-840, Math.min(840, tz));
      const hist = await loadHistoryNS(req);
      const perf = computePerformance(hist, period, span, tz);
      return res.json({ period, span, tzOffsetMinutes: tz, ...perf });
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
      last.start = Math.min(last.start, targetStart);
      truncateSegments(hist);
  await saveHistoryNS(req, hist);
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
  await saveHistoryNS(req, empty);
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
      truncateSegments(data);
      await saveHistoryNS(req, data);
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

      try {
        const adminNs = await resolveAdminNs(req);
        const throttleKey = adminNs ? `ns:${adminNs}` : 'single';
        const nowTs = Date.now();
        const lastTs = (app.__shLastFetch && app.__shLastFetch[throttleKey]) || 0;
        if (!app.__shLastFetch) app.__shLastFetch = {};
        const POLL_EVERY_MS = 15000;
        if (cfg.claimid && (nowTs - lastTs) >= POLL_EVERY_MS) {
          app.__shLastFetch[throttleKey] = nowTs;
          const url = `https://api.odysee.live/livestream/is_live?channel_claim_id=${encodeURIComponent(cfg.claimid)}`;
          const resp = await axios.get(url, { timeout: 5000 });
          const nowLive = !!resp?.data?.data?.Live;
          const viewerCount = typeof resp?.data?.data?.ViewerCount === 'number' ? resp.data.data.ViewerCount : 0;
          const hist = await loadHistoryNS(req);
          const last = hist.segments[hist.segments.length - 1];
          if (nowLive) { if (!(last && !last.end)) startSegment(hist, nowTs); }
          else { if (last && !last.end) endSegment(hist, nowTs); }
          if (!Array.isArray(hist.samples)) hist.samples = [];
          try { hist.samples.push({ ts: nowTs, live: nowLive, viewers: viewerCount }); } catch {}
          truncateSegments(hist);
          await saveHistoryNS(req, hist);
        }
      } catch {}

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
            await saveHistoryNS(req, hist);
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
}

module.exports = registerStreamHistoryRoutes;

