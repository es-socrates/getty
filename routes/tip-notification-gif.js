const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { z } = require('zod');

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

function registerTipNotificationGifRoutes(app, strictLimiter) {
  const CONFIG_FILE = path.join(process.cwd(), 'config', 'tip-notification-config.json');
  const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'notification-gif');

  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const storage = multer.diskStorage({
    destination: function (_req, _file, cb) {
      try {
        for (const f of fs.readdirSync(UPLOAD_DIR)) {
          if (f.endsWith('.gif')) {
            fs.unlinkSync(path.join(UPLOAD_DIR, f));
          }
        }
  } catch {

      }
      cb(null, UPLOAD_DIR);
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
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
      if ((requireSessionFlag || hosted) && !hasNs) {
        return res.json({ gifPath: '', position: undefined, width: 0, height: 0 });
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
    if ((requireSessionFlag || hosted) && !hasNs) {
      return res.status(401).json({ error: 'no_session' });
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
      let config = loadConfig();
      if (req.file) {
        const filePath = path.join(UPLOAD_DIR, req.file.filename);
        let dims;
  try { dims = readGifDimensions(filePath); } catch {
          fs.unlinkSync(filePath);
          return res.status(400).json({ error: 'Invalid GIF file' });
        }
        config.gifPath = `/uploads/notification-gif/${req.file.filename}`;
        config.width = dims.width;
        config.height = dims.height;
      }
      config.position = position;
      saveConfig(config);
      res.json({ success: true, ...config });
    } catch (_e) {
      console.error('Error saving GIF config:', _e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/tip-notification-gif', strictLimiter, (req, res) => {
    const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
    const hosted = !!process.env.REDIS_URL;
    const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
    if ((requireSessionFlag || hosted) && !hasNs) {
      return res.status(401).json({ error: 'no_session' });
    }
    try {
      const config = loadConfig();
      if (config.gifPath) {
        try {
          const fp = path.join(process.cwd(), 'public', config.gifPath.replace(/^\/+/, ''));
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch { /* ignore */ }
      }
      const cleared = { gifPath: '', position: 'right', width: 0, height: 0 };
      saveConfig(cleared);
      res.json({ success: true, ...cleared });
  } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

module.exports = registerTipNotificationGifRoutes;
