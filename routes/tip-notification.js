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

const colorSchema = z.object({
  bgColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  fontColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  borderColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  amountColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  fromColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
}).strict();

const DEFAULTS = {
  bgColor: '#080c10',
  fontColor: '#ffffff',
  borderColor: '#00ff7f',
  amountColor: '#00ff7f',
  fromColor: '#ffffff'
};

module.exports = function registerTipNotificationRoutes(app, strictLimiter, { wss, store } = {}) {
  const { isOpenTestMode } = require('../lib/test-open-mode');
  const CONFIG_FILENAME = 'tip-notification-config.json';
  const CONFIG_FILE = path.join(process.cwd(), 'config', CONFIG_FILENAME);

  function normalize(raw) {
    const base = raw && typeof raw === 'object' ? raw : {};
    return { ...DEFAULTS, ...base };
  }

  function broadcastUpdate(cfg) {
    try {
      if (!wss || !wss.clients) return;
      const payload = JSON.stringify({ type: 'tipNotificationConfigUpdate', data: cfg });

      wss.clients.forEach(c => {
        const open = c.readyState === (c.OPEN || 1);
        if (open) c.send(payload);
      });
    } catch {}
  }

  app.get('/api/tip-notification', (req, res) => {
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
              const st = await store.get(ns, 'tip-notification-config', null);
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

  app.post('/api/tip-notification', strictLimiter, (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
      if (!isOpenTestMode() && (requireSessionFlag || hosted) && !hasNs) {
        return res.status(401).json({ error: 'no_session' });
      }
      const parsed = colorSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid colors' });
      }
      const ns = req.ns?.admin || req.ns?.pub || null;
      const doBroadcast = (data, meta) => {
        try {
          const payloadData = { ...data, ...(meta ? { meta } : {}) };
          if (typeof wss?.broadcast === 'function' && ns) {
            wss.broadcast(ns, { type: 'tipNotificationConfigUpdate', data: payloadData });
          } else {
            broadcastUpdate(payloadData);
          }
        } catch {}
      };
      (async () => {
        try {
          if (store && ns) {
            try {
              const current = await store.get(ns, 'tip-notification-config', {});
              const merged = { ...(current || {}), ...parsed.data };
              await store.set(ns, 'tip-notification-config', merged);

              const saveRes = await saveTenantConfig(req, store, CONFIG_FILE, CONFIG_FILENAME, merged);
              doBroadcast(merged, saveRes.meta);
              return res.json({ success: true, meta: saveRes.meta, ...normalize(merged) });
            } catch {/* fallthrough to disk only */}
          }
          const merged = { ...parsed.data };
          const saveRes = await saveTenantConfig(req, store, CONFIG_FILE, CONFIG_FILENAME, merged);
          const norm = normalize(merged);
          doBroadcast(norm, saveRes.meta);
          return res.json({ success: true, meta: saveRes.meta, ...norm });
  } catch {
          try {
            const prev = readJsonSafe(CONFIG_FILE, {});
            const legacyMerged = { ...prev, ...parsed.data };
            writeJsonSafe(CONFIG_FILE, legacyMerged);
            const norm = normalize(legacyMerged);
            doBroadcast(norm, null);
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
