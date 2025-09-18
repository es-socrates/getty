const fs = require('fs');
const path = require('path');
const { z } = require('zod');

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
  const CONFIG_FILE = path.join(process.cwd(), 'config', 'tip-notification-config.json');

  function loadConfig() {
    const base = readJsonSafe(CONFIG_FILE, {});
    const cfg = { ...DEFAULTS, ...base };
    return cfg;
  }

  function saveConfig(nextCfg) {
    const prev = readJsonSafe(CONFIG_FILE, {});
    const merged = { ...prev, ...nextCfg };
    writeJsonSafe(CONFIG_FILE, merged);
    return merged;
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
      if ((requireSessionFlag || hosted) && !hasNs) {
        return res.json({ success: true, ...DEFAULTS });
      }
      if (store && hasNs) {
        const ns = req.ns.admin || req.ns.pub;
        (async () => {
          try {
            const st = await store.get(ns, 'tip-notification-config', null);
            const merged = { ...DEFAULTS, ...(st || {}) };
            return res.json({ success: true, ...merged });
          } catch {
            const cfg = loadConfig();
            return res.json({ success: true, ...cfg });
          }
        })();
        return;
      }
      const cfg = loadConfig();
      res.json({ success: true, ...cfg });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/tip-notification', strictLimiter, (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
      if ((requireSessionFlag || hosted) && !hasNs) {
        return res.status(401).json({ error: 'no_session' });
      }
      const parsed = colorSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid colors' });
      }
      const ns = req.ns?.admin || req.ns?.pub || null;
      const doRespond = (data) => res.json({ success: true, ...data });
      const doBroadcast = (data) => {
        try {
          if (typeof wss?.broadcast === 'function' && ns) {
            wss.broadcast(ns, { type: 'tipNotificationConfigUpdate', data });
          } else {
            broadcastUpdate(data);
          }
        } catch {}
      };
      if (store && ns) {
        (async () => {
          try {
            const current = await store.get(ns, 'tip-notification-config', {});
            const merged = { ...(current || {}), ...parsed.data };
            await store.set(ns, 'tip-notification-config', merged);
            doBroadcast(merged);
            doRespond(merged);
          } catch {
            const saved = saveConfig(parsed.data);
            doBroadcast(saved);
            doRespond(saved);
          }
        })();
      } else {
        const saved = saveConfig(parsed.data);
        doBroadcast(saved);
        doRespond(saved);
      }
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
};
