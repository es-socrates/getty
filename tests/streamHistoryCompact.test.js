const path = require('path');

const routesPath = path.join(__dirname, '..', 'routes', 'stream-history.js');
const {_compactSamples} = require(routesPath);

function computeDayMetrics(segments, samples, tzOffsetMinutes = 0) {
  function dayStart(ts) {
    const offsetMs = tzOffsetMinutes * 60000;
    return Math.floor((ts + offsetMs) / 86400000) * 86400000 - offsetMs;
  }
  function splitSpan(start, end) {
    const parts = [];
    let s = start;
    while (s < end) {
      const ds = dayStart(s);
      const next = ds + 86400000;
      const e = Math.min(end, next);
      parts.push({day: ds, ms: e - s});
      s = e;
    }
    return parts;
  }
  const buckets = new Map();
  function ensure(day){ if(!buckets.has(day)) buckets.set(day, {ms:0,vsec:0,lsec:0}); return buckets.get(day); }

  for (const seg of segments) {
    if(!seg || typeof seg.start !== 'number') continue;
    const s = seg.start; const e = typeof seg.end === 'number' ? seg.end : s; if (e<=s) continue;
    for (const part of splitSpan(s,e)) ensure(part.day).ms += part.ms;
  }

  const sorted = [...samples].sort((a,b)=>a.ts-b.ts);
  for (let i=0;i<sorted.length;i++) {
    const cur = sorted[i]; const next = sorted[i+1] || null;
    if(!cur || typeof cur.ts !== 'number') continue;
    const t0 = cur.ts; const t1 = next ? next.ts : t0; if (t1<=t0) continue;
    if (cur.live) {
      const v = Math.max(0, Number(cur.viewers||0));
      for (const part of splitSpan(t0,t1)) {
        const b = ensure(part.day);
        const sec = part.ms / 1000;
        b.vsec += v * sec; b.lsec += sec;
      }
    }
  }
  return Array.from(buckets.entries()).map(([day,b])=>({
    day,
    hours: +(b.ms/3600000).toFixed(4),
    avgViewers: b.lsec>0 ? +(b.vsec/b.lsec).toFixed(4) : 0
  })).sort((a,b)=>a.day-b.day);
}

function cloneHist(h){ return JSON.parse(JSON.stringify(h)); }

describe('stream-history compactSamples', () => {
  test('reduces sample count while preserving hours & avg viewers', () => {
    const baseTs = Date.now() - 3*3600000;
    const segments = [ { start: baseTs + 5*60000, end: baseTs + 85*60000 } ];
    const samples = [];
    for (let m=0;m<5;m++) samples.push({ ts: baseTs + m*60000, live:false, viewers:0 });
    for (let m=5;m<=85;m++) {
      const live = true;
      let viewers = 2;
      if (m>=36 && m<80) viewers = 4; else if (m>=80) viewers = 3;
      samples.push({ ts: baseTs + m*60000, live, viewers });
    }

    samples.push({ ts: segments[0].end + 1000, live:false, viewers:0 });

    const hist = { segments: cloneHist(segments), samples: cloneHist(samples) };
    const beforeCount = hist.samples.length;

    const beforeMetrics = computeDayMetrics(hist.segments, hist.samples);
    const result = _compactSamples(hist, { maxIntervalMs: 10*60000 });

    expect(result.before).toBe(beforeCount);
    expect(result.after).toBeLessThan(beforeCount);
    expect(hist.samples.length).toBe(result.after);

    const afterMetrics = computeDayMetrics(hist.segments, hist.samples);
    expect(afterMetrics.length).toBe(beforeMetrics.length);
    for (let i=0;i<beforeMetrics.length;i++) {
      expect(afterMetrics[i].hours).toBeCloseTo(beforeMetrics[i].hours, 3);
      expect(afterMetrics[i].avgViewers).toBeCloseTo(beforeMetrics[i].avgViewers, 3);
    }
  });

  test('inserts synthetic offline at segment end when needed', () => {
    const baseTs = Date.now() - 2*3600000;
    const segments = [{ start: baseTs, end: baseTs + 3600000 }];
    const samples = [
      { ts: baseTs, live:true, viewers:5 },
      { ts: baseTs + 1800000, live:true, viewers:5 },
    ];
    const hist = { segments: cloneHist(segments), samples: cloneHist(samples) };
    const res = _compactSamples(hist, { maxIntervalMs: 20*60000 });
    expect(res.after).toBeGreaterThan(res.before - 1);
    const lastSample = hist.samples[hist.samples.length -1];
    expect(lastSample.live).toBe(false);
    expect(lastSample.ts).toBe(segments[0].end);
  });
});
