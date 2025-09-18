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

module.exports = function registerTipNotificationRoutes(app, strictLimiter, { wss } = {}) {
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
      const saved = saveConfig(parsed.data);
      broadcastUpdate(saved);
      res.json({ success: true, ...saved });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
};
