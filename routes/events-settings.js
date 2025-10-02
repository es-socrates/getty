const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { loadTenantConfig, saveTenantConfig } = require('../lib/tenant-config');

function readJsonSafe(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJsonSafe(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const eventsSettingsSchema = z.object({
  eventCount: z.number().min(0).max(10).optional(),
  enabledActivities: z.array(z.string()).optional(),
  theme: z.object({
    bgColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
    textColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
    accentColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  }).optional(),
  animation: z.string().optional(),
}).strict();

const DEFAULTS = {
  eventCount: 6,
  enabledActivities: ['last-tip', 'last-achievement'],
  theme: {
    bgColor: '#080c10',
    textColor: '#ffffff',
    accentColor: '#00ff7f',
  },
  animation: 'fadeIn',
};

module.exports = function registerEventsSettingsRoutes(app, strictLimiter, { store } = {}) {
  const { isOpenTestMode } = require('../lib/test-open-mode');
  const CONFIG_FILENAME = 'events-settings.json';
  const CONFIG_FILE = path.join(process.cwd(), 'config', CONFIG_FILENAME);

  function normalize(raw) {
    const base = raw && typeof raw === 'object' ? raw : {};
    return {
      eventCount: typeof base.eventCount === 'number' ? base.eventCount : DEFAULTS.eventCount,
      enabledActivities: Array.isArray(base.enabledActivities) ? base.enabledActivities : DEFAULTS.enabledActivities,
      theme: { ...DEFAULTS.theme, ...(base.theme || {}) },
      animation: typeof base.animation === 'string' ? base.animation : DEFAULTS.animation,
    };
  }

  app.get('/api/events-settings', (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
      if (!isOpenTestMode() && (requireSessionFlag || hosted) && !hasNs) {
        return res.json({ success: true, ...DEFAULTS });
      }
      (async () => {
        try {
          if (store && hasNs) {
            try {
              const ns = req.ns.admin || req.ns.pub;
              const st = await store.get(ns, 'events-settings', null);
              if (st) return res.json({ success: true, ...normalize(st) });
            } catch { /* fallthrough to disk */ }
          }
          const loaded = await loadTenantConfig(req, store, CONFIG_FILE, CONFIG_FILENAME);
          const data = loaded.data?.data ? loaded.data.data : loaded.data;
          const meta = loaded.data && (loaded.data.__version || loaded.data.checksum) ? {
            __version: loaded.data.__version,
            checksum: loaded.data.checksum,
            updatedAt: loaded.data.updatedAt
          } : null;
          const cfg = normalize(data);
          return res.json(meta ? { success: true, meta, ...cfg } : { success: true, ...cfg });
        } catch {
          return res.json({ success: true, ...DEFAULTS });
        }
      })();
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/events-settings', strictLimiter, (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
      if (!isOpenTestMode() && (requireSessionFlag || hosted) && !hasNs) {
        return res.status(401).json({ error: 'no_session' });
      }
      const parsed = eventsSettingsSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid settings' });
      }
      const ns = req.ns?.admin || req.ns?.pub || null;
      (async () => {
        try {
          if (store && ns) {
            try {
              const current = await store.get(ns, 'events-settings', {});
              const merged = { ...current, ...parsed.data };
              await store.set(ns, 'events-settings', merged);

              const saveRes = await saveTenantConfig(req, store, CONFIG_FILE, CONFIG_FILENAME, merged);
              return res.json({ success: true, meta: saveRes.meta, ...normalize(merged) });
            } catch {/* fallthrough to disk only */}
          }
          const merged = { ...parsed.data };
          const saveRes = await saveTenantConfig(req, store, CONFIG_FILE, CONFIG_FILENAME, merged);
          const norm = normalize(merged);
          return res.json({ success: true, meta: saveRes.meta, ...norm });
        } catch {
          try {
            const prev = readJsonSafe(CONFIG_FILE, {});
            const legacyMerged = { ...prev, ...parsed.data };
            writeJsonSafe(CONFIG_FILE, legacyMerged);
            const norm = normalize(legacyMerged);
            return res.json({ success: true, ...norm });
          } catch {}
          return res.status(500).json({ error: 'Internal server error' });
        }
      })();
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
};