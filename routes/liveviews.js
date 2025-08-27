const fs = require('fs');
const path = require('path');
const multer = require('multer');

function getLiveviewsConfigWithDefaults(partial) {
  return {
    bg: typeof partial.bg === 'string' && partial.bg.trim() ? partial.bg : '#fff',
    color: typeof partial.color === 'string' && partial.color.trim() ? partial.color : '#222',
    font: typeof partial.font === 'string' && partial.font.trim() ? partial.font : 'Arial',
    size: typeof partial.size === 'string' && partial.size.trim() ? partial.size : '32',
    icon: typeof partial.icon === 'string' ? partial.icon : '',
    claimid: typeof partial.claimid === 'string' ? partial.claimid : '',
    viewersLabel: typeof partial.viewersLabel === 'string' && partial.viewersLabel.trim() ? partial.viewersLabel : 'viewers'
  };
}

function registerLiveviewsRoutes(app, strictLimiter, options = {}) {
  const store = options.store || null;
  const LIVEVIEWS_CONFIG_FILE = path.join(process.cwd(), 'config', 'liveviews-config.json');
  const LIVEVIEWS_UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'liveviews');
  if (!fs.existsSync(LIVEVIEWS_UPLOADS_DIR)) {
    fs.mkdirSync(LIVEVIEWS_UPLOADS_DIR, { recursive: true });
  }

  function isTrustedIp(req) {
    try {
      let ip = req.ip || req.connection?.remoteAddress || '';
      if (typeof ip === 'string' && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
      const allow = (process.env.GETTY_ALLOW_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
      const loopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
      return loopback || (allow.length > 0 && allow.includes(ip));
    } catch { return false; }
  }

  const liveviewsStorage = multer.diskStorage({
    destination: function (_req, _file, cb) {
      cb(null, LIVEVIEWS_UPLOADS_DIR);
    },
    filename: function (_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, 'icon' + ext);
    }
  });
  const liveviewsUpload = multer({
    storage: liveviewsStorage,
    limits: { fileSize: 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files are allowed'));
    }
  });

  app.post('/config/liveviews-config.json', strictLimiter, liveviewsUpload.single('icon'), async (req, res) => {
    try {
      const body = req.body || {};
      const removeIcon = body.removeIcon === '1';
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      let prev = {};
      if (store && ns) {
        try { prev = (await store.get(ns, 'liveviews-config', null)) || {}; } catch { prev = {}; }
      } else if (fs.existsSync(LIVEVIEWS_CONFIG_FILE)) {
        try { prev = JSON.parse(fs.readFileSync(LIVEVIEWS_CONFIG_FILE, 'utf8')); } catch { prev = {}; }
      }

      let iconUrl = '';
      if (req.file) {
        iconUrl = '/uploads/liveviews/' + req.file.filename;
      } else if (!removeIcon && prev.icon) {
        iconUrl = prev.icon;
      }
      if (removeIcon && prev.icon) {
        const iconPath = path.join(process.cwd(), 'public', prev.icon.replace(/^\//, ''));
        if (fs.existsSync(iconPath)) {
          try { fs.unlinkSync(iconPath); } catch {}
        }
        iconUrl = '';
      }

      const config = getLiveviewsConfigWithDefaults({
        ...prev,
        ...body,
        icon: iconUrl
      });
      if (store && ns) {
        await store.set(ns, 'liveviews-config', config);
      } else {
        fs.writeFileSync(LIVEVIEWS_CONFIG_FILE, JSON.stringify(config, null, 2));
      }
      res.json({ success: true, config });
    } catch (error) {
      res.status(500).json({ error: 'Error saving configuration', details: error.message });
    }
  });

  app.get('/config/liveviews-config.json', async (req, res) => {
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      let config = {};
      if (store && ns) {
        config = (await store.get(ns, 'liveviews-config', null)) || {};
      } else if (fs.existsSync(LIVEVIEWS_CONFIG_FILE)) {
        config = JSON.parse(fs.readFileSync(LIVEVIEWS_CONFIG_FILE, 'utf8'));
      }
      config = getLiveviewsConfigWithDefaults(config);

      const isHosted = !!store;
      const hasNs = !!ns;
      const trusted = isTrustedIp(req);
      if (isHosted && !hasNs && !trusted) {
            const sanitized = { ...config, claimid: '' };
            return res.json(sanitized);
          }
      res.json(config);
  } catch {
      res.json(getLiveviewsConfigWithDefaults({}));
    }
  });

  app.post('/api/save-liveviews-label', strictLimiter, async (req, res) => {
    const { viewersLabel } = req.body || {};
    if (typeof viewersLabel !== 'string' || !viewersLabel.trim()) {
      return res.status(400).json({ error: 'Invalid label' });
    }
    const ns = req?.ns?.admin || req?.ns?.pub || null;
    if (store && ns) {
      try {
        const current = (await store.get(ns, 'liveviews-config', null)) || {};
        const merged = getLiveviewsConfigWithDefaults({ ...current, viewersLabel });
        await store.set(ns, 'liveviews-config', merged);
        return res.json({ success: true });
  } catch {
        return res.status(500).json({ error: 'The label could not be saved.' });
      }
    }
    const configPath = LIVEVIEWS_CONFIG_FILE;
    fs.readFile(configPath, 'utf8', (err, data) => {
      let config;
      if (err) {
        config = { bg: '#fff', color: '#222', font: 'Arial', size: 32, icon: '', claimid: '', viewersLabel };
      } else {
        try { config = JSON.parse(data); if (typeof config !== 'object' || config === null) config = {}; }
        catch { config = { bg: '#fff', color: '#222', font: 'Arial', size: 32, icon: '', claimid: '', viewersLabel }; }
        config.viewersLabel = viewersLabel;
      }
      fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8', (err) => {
        if (err) return res.status(500).json({ error: 'The label could not be saved.' });
        res.json({ success: true });
      });
    });
  });
}

module.exports = registerLiveviewsRoutes;
