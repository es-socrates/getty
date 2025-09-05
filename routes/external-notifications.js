const { z } = require('zod');

function registerExternalNotificationsRoutes(app, externalNotifications, limiter, options = {}) {
  const store = options.store || null;
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const hostedWithRedis = !!process.env.REDIS_URL;
  const shouldRequireSession = requireSessionFlag || hostedWithRedis;

  app.post('/api/external-notifications', limiter, async (req, res) => {
    try {
      if (shouldRequireSession) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }

      const body = req.body || {};
      const normalized = {
        discordWebhook: typeof body.discordWebhook === 'string' && body.discordWebhook.trim() ? body.discordWebhook.trim() : undefined,
        telegramBotToken: typeof body.telegramBotToken === 'string' && body.telegramBotToken.trim() ? body.telegramBotToken.trim() : undefined,
        telegramChatId: typeof body.telegramChatId === 'string' && body.telegramChatId.trim() ? body.telegramChatId.trim() : undefined,
        template: typeof body.template === 'string' ? body.template : undefined,
        liveDiscordWebhook: typeof body.liveDiscordWebhook === 'string' && body.liveDiscordWebhook.trim() ? body.liveDiscordWebhook.trim() : undefined,
        liveTelegramBotToken: typeof body.liveTelegramBotToken === 'string' && body.liveTelegramBotToken.trim() ? body.liveTelegramBotToken.trim() : undefined,
        liveTelegramChatId: typeof body.liveTelegramChatId === 'string' && body.liveTelegramChatId.trim() ? body.liveTelegramChatId.trim() : undefined
      };
      const schema = z.object({
        discordWebhook: z.string().url().optional(),
        telegramBotToken: z.string().optional(),
        telegramChatId: z.string().optional(),
        template: z.string().optional(),
        liveDiscordWebhook: z.string().url().optional(),
        liveTelegramBotToken: z.string().optional(),
        liveTelegramChatId: z.string().optional()
      });
      const parsed = schema.safeParse(normalized);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid payload' });
      const { discordWebhook, telegramBotToken, telegramChatId, template, liveDiscordWebhook, liveTelegramBotToken, liveTelegramChatId } = parsed.data;

  if (!discordWebhook && !(telegramBotToken && telegramChatId) && !liveDiscordWebhook && !(liveTelegramBotToken && liveTelegramChatId)) {
        return res.status(400).json({
          error: 'Either Discord webhook or Telegram credentials are required',
          success: false
        });
      }

  const payload = {
        discordWebhook,
        telegramBotToken,
        telegramChatId,
        template: template || '🎉 New tip from {from}: {amount} AR (${usd}) - "{message}"',
        liveDiscordWebhook,
        liveTelegramBotToken,
        liveTelegramChatId
      };

      const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (store && ns) {
        await store.set(ns, 'external-notifications-config', payload);
      } else {
        await externalNotifications.saveConfig(payload);
      }

      res.json({
        success: true,
        status: externalNotifications.getStatus(),
        message: 'Settings saved successfully'
      });
    } catch (error) {
      console.error('Error saving external notifications config:', error);
      res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
    }
  });

  app.get('/api/external-notifications', async (req, res) => {
    const ns = req?.ns?.admin || req?.ns?.pub || null;
    const hasNs = !!ns;
    if (store && ns) {
      try {
        const cfg = (await store.get(ns, 'external-notifications-config', null)) || {};
        return res.json({
          active: !!(cfg.discordWebhook || (cfg.telegramBotToken && cfg.telegramChatId)),
          lastTips: [],
          config: {
            hasDiscord: !!cfg.discordWebhook,
            hasTelegram: !!(cfg.telegramBotToken && cfg.telegramChatId),
            template: cfg.template || '',
            discordWebhook: '',
            telegramBotToken: '',
            telegramChatId: '',
            hasLiveDiscord: !!cfg.liveDiscordWebhook,
            hasLiveTelegram: !!(cfg.liveTelegramBotToken && cfg.liveTelegramChatId),
            liveDiscordWebhook: '',
            liveTelegramBotToken: '',
            liveTelegramChatId: ''
          },
          lastUpdated: new Date().toISOString()
        });
      } catch {}
    }

    const status = externalNotifications.getStatus();
  const allowRevealLocal = !shouldRequireSession;
  const sanitized = {
      active: !!status.active,
      lastTips: (hostedWithRedis || requireSessionFlag) && !hasNs ? [] : status.lastTips,
      config: {
        hasDiscord: !!status.config?.hasDiscord,
        hasTelegram: !!status.config?.hasTelegram,
        template: status.config?.template || '',
        discordWebhook: allowRevealLocal ? (externalNotifications.discordWebhook || '') : '',
        telegramBotToken: allowRevealLocal ? (externalNotifications.telegramBotToken || '') : '',
        telegramChatId: allowRevealLocal ? (externalNotifications.telegramChatId || '') : '',
        hasLiveDiscord: !!status.config?.hasLiveDiscord,
        hasLiveTelegram: !!status.config?.hasLiveTelegram,
        liveDiscordWebhook: allowRevealLocal ? (externalNotifications.liveDiscordWebhook || '') : '',
        liveTelegramBotToken: allowRevealLocal ? (externalNotifications.liveTelegramBotToken || '') : '',
        liveTelegramChatId: allowRevealLocal ? (externalNotifications.liveTelegramChatId || '') : ''
      },
      lastUpdated: status.lastUpdated
    };
    res.json(sanitized);
  });

  function extractClaimIdFromUrl(url) {
    try {
      const u = new URL(url);
      if (!/^https?:$/i.test(u.protocol)) return '';
      if (!/^(www\.)?odysee\.com$/i.test(u.hostname)) return '';

      const parts = u.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1] || '';
      const m = last.match(/:([a-z0-9]+)/i);
      return m && m[1] ? m[1] : '';
    } catch { return ''; }
  }

  app.post('/api/external-notifications/live/send', limiter, async (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const shouldRequireSession = requireSessionFlag || !!process.env.REDIS_URL;
      if (shouldRequireSession) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const schema = z.object({
        title: z.string().max(150).optional(),
        description: z.string().max(200).optional(),
        channelUrl: z.string().url().optional(),
        imageUrl: z.string().url().or(z.string().regex(/^\/(?:uploads\/live-announcements\/).+/)).optional(),
        signature: z.string().max(80).optional(),
        discordWebhook: z.string().url().optional(),
        livePostClaimId: z.string().min(1).max(80).optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'invalid_payload' });
      const payload = parsed.data;

      try {
        if (payload.livePostClaimId && payload.channelUrl) {
          const fromUrl = extractClaimIdFromUrl(payload.channelUrl);
          if (fromUrl) {
            const a = String(payload.livePostClaimId).toLowerCase();
            const b = String(fromUrl).toLowerCase();
            const matches = a.startsWith(b) || b.startsWith(a);
            if (!matches) return res.status(400).json({ success: false, error: 'claim_mismatch' });
          }
        }
      } catch {}

      let cfg = null;
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (store && ns) {
        try { cfg = await store.get(ns, 'external-notifications-config', null); } catch {}
      }
      if (!cfg) {
        const statusCfg = externalNotifications.getStatus()?.config || {};

        cfg = {
          ...statusCfg,
          liveDiscordWebhook: externalNotifications.liveDiscordWebhook || '',
          liveTelegramBotToken: externalNotifications.liveTelegramBotToken || '',
          liveTelegramChatId: externalNotifications.liveTelegramChatId || ''
        };
      }

      let draft = null;
      if (store && ns) {
        try { draft = await store.get(ns, 'live-announcement-draft', null); } catch {}
      } else {
        try {
          const fs = require('fs'); const path = require('path');
          const file = path.join(process.cwd(), 'config', 'live-announcement-config.json');
          if (fs.existsSync(file)) draft = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {}
      }
      if (!payload.discordWebhook && draft && typeof draft.discordWebhook === 'string' && draft.discordWebhook) {
        payload.discordWebhook = draft.discordWebhook;
      }

      if (!(cfg.hasLiveDiscord || cfg.hasLiveTelegram || cfg.liveDiscordWebhook || (cfg.liveTelegramBotToken && cfg.liveTelegramChatId) || payload.discordWebhook)) {
        return res.status(400).json({ success: false, error: 'no_live_channels_configured' });
      }

      try {
        if (payload.imageUrl && /^\//.test(payload.imageUrl)) {
          if (!/^\/uploads\/live-announcements\//.test(payload.imageUrl)) {
            const base = `${req.protocol}://${req.get('host')}`;
            payload.imageUrl = new URL(payload.imageUrl, base).toString();
          }
        }
      } catch {}

      const ok = await externalNotifications.sendLiveWithConfig(cfg, payload);
      if (!ok) return res.json({ success: false, error: 'send_failed' });
      res.json({ success: true });
    } catch (e) {
      console.error('Error sending live announcement:', e);
      res.status(500).json({ success: false, error: 'internal_error' });
    }
  });

  app.post('/api/external-notifications/live/test', limiter, async (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const shouldRequireSession = requireSessionFlag || !!process.env.REDIS_URL;
      if (shouldRequireSession) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const schema = z.object({
        title: z.string().max(150).optional(),
        description: z.string().max(200).optional(),
        channelUrl: z.string().url().optional(),
        imageUrl: z.string().url().or(z.string().regex(/^\/(?:uploads\/live-announcements\/).+/)).optional(),
        signature: z.string().max(80).optional(),
        discordWebhook: z.string().url().optional(),
        livePostClaimId: z.string().min(1).max(80).optional()
      });
      const parsed = schema.safeParse(req.body || {});
      let payload = parsed.success ? parsed.data : {};

      let draft = null;
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (store && ns) {
        try { draft = await store.get(ns, 'live-announcement-draft', null); } catch {}
      } else {
        try {
          const fs = require('fs'); const path = require('path');
          const file = path.join(process.cwd(), 'config', 'live-announcement-config.json');
          if (fs.existsSync(file)) draft = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {}
      }
      payload = {
        title: (`[TEST] ${payload.title || draft?.title || 'Live notification'}`).slice(0,150),
        description: (payload.description || draft?.description || 'This is a test live notification to verify configuration.').slice(0,200),
        channelUrl: payload.channelUrl || draft?.channelUrl || undefined,
        signature: payload.signature || draft?.signature || undefined,
        discordWebhook: payload.discordWebhook || draft?.discordWebhook || undefined,
        imageUrl: payload.imageUrl || undefined,
        livePostClaimId: payload.livePostClaimId || draft?.livePostClaimId || undefined
      };

      try {
        if (payload.livePostClaimId && payload.channelUrl) {
          const fromUrl = extractClaimIdFromUrl(payload.channelUrl);
          if (fromUrl) {
            const a = String(payload.livePostClaimId).toLowerCase();
            const b = String(fromUrl).toLowerCase();
            const matches = a.startsWith(b) || b.startsWith(a);
            if (!matches) return res.status(400).json({ success: false, error: 'claim_mismatch' });
          }
        }
      } catch {}
      Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });

      let cfg = null;
      if (store && ns) {
        try { cfg = await store.get(ns, 'external-notifications-config', null); } catch {}
      }
      if (!cfg) {
        const statusCfg = externalNotifications.getStatus()?.config || {};
        cfg = {
          ...statusCfg,
          liveDiscordWebhook: externalNotifications.liveDiscordWebhook || '',
          liveTelegramBotToken: externalNotifications.liveTelegramBotToken || '',
          liveTelegramChatId: externalNotifications.liveTelegramChatId || ''
        };
      }

      try {
        if (payload.imageUrl && /^\//.test(payload.imageUrl)) {
          if (!/^\/uploads\/live-announcements\//.test(payload.imageUrl)) {
            const base = `${req.protocol}://${req.get('host')}`;
            payload.imageUrl = new URL(payload.imageUrl, base).toString();
          }
        }
      } catch {}

      const ok = await externalNotifications.sendLiveWithConfig(cfg, payload);
      if (!ok) return res.json({ success: false, error: 'send_failed' });
      res.json({ success: true });
    } catch (e) {
      console.error('Error sending live test announcement:', e);
      res.status(500).json({ success: false, error: 'internal_error' });
    }
  });

  app.post('/api/external-notifications/live/config', limiter, async (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const shouldRequireSession = requireSessionFlag || hosted;
      if (shouldRequireSession) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const schema = z.object({
        title: z.string().max(150).optional(),
        description: z.string().max(200).optional(),
        channelUrl: z.string().url().optional(),
        imageUrl: z.string().url().or(z.string().regex(/^\/(?:uploads\/live-announcements\/).+/)).optional(),
        signature: z.string().max(80).optional(),
        discordWebhook: z.string().url().optional(),
        auto: z.boolean().optional(),
        livePostClaimId: z.string().min(1).max(80).optional()
      });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ success: false, error: 'invalid_payload' });
      const data = parsed.data || {};

  const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (store && ns) {
        await store.set(ns, 'live-announcement-draft', data);

        try {
          if (store.redis && typeof data.auto === 'boolean') {
            const SET_KEY = 'getty:auto-live:namespaces';
            if (data.auto) {
      await store.redis.sadd(SET_KEY, ns);
      try { console.info('[auto-live] registered namespace for auto', ns); } catch {}
            } else {
      await store.redis.srem(SET_KEY, ns);
      try { console.info('[auto-live] unregistered namespace for auto', ns); } catch {}
            }
          }
        } catch {}
      } else {
        const fs = require('fs'); const path = require('path');
        const cfgDir = path.join(process.cwd(), 'config');
        const file = path.join(cfgDir, 'live-announcement-config.json');
        if (!fs.existsSync(cfgDir)) fs.mkdirSync(cfgDir, { recursive: true });
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
      }
      res.json({ success: true });
    } catch (e) {
      console.error('Error saving live draft:', e);
      res.status(500).json({ success: false, error: 'internal_error' });
    }
  });

  app.get('/api/external-notifications/live/config', async (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const shouldRequireSession = requireSessionFlag || hosted;
      if (shouldRequireSession) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const hostedWithRedis = !!process.env.REDIS_URL;
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      let draft = null;
      if (store && ns) {
        try { draft = await store.get(ns, 'live-announcement-draft', null); } catch {}
      }
      if (!draft) {
        try {
          const fs = require('fs'); const path = require('path');
          const file = path.join(process.cwd(), 'config', 'live-announcement-config.json');
          if (fs.existsSync(file)) draft = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {}
      }
      if (!draft) draft = {};
      const sanitized = {
        title: draft.title || '',
        description: draft.description || '',
        channelUrl: draft.channelUrl || '',
        imageUrl: draft.imageUrl || '',
        signature: draft.signature || '',
        discordWebhook: (hostedWithRedis ? '' : (draft.discordWebhook || '')),
        hasDiscordOverride: !!draft.discordWebhook,
        auto: !!draft.auto,
        livePostClaimId: typeof draft.livePostClaimId === 'string' ? draft.livePostClaimId : ''
      };
      res.json({ success: true, config: sanitized });
  } catch {
      res.json({ success: true, config: { title:'', description:'', channelUrl:'', imageUrl:'', signature:'', discordWebhook:'', hasDiscordOverride:false } });
    }
  });

  app.post('/api/external-notifications/live/upload', async (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const shouldRequireSession = requireSessionFlag || !!process.env.REDIS_URL;
      if (shouldRequireSession) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const multer = require('multer');
      const fs = require('fs');
      const path = require('path');
      const { imageSize } = require('image-size');
      const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'live-announcements');
      if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const storage = multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase();
          const base = `live-${Date.now()}${ext}`;
          cb(null, base);
        }
      });
      const upload = multer({
        storage,
        limits: { fileSize: 2 * 1024 * 1024, files: 1 },
        fileFilter: (_req, file, cb) => {
          const ok = /^image\/(png|jpe?g|webp)$/i.test(file.mimetype);
          cb(ok ? null : new Error('invalid_type'), ok);
        }
      }).single('image');

      upload(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, error: String(err.message || err) });
        if (!req.file) return res.status(400).json({ success: false, error: 'no_file' });
        try {
          const filePath = path.join(UPLOAD_DIR, req.file.filename);
          const dim = imageSize(filePath);
          if (!dim || !dim.width || !dim.height) throw new Error('invalid_image');
          if (dim.width > 1920 || dim.height > 1080) {
            try { fs.unlinkSync(filePath); } catch {}
            return res.status(400).json({ success: false, error: 'too_large_dimensions' });
          }
          const url = `/uploads/live-announcements/${req.file.filename}`;
          res.json({ success: true, url, width: dim.width, height: dim.height });
        } catch {
          return res.status(400).json({ success: false, error: 'invalid_image' });
        }
      });
    } catch {
      res.status(500).json({ success: false, error: 'internal_error' });
    }
  });

  app.get('/api/external-notifications/live/og', async (req, res) => {
    try {
      const url = String(req.query.url || '').trim();
      if (!url) return res.status(400).json({ error: 'missing_url' });
      const u = new URL(url);
      const allowedHosts = new Set(['odysee.com','www.odysee.com']);
      if (!allowedHosts.has(u.hostname)) return res.status(400).json({ error: 'host_not_allowed' });
      const axios = require('axios');
      const r = await axios.get(url, { timeout: 5000 });
      const html = String(r.data || '');
      const matchFirst = (patterns) => {
        for (const pattern of patterns) {
          const mm = html.match(pattern);
          if (mm && mm[1]) return mm[1];
        }
        return '';
      };
      const imgRaw = matchFirst([
        /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["'][^>]*>/i,
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i,
        /<meta[^>]+name=["']twitter:player:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:player:image["'][^>]*>/i
      ]);
      let img = imgRaw || '';
      if (img && !/^https?:\/\//i.test(img)) {
        img = `${u.origin}${img.startsWith('/') ? '' : '/'}${img}`;
      }
      const imgHost = img ? (new URL(img)).hostname : '';
      const allowedImgHosts = new Set(['thumbs.odycdn.com','thumbnails.odycdn.com','static.odycdn.com','odysee.com','www.odysee.com']);
      if (!img || !allowedImgHosts.has(imgHost)) return res.json({ ok: true, imageUrl: null });
      res.json({ ok: true, imageUrl: img });
    } catch {
      res.json({ ok: true, imageUrl: null });
    }
  });

  app.get('/api/external-notifications/live/resolve', async (req, res) => {
    try {
      const claimId = String(req.query.claimId || '').trim();
      if (!claimId) return res.status(400).json({ ok: false, error: 'missing_claim' });
      const axios = require('axios');
      const r = await axios.post('https://api.na-backend.odysee.com/api/v1/proxy', {
        method: 'claim_search',
        params: { claim_ids: [claimId], no_totals: true, page: 1, page_size: 1 }
      }, { timeout: 7000 });
      const list = r?.data?.result?.items || r?.data?.data?.result?.items || [];
      if (!Array.isArray(list) || !list.length) return res.json({ ok: false, url: null });
      const it = list[0] || {};
      const lbry = it.canonical_url || it.permanent_url || '';
      if (!/^lbry:\/\//.test(lbry)) return res.json({ ok: false, url: null });
      const web = 'https://odysee.com/' + lbry.replace(/^lbry:\/\//,'').replace(/#/g, ':');
      res.json({ ok: true, url: web });
    } catch {
      res.json({ ok: false, url: null });
    }
  });

  app.get('/api/external-notifications/live/diag', async (req, res) => {
    try {
      const hosted = !!process.env.REDIS_URL;
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      const can = hosted && !!store && !!ns && !!store.redis;
      if (!can) {
        const reason = !hosted ? 'not_hosted' : (!store ? 'no_store' : (!store.redis ? 'no_redis' : (!ns ? 'no_session' : 'unavailable')));
        return res.json({ ok: false, hosted, reason });
      }
      const AUTO_SET = 'getty:auto-live:namespaces';
      const LAST_POLL_KEY = 'getty:auto-live:lastpoll';
      const inSet = await store.redis.sismember(AUTO_SET, ns);
      const lastPoll = await store.redis.hget(LAST_POLL_KEY, ns);
      const draft = await store.get(ns, 'live-announcement-draft', null);
      const ext = await store.get(ns, 'external-notifications-config', null);
      const hasDiscord = !!(ext?.liveDiscordWebhook);
      const hasTelegram = !!(ext?.liveTelegramBotToken && ext?.liveTelegramChatId);
      const hasDiscordOverride = !!(draft && typeof draft.discordWebhook === 'string' && draft.discordWebhook.trim());
      const hasAnyLiveTarget = !!(hasDiscord || hasTelegram || hasDiscordOverride);

      const imageUrl = (draft && typeof draft.imageUrl === 'string' && draft.imageUrl.trim()) ? draft.imageUrl.trim() : '';
      const channelUrl = (draft && typeof draft.channelUrl === 'string' && draft.channelUrl.trim()) ? draft.channelUrl.trim() : '';
      const hasImageUrl = !!imageUrl;
      const ogCandidate = (() => {
        try { const u = new URL(channelUrl); return /^https?:$/i.test(u.protocol) && /^(www\.)?odysee\.com$/i.test(u.hostname); } catch { return false; }
      })();
      const claimFromUrl = channelUrl ? extractClaimIdFromUrl(channelUrl) : '';
      const livePostClaimId = (draft && typeof draft.livePostClaimId === 'string' && draft.livePostClaimId.trim()) ? draft.livePostClaimId.trim() : '';
      const claimMatch = (function() {
        try {
          if (!livePostClaimId || !claimFromUrl) return null;
          const a = livePostClaimId.toLowerCase();
          const b = claimFromUrl.toLowerCase();
          return a.startsWith(b) || b.startsWith(a);
        } catch { return null; }
      })();
      res.json({
        ok: true,
        ns,
        autoEnabled: !!draft?.auto,
        registered: inSet === 1 || inSet === true,
        lastPoll: lastPoll ? Number(lastPoll) : null,
        hasDiscord,
        hasTelegram,
        hasDiscordOverride,
        hasAnyLiveTarget,
        hasImageUrl,
        imageUrl,
        ogCandidate,
        livePostClaimId,
        claimFromUrl,
        claimMatch
      });
    } catch (e) {
      res.json({ ok: false, error: e?.message || String(e) });
    }
  });
}

module.exports = registerExternalNotificationsRoutes;
