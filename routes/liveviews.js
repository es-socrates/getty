const fs = require('fs');
const path = require('path');
const multer = require('multer');
const axios = require('axios');

const { loadTenantConfig, saveTenantConfig } = require('../lib/tenant-config');
const { getStorage } = require('../lib/supabase-storage');

const LIVEVIEWS_FONT_STACK =
  'Roobert, Tajawal, Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';

function getLiveviewsConfigWithDefaults(partial) {
  return {
    bg: typeof partial.bg === 'string' && partial.bg.trim() ? partial.bg : '#222222',
    color: typeof partial.color === 'string' && partial.color.trim() ? partial.color : '#ffffff',
    font:
      typeof partial.font === 'string' && partial.font.trim() ? partial.font : LIVEVIEWS_FONT_STACK,
    size: typeof partial.size === 'string' && partial.size.trim() ? partial.size : '32',
    icon: typeof partial.icon === 'string' ? partial.icon : '',
    claimid: typeof partial.claimid === 'string' ? partial.claimid : '',
    viewersLabel:
      typeof partial.viewersLabel === 'string' && partial.viewersLabel.trim()
        ? partial.viewersLabel
        : 'viewers',
  };
}

function registerLiveviewsRoutes(app, strictLimiter, options = {}) {
  const store = options.store || null;
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const LIVEVIEWS_CONFIG_FILE = path.join(process.cwd(), 'config', 'liveviews-config.json');
  const LIVEVIEWS_FILENAME = 'liveviews-config.json';
  const LIVEVIEWS_UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'liveviews');
  if (!fs.existsSync(LIVEVIEWS_UPLOADS_DIR)) {
    fs.mkdirSync(LIVEVIEWS_UPLOADS_DIR, { recursive: true });
  }

  const LV_TTL_MS = Math.max(1000, parseInt(process.env.GETTY_LIVEVIEWS_TTL_MS || '10000', 10));
  const LV_RL_ENABLED = process.env.GETTY_LIVEVIEWS_RL_ENABLED === '1';
  const LV_RL_WINDOW_MS = Math.max(
    1000,
    parseInt(process.env.GETTY_LIVEVIEWS_RL_WINDOW_MS || '60000', 10)
  );
  const LV_RL_MAX = Math.max(1, parseInt(process.env.GETTY_LIVEVIEWS_RL_MAX || '120', 10));

  function isTrustedIp(req) {
    try {
      let ip = req.ip || req.connection?.remoteAddress || '';
      if (typeof ip === 'string' && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
      const allow = (process.env.GETTY_ALLOW_IPS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const loopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
      return loopback || (allow.length > 0 && allow.includes(ip));
    } catch {
      return false;
    }
  }

  function getClientIp(req) {
    try {
      let ip = req.ip || req.connection?.remoteAddress || '';
      if (typeof ip === 'string' && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
      return typeof ip === 'string' ? ip : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // Use memory storage for multer - files will be uploaded to Supabase
  const liveviewsUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files are allowed'));
    },
  });

  app.post(
    '/config/liveviews-config.json',
    strictLimiter,
    liveviewsUpload.single('icon'),
    async (req, res) => {
      try {
        if ((store && store.redis) || requireSessionFlag) {
          const nsCheck = req?.ns?.admin || req?.ns?.pub || null;
          if (!nsCheck) return res.status(401).json({ error: 'session_required' });
        }
        const body = req.body || {};
        const removeIcon = body.removeIcon === '1';
        const ns = req?.ns?.admin || req?.ns?.pub || null;

        let prevWrapped = await loadTenantConfig(
          req,
          store,
          LIVEVIEWS_CONFIG_FILE,
          LIVEVIEWS_FILENAME
        ).catch(() => ({ data: {} }));
        let prev = prevWrapped && prevWrapped.data ? prevWrapped.data : {};

        if ((!prev || Object.keys(prev).length === 0) && store && ns) {
          try {
            const legacy = await store.get(ns, 'liveviews-config', null);
            if (legacy && typeof legacy === 'object') prev = legacy;
          } catch {}
        }

        let iconUrl = '';
        if (req.file) {
          const storage = getStorage();
          if (!storage) {
            return res.status(500).json({ error: 'Storage service not configured' });
          }

          const safeNs = ns ? ns.replace(/[^a-zA-Z0-9_-]/g, '_') : 'global';
          const filePath = `${safeNs}/liveviews-icon-${Date.now()}.${req.file.mimetype.split('/')[1]}`;

          try {
            const uploadResult = await storage.uploadFile(
              'liveviews-icons',
              filePath,
              req.file.buffer,
              {
                contentType: req.file.mimetype,
              }
            );
            iconUrl = uploadResult.publicUrl;
          } catch (uploadError) {
            console.error('Supabase upload error:', uploadError);
            return res.status(500).json({ error: 'Failed to upload file' });
          }
        } else if (!removeIcon && prev.icon) {
          iconUrl = prev.icon;
        }
        if (removeIcon && prev.icon) {
          if (prev.icon && prev.icon.includes('supabase')) {
            try {
              const storage = getStorage();
              if (storage) {
                const urlParts = prev.icon.split('/storage/v1/object/public/');
                if (urlParts.length === 2) {
                  const filePath = urlParts[1].split('/').slice(1).join('/');
                  await storage.deleteFile('liveviews-icons', filePath);
                }
              }
            } catch (deleteError) {
              console.warn('Failed to delete icon from Supabase:', deleteError.message);
            }
          }
          iconUrl = '';
        }

        const merged = {
          ...prev,
          ...body,
          icon: iconUrl,
        };
        const config = getLiveviewsConfigWithDefaults(merged);

        await saveTenantConfig(req, store, LIVEVIEWS_CONFIG_FILE, LIVEVIEWS_FILENAME, config);
        res.json({ success: true, config });
      } catch (error) {
        res.status(500).json({ error: 'Error saving configuration', details: error.message });
      }
    }
  );

  app.get('/config/liveviews-config.json', async (req, res) => {
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      let loaded = await loadTenantConfig(
        req,
        store,
        LIVEVIEWS_CONFIG_FILE,
        LIVEVIEWS_FILENAME
      ).catch(() => ({ data: {} }));
      let config = getLiveviewsConfigWithDefaults(loaded && loaded.data ? loaded.data : {});

      if ((!config || Object.keys(config).length === 0) && store && ns) {
        try {
          const legacy = await store.get(ns, 'liveviews-config', null);
          if (legacy && typeof legacy === 'object') {
            config = getLiveviewsConfigWithDefaults(legacy);
            await saveTenantConfig(req, store, LIVEVIEWS_CONFIG_FILE, LIVEVIEWS_FILENAME, config);
          }
        } catch {}
      }

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
    if (!!store || requireSessionFlag) {
      const nsCheck = req?.ns?.admin || req?.ns?.pub || null;
      if (!nsCheck) return res.status(401).json({ error: 'session_required' });
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
        config = {
          bg: '#222222',
          color: '#ffffff',
          font: LIVEVIEWS_FONT_STACK,
          size: 32,
          icon: '',
          claimid: '',
          viewersLabel,
        };
      } else {
        try {
          config = JSON.parse(data);
          if (typeof config !== 'object' || config === null) config = {};
        } catch {
          config = {
            bg: '#222222',
            color: '#ffffff',
            font: LIVEVIEWS_FONT_STACK,
            size: 32,
            icon: '',
            claimid: '',
            viewersLabel,
          };
        }
        config.viewersLabel = viewersLabel;
      }
      fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8', (err) => {
        if (err) return res.status(500).json({ error: 'The label could not be saved.' });
        res.json({ success: true });
      });
    });
  });

  app.get('/api/liveviews/status', async (req, res) => {
    try {
      const debugMode = String(req.query.debug || '') === '1';
      const forceFresh = String(req.query.force || '') === '1';
      if (LV_RL_ENABLED && !isTrustedIp(req)) {
        if (!app.__lvRate) app.__lvRate = {};
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        const ip = getClientIp(req);
        const bucketKey = `${ns || 'single'}|${ip}`;
        const now = Date.now();
        const b = app.__lvRate[bucketKey];
        if (!b || now - b.ts >= LV_RL_WINDOW_MS) {
          app.__lvRate[bucketKey] = { ts: now, count: 1 };
        } else {
          b.count += 1;
          if (b.count > LV_RL_MAX) {
            const cacheKey = ns && typeof ns === 'string' ? `ns:${ns}` : 'single';
            const cached = app.__lvCache && app.__lvCache[cacheKey];
            if (cached) {
              res.setHeader('X-RateLimit-Used', 'true');
              return res.json({ data: cached.data });
            }
            const retry = Math.ceil((LV_RL_WINDOW_MS - (now - b.ts)) / 1000);
            res.setHeader('Retry-After', String(Math.max(1, retry)));
            return res.status(429).json({ error: 'rate_limited' });
          }
        }
      }

      const ns = req?.ns?.admin || req?.ns?.pub || null;

      let loadedCfg = await loadTenantConfig(
        req,
        store,
        LIVEVIEWS_CONFIG_FILE,
        LIVEVIEWS_FILENAME
      ).catch(() => ({ data: {} }));
      let config = getLiveviewsConfigWithDefaults(
        loadedCfg && loadedCfg.data ? loadedCfg.data : {}
      );
      if (debugMode) {
        try {
          config.__source = loadedCfg && loadedCfg.source;
          if (loadedCfg && loadedCfg.meta) config.__version = loadedCfg.meta.__version;
        } catch {}
      }
      const claimid = (config.claimid || '').trim();
      if (!claimid) {
        const base = { data: { Live: false, ViewerCount: 0 } };
        if (debugMode) {
          return res.json({
            ...base,
            debug: {
              reason: 'missing_claimid',
              ns: ns || null,
              ttlMs: LV_TTL_MS,
              cachedKeys: Object.keys(app.__lvCache || {}),
              now: Date.now(),
            },
          });
        }
        return res.json(base);
      }

      const key = ns && typeof ns === 'string' ? `ns:${ns}` : 'single';
      const now = Date.now();
      const TTL = LV_TTL_MS;
      if (!app.__lvCache) app.__lvCache = {};
      const cached = app.__lvCache[key];
      if (!forceFresh && cached && now - cached.ts < TTL) {
        if (debugMode) {
          return res.json({
            data: cached.data,
            debug: {
              source: 'cache',
              ageMs: now - cached.ts,
              ttlMs: TTL,
              expiresInMs: TTL - (now - cached.ts),
              ns: ns || null,
              claimid,
              lastError:
                app.__lvLastError && app.__lvLastError[key] ? app.__lvLastError[key] : null,
              now,
            },
          });
        }
        return res.json({ data: cached.data });
      }

      try {
        const primaryUrl = `https://api.odysee.live/livestream/is_live?channel_claim_id=${encodeURIComponent(claimid)}`;
        const resp = await axios.get(primaryUrl, { timeout: 5000 });
        let data = resp?.data?.data;
        let out = {
          Live: !!(data && data.Live),
          ViewerCount: data && typeof data.ViewerCount === 'number' ? data.ViewerCount : 0,
        };

        const fallbackTried = false;
        const fallbackOut = null;
        const fallbackUrl = null;
        app.__lvCache[key] = { ts: now, data: out };
        if (debugMode) {
          return res.json({
            data: out,
            debug: {
              source: 'fresh',
              fetchedAt: now,
              ttlMs: TTL,
              ns: ns || null,
              claimid,
              liveRaw: data && data.Live,
              viewerRaw: data && data.ViewerCount,
              fallbackTried,
              fallbackUrl,
              fallbackOut,
              forceFresh,
              lastError:
                app.__lvLastError && app.__lvLastError[key] ? app.__lvLastError[key] : null,
            },
          });
        }
        return res.json({ data: out });
      } catch (e) {
        try {
          if (!app.__lvLastError) app.__lvLastError = {};
          app.__lvLastError[key] = {
            ts: Date.now(),
            message: e && e.message ? e.message : String(e),
          };
        } catch {}
        if (cached) {
          if (debugMode) {
            return res.json({
              data: cached.data,
              debug: {
                source: 'cache-stale',
                ageMs: now - cached.ts,
                ttlMs: TTL,
                ns: ns || null,
                claimid,
                lastError: app.__lvLastError[key],
              },
            });
          }
          return res.json({ data: cached.data });
        }
        const base = { data: { Live: false, ViewerCount: 0 } };
        if (debugMode) {
          return res.json({
            ...base,
            debug: {
              source: 'error',
              ns: ns || null,
              claimid,
              error: app.__lvLastError[key],
            },
          });
        }
        return res.json(base);
      }
    } catch {
      return res.json({ data: { Live: false, ViewerCount: 0 } });
    }
  });
}

module.exports = registerLiveviewsRoutes;
