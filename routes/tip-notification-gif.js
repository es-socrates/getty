const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { z } = require('zod');
const { isTrustedLocalAdmin, shouldMaskSensitive } = require('../lib/trust');
const { isOpenTestMode } = require('../lib/test-open-mode');

function readGifDimensions(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(10);
    fs.readSync(fd, header, 0, 10, 0);
    const signature = header.toString('ascii', 0, 6);
    if (signature !== 'GIF87a' && signature !== 'GIF89a') {
      throw new Error('Invalid GIF signature');
    }
    const width = header.readUInt16LE(6);
    const height = header.readUInt16LE(8);
    return { width, height };
  } finally {
    fs.closeSync(fd);
  }
}

function registerTipNotificationGifRoutes(app, strictLimiter, { store } = {}) {
  const CONFIG_FILE = path.join(process.cwd(), 'config', 'tip-notification-config.json');
  const BASE_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'notification-gif');

  if (!fs.existsSync(BASE_UPLOAD_DIR)) fs.mkdirSync(BASE_UPLOAD_DIR, { recursive: true });

  function nsDir(ns) {
    if (!ns) return BASE_UPLOAD_DIR;
    const safe = ns.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dir = path.join(BASE_UPLOAD_DIR, safe);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  const storage = multer.diskStorage({
    destination: function (req, _file, cb) {
      try {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        const target = nsDir(ns);
        try {
          for (const f of fs.readdirSync(target)) {
            if (f.endsWith('.gif')) {
              fs.unlinkSync(path.join(target, f));
            }
          }
        } catch {}
        cb(null, target);
      } catch {
        cb(null, BASE_UPLOAD_DIR);
      }
    },
    filename: function (_req, file, cb) {
      cb(null, 'tip-notification.gif');
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: 1024 * 1024 * 2 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === 'image/gif' || file.originalname.toLowerCase().endsWith('.gif')) {
        cb(null, true);
      } else {
        cb(new Error('Only GIF images are allowed'));
      }
    }
  });

  function loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      }
    } catch {
      console.error('[gif-config] load error');
    }
    return { gifPath: '', position: 'right', width: 0, height: 0 };
  }

  function saveConfig(cfg) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  }

  app.get('/api/tip-notification-gif', (req, res) => {
    try {
      const cfg = loadConfig();
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
      const conceal = shouldMaskSensitive(req);
      const trusted = isTrustedLocalAdmin(req);

      if (!hasNs) {
        const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
        if (requireSessionFlag) {

          return res.json({ gifPath: '', width: 0, height: 0 });
        }
        return res.json({ gifPath: '', position: 'right', width: 0, height: 0 });
      }

      if (conceal && !trusted) {

        return res.json({ gifPath: '', width: 0, height: 0 });
      }
      if (store && hasNs) {
        (async () => {
          try {
            const ns = req.ns.admin || req.ns.pub;
            const st = await store.get(ns, 'tip-notification-gif', null);
            if (st && typeof st === 'object') {
              return res.json(st);
            }
          } catch {}
          return res.json(cfg);
        })();
        return;
      }
      res.json(cfg);
    } catch {
      res.status(500).json({ error: 'Error loading config' });
    }
  });

  app.post('/api/tip-notification-gif', strictLimiter, (req, res, next) => {
    const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
    const hosted = !!process.env.REDIS_URL;
    const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
    const requireAdminWrites = (process.env.GETTY_REQUIRE_ADMIN_WRITE === '1') || hosted;
  if (!isOpenTestMode() && (requireSessionFlag || hosted) && !hasNs) {
      return res.status(401).json({ error: 'no_session' });
    }
  if (!isOpenTestMode() && requireAdminWrites) {
      const isAdmin = !!(req?.auth && req.auth.isAdmin);
      if (!isAdmin) return res.status(401).json({ error: 'admin_required' });
    }
    upload.single('gifFile')(req, res, function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  }, (req, res) => {
    try {
      const bodySchema = z.object({ position: z.enum(['left','right','top','bottom']).default('right') }).passthrough();
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid position' });
      const position = parsed.data.position;
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      let config = loadConfig();
      if (req.file) {
        const filePath = path.join(nsDir(ns), req.file.filename);
        let dims;
  try { dims = readGifDimensions(filePath); } catch {
          fs.unlinkSync(filePath);
          return res.status(400).json({ error: 'Invalid GIF file' });
        }
        config.gifPath = ns ? `/uploads/notification-gif/${ns.replace(/[^a-zA-Z0-9_-]/g, '_')}/${req.file.filename}` : `/uploads/notification-gif/${req.file.filename}`;
        config.width = dims.width;
        config.height = dims.height;
      }
      config.position = position;
      if (store && ns) {
        (async () => {
          try {
            await store.set(ns, 'tip-notification-gif', config);
          } catch {}
          saveConfig(config);
          res.json({ success: true, ...config });
        })();
      } else {
        saveConfig(config);
        res.json({ success: true, ...config });
      }
    } catch (_e) {
      console.error('Error saving GIF config:', _e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/tip-notification-gif', strictLimiter, async (req, res) => {
    const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
    const hosted = !!process.env.REDIS_URL;
    if (process.env.GETTY_DISABLE_GIF_DELETE === '1') {
      return res.status(405).json({ error: 'gif_delete_disabled' });
    }
    const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
    const requireAdminWrites = (process.env.GETTY_REQUIRE_ADMIN_WRITE === '1') || hosted;
  if (!isOpenTestMode() && (requireSessionFlag || hosted) && !hasNs) {
      return res.status(401).json({ error: 'no_session' });
    }
  if (!isOpenTestMode() && requireAdminWrites) {
      const isAdmin = !!(req?.auth && req.auth.isAdmin);
      if (!isAdmin) return res.status(401).json({ error: 'admin_required' });
    }
  if (!isOpenTestMode() && (hosted || requireSessionFlag) && !isTrustedLocalAdmin(req)) {
      return res.status(403).json({ error: 'forbidden_untrusted_context' });
    }
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      let cfgToUse = loadConfig();
      if (store && ns) {
        try {
          const st = await store.get(ns, 'tip-notification-gif', null);
          if (st && typeof st === 'object') cfgToUse = st;
        } catch {}
      }
      if (cfgToUse.gifPath) {
        try {
          const fp = path.join(process.cwd(), 'public', cfgToUse.gifPath.replace(/^\/+/, ''));
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch { /* ignore */ }
      }
      const cleared = { gifPath: '', position: 'right', width: 0, height: 0 };
      if (store && ns) {
        try { await store.set(ns, 'tip-notification-gif', cleared); } catch {}
        saveConfig(cleared);
        return res.json({ success: true, ...cleared });
      }
      saveConfig(cleared);
      res.json({ success: true, ...cleared });
  } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

module.exports = registerTipNotificationGifRoutes;
