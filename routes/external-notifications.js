const { z } = require('zod');
const { loadTenantConfig, saveTenantConfig } = require('../lib/tenant-config');
const path = require('path');
const GLOBAL_EXT_NOTIF_PATH = path.join(process.cwd(), 'config', 'external-notifications-config.json');
const { isOpenTestMode } = require('../lib/test-open-mode');
const { getStorage } = require('../lib/supabase-storage');

function registerExternalNotificationsRoutes(app, externalNotifications, limiter, options = {}) {
  const store = options.store || null;
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const hostedWithRedis = !!process.env.REDIS_URL;
  const shouldRequireSession = (requireSessionFlag || hostedWithRedis) && !isOpenTestMode();
  const requireAdminWrites = ((process.env.GETTY_REQUIRE_ADMIN_WRITE === '1') || hostedWithRedis) && !isOpenTestMode();

  app.post('/api/external-notifications', limiter, async (req, res) => {
    try {
      let nsEarly = req?.ns?.admin || req?.ns?.pub || null;
      const tenantDebugEarly = process.env.GETTY_TENANT_DEBUG === '1';
      if (!nsEarly && tenantDebugEarly) {
        try {
          const ua = (req.get && req.get('user-agent')) || '';
          const ip = (req.ip || req.connection?.remoteAddress || '') + '';
          const seed = `${ua}::${ip}`.trim() || 'fallback';
          const crypto = require('crypto');
          const hash = crypto.createHash('sha1').update(seed).digest('hex').slice(0,16);
          nsEarly = `__earlydbg_${hash}`;
          if (!req.ns) req.ns = {};
          req.ns.admin = nsEarly;
          try { console.warn('[external-notifications][debug] early synthesized namespace', { ns: nsEarly }); } catch {}
        } catch (e) {
          try { console.warn('[external-notifications][debug] early synthesis failed', e?.message || e); } catch {}
        }
      }
      if (shouldRequireSession) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      if (requireAdminWrites) {
        const isAdmin = !!(req?.auth && req.auth.isAdmin);
        if (!isAdmin) return res.status(401).json({ success: false, error: 'admin_required' });
      }

      const body = req.body || {};
      const norm = (v) => (typeof v === 'string' ? v.trim() : undefined);
      const normalized = {
        discordWebhook: norm(body.discordWebhook), // '' means clear
        telegramBotToken: norm(body.telegramBotToken), // '' means clear
        telegramChatId: norm(body.telegramChatId), // '' means clear
        template: typeof body.template === 'string' ? body.template : undefined,
        liveDiscordWebhook: norm(body.liveDiscordWebhook), // '' means clear
        liveTelegramBotToken: norm(body.liveTelegramBotToken), // '' means clear
        liveTelegramChatId: norm(body.liveTelegramChatId) // '' means clear
      };
      const schema = z.object({
        discordWebhook: z.union([z.string().url(), z.literal('')]).optional(),
        telegramBotToken: z.union([z.string(), z.literal('')]).optional(),
        telegramChatId: z.union([z.string(), z.literal('')]).optional(),
        template: z.string().optional(),
        liveDiscordWebhook: z.union([z.string().url(), z.literal('')]).optional(),
        liveTelegramBotToken: z.union([z.string(), z.literal('')]).optional(),
        liveTelegramChatId: z.union([z.string(), z.literal('')]).optional()
      });
      const parsed = schema.safeParse(normalized);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid payload' });
      const { discordWebhook, telegramBotToken, telegramChatId, template, liveDiscordWebhook, liveTelegramBotToken, liveTelegramChatId } = parsed.data;

      let ns = req?.ns?.admin || req?.ns?.pub || null;
      const tenantDebug = process.env.GETTY_TENANT_DEBUG === '1';
      if (!ns && tenantDebug) {
        try {
          const ua = (req.get && req.get('user-agent')) || '';
          const ip = (req.ip || req.connection?.remoteAddress || '') + '';
          const seed = `${ua}::${ip}`.trim() || 'fallback';
          const crypto = require('crypto');
          const hash = crypto.createHash('sha1').update(seed).digest('hex').slice(0,16);
          ns = `__debug_${hash}`;
          if (!req.ns) req.ns = {};
          req.ns.admin = ns;
          console.warn('[external-notifications][debug] synthesized namespace', { ns, seed });
        } catch (e) {
          console.warn('[external-notifications][debug] failed to synthesize namespace', e?.message || e);
        }
      }
      let existingData = {};
      let meta = null;
      if (ns) {
        try {
          const reqLike = { ns: { admin: ns } };
          const loaded = await loadTenantConfig(reqLike, null, GLOBAL_EXT_NOTIF_PATH, 'external-notifications-config.json');
          if (loaded && loaded.data) existingData = loaded.data;

        } catch {}
      } else if (store) {
        try { existingData = (await store.get(ns, 'external-notifications-config', null)) || {}; } catch {}
      } else {
        existingData = { template: externalNotifications.template || '' };
      }

      const merged = {
        discordWebhook: typeof discordWebhook === 'string' ? discordWebhook : (existingData.discordWebhook || ''),
        telegramBotToken: typeof telegramBotToken === 'string' ? telegramBotToken : (existingData.telegramBotToken || ''),
        telegramChatId: typeof telegramChatId === 'string' ? telegramChatId : (existingData.telegramChatId || ''),
        template: typeof template === 'string' ? template : (existingData.template || '🎉 New tip from {from}: {amount} AR (${usd}) - "{message}"'),
        liveDiscordWebhook: typeof liveDiscordWebhook === 'string' ? liveDiscordWebhook : (existingData.liveDiscordWebhook || ''),
        liveTelegramBotToken: typeof liveTelegramBotToken === 'string' ? liveTelegramBotToken : (existingData.liveTelegramBotToken || ''),
        liveTelegramChatId: typeof liveTelegramChatId === 'string' ? liveTelegramChatId : (existingData.liveTelegramChatId || '')
      };

      if (ns) {
        try {
          const reqLike = { ns: { admin: ns } };
          const saved = await saveTenantConfig(reqLike, null, GLOBAL_EXT_NOTIF_PATH, 'external-notifications-config.json', merged);
          if (saved && saved.meta) meta = { __version: saved.meta.__version, checksum: saved.meta.checksum, updatedAt: saved.meta.updatedAt, source: 'tenant-disk' };
          if (store && ns) {
            await store.set(ns, 'external-notifications-config', merged);
          }
        } catch (e) { console.error('Error saving external notifications config:', e); return res.status(500).json({ success:false, error:'save_failed' }); }
      } else if (store) {
        await store.set(ns, 'external-notifications-config', merged);
      } else {
        await externalNotifications.saveConfig(merged);
      }

      if (tenantDebug) {
        try {
          console.warn('[external-notifications][debug] save complete', { ns, hasMeta: !!meta, keys: Object.keys(merged) });
        } catch {}
      }
      res.json({ success: true, status: externalNotifications.getStatus(), meta, message: 'Settings saved successfully', ns: tenantDebug ? ns : undefined });
    } catch (error) {
      console.error('Error saving external notifications config:', error);
      res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
    }
  });

  app.get('/api/external-notifications', async (req, res) => {
    const ns = req?.ns?.admin || req?.ns?.pub || null;
    const hasNs = !!ns;
    let wrapperMeta = null;
    if (ns) {
      try {
        const reqLike = { ns: { admin: ns } };
        const loaded = await loadTenantConfig(reqLike, null, GLOBAL_EXT_NOTIF_PATH, 'external-notifications-config.json');
        if (loaded && loaded.data) {
          const cfg = loaded.data;
          const tenantLastTips = Array.isArray(cfg.lastTips) ? cfg.lastTips.slice(0,5) : [];
            const hasDiscordWebhook = !!(cfg.discordWebhook && String(cfg.discordWebhook).trim());
            const hasTelegramBotToken = !!(cfg.telegramBotToken && String(cfg.telegramBotToken).trim());
            const hasTelegramChatId = !!(cfg.telegramChatId && String(cfg.telegramChatId).trim());
            const hasLiveDiscordWebhook = !!(cfg.liveDiscordWebhook && String(cfg.liveDiscordWebhook).trim());
            const hasLiveTelegramBotToken = !!(cfg.liveTelegramBotToken && String(cfg.liveTelegramBotToken).trim());
            const hasLiveTelegramChatId = !!(cfg.liveTelegramChatId && String(cfg.liveTelegramChatId).trim());
          return res.json({
            active: !!(cfg.discordWebhook || (cfg.telegramBotToken && cfg.telegramChatId)),
            lastTips: tenantLastTips,
            config: {
              hasDiscord: hasDiscordWebhook,
              hasTelegram: !!(hasTelegramBotToken && hasTelegramChatId),
              hasDiscordWebhook,
              hasTelegramBotToken,
              hasTelegramChatId,
              template: cfg.template || '',
              discordWebhook: '',
              telegramBotToken: '',
              telegramChatId: '',
              hasLiveDiscord: hasLiveDiscordWebhook,
              hasLiveTelegram: !!(hasLiveTelegramBotToken && hasLiveTelegramChatId),
              hasLiveDiscordWebhook,
              hasLiveTelegramBotToken,
              hasLiveTelegramChatId,
              liveDiscordWebhook: '',
              liveTelegramBotToken: '',
              liveTelegramChatId: ''
            },
            meta: wrapperMeta,
            lastUpdated: (wrapperMeta && wrapperMeta.updatedAt) || new Date().toISOString()
          });
        }
      } catch {}
    }

    if (!hasNs && process.env.GETTY_TENANT_DEBUG === '1') {
      try {
        const ua = (req.get && req.get('user-agent')) || '';
        const ip = (req.ip || req.connection?.remoteAddress || '') + '';
        const seed = `${ua}::${ip}`.trim() || 'fallback';
        const crypto = require('crypto');
        const hash = crypto.createHash('sha1').update(seed).digest('hex').slice(0,16);
        const candidates = [
          `__earlydbg_${hash}`,
            `__debug_${hash}`,
            `__revealdbg_${hash}`
        ];
        for (const candidate of candidates) {
          try {
            const reqLike = { ns: { admin: candidate } };
            const loaded = await loadTenantConfig(reqLike, null, GLOBAL_EXT_NOTIF_PATH, 'external-notifications-config.json');
            if (loaded && loaded.data) {
              const cfg = loaded.data;
              const hasDiscordWebhook = !!(cfg.discordWebhook && String(cfg.discordWebhook).trim());
              const hasTelegramBotToken = !!(cfg.telegramBotToken && String(cfg.telegramBotToken).trim());
              const hasTelegramChatId = !!(cfg.telegramChatId && String(cfg.telegramChatId).trim());
              const hasLiveDiscordWebhook = !!(cfg.liveDiscordWebhook && String(cfg.liveDiscordWebhook).trim());
              const hasLiveTelegramBotToken = !!(cfg.liveTelegramBotToken && String(cfg.liveTelegramBotToken).trim());
              const hasLiveTelegramChatId = !!(cfg.liveTelegramChatId && String(cfg.liveTelegramChatId).trim());
              try { console.warn('[external-notifications][debug] GET synthesized candidate hit', { candidate }); } catch {}
              return res.json({
                active: !!(cfg.discordWebhook || (cfg.telegramBotToken && cfg.telegramChatId)),
                lastTips: [],
                config: {
                  hasDiscord: hasDiscordWebhook,
                  hasTelegram: !!(hasTelegramBotToken && hasTelegramChatId),
                  hasDiscordWebhook,
                  hasTelegramBotToken,
                  hasTelegramChatId,
                  template: cfg.template || '',
                  discordWebhook: '',
                  telegramBotToken: '',
                  telegramChatId: '',
                  hasLiveDiscord: hasLiveDiscordWebhook,
                  hasLiveTelegram: !!(hasLiveTelegramBotToken && hasLiveTelegramChatId),
                  hasLiveDiscordWebhook,
                  hasLiveTelegramBotToken,
                  hasLiveTelegramChatId,
                  liveDiscordWebhook: '',
                  liveTelegramBotToken: '',
                  liveTelegramChatId: ''
                },
                meta: null,
                lastUpdated: new Date().toISOString()
              });
            }
          } catch {}
        }
      } catch {}
    }

  const status = externalNotifications.getStatus();
  const sanitized = {
      active: !!status.active,
  lastTips: (hostedWithRedis || requireSessionFlag) && !hasNs ? [] : status.lastTips,
      config: {
        hasDiscord: !!status.config?.hasDiscord,
        hasTelegram: !!status.config?.hasTelegram,
        hasDiscordWebhook: !!status.config?.hasDiscord,
        hasTelegramBotToken: !!(externalNotifications.telegramBotToken),
        hasTelegramChatId: !!(externalNotifications.telegramChatId),
        template: status.config?.template || '',
        discordWebhook: '',
        telegramBotToken: '',
        telegramChatId: '',
        hasLiveDiscord: !!status.config?.hasLiveDiscord,
        hasLiveTelegram: !!status.config?.hasLiveTelegram,
        hasLiveDiscordWebhook: !!status.config?.hasLiveDiscord,
        hasLiveTelegramBotToken: !!(externalNotifications.liveTelegramBotToken),
        hasLiveTelegramChatId: !!(externalNotifications.liveTelegramChatId),
        liveDiscordWebhook: '',
        liveTelegramBotToken: '',
        liveTelegramChatId: ''
      },
      lastUpdated: status.lastUpdated
    };
    try {
      if (!sanitized.meta && wrapperMeta) sanitized.meta = wrapperMeta;
    } catch {}
    res.json(sanitized);
  });

  app.get('/api/external-notifications/reveal', async (req, res) => {
    try {
      const field = String(req.query.field || '').trim();
  const allowed = new Set(['discordWebhook','liveDiscordWebhook','telegramBotToken','liveTelegramBotToken','telegramChatId','liveTelegramChatId']);
      if (!allowed.has(field)) return res.status(400).json({ success:false, error:'invalid_field' });
      let ns = req?.ns?.admin || req?.ns?.pub || null;
      if (!ns && process.env.GETTY_TENANT_DEBUG === '1') {
        try {
          const ua = (req.get && req.get('user-agent')) || '';
          const ip = (req.ip || req.connection?.remoteAddress || '') + '';
          const seed = `${ua}::${ip}`.trim() || 'fallback';
          const crypto = require('crypto');
          const hash = crypto.createHash('sha1').update(seed).digest('hex').slice(0,16);
          ns = `__earlydbg_${hash}`;
          if (!req.ns) req.ns = {}; req.ns.admin = ns;
          try { console.warn('[external-notifications][debug] reveal synthesized namespace', { ns }); } catch {}
        } catch {}
      }
      if (!ns) return res.status(401).json({ success:false, error:'session_required' });
      const requireAdminWrites = ((process.env.GETTY_REQUIRE_ADMIN_WRITE === '1') || !!process.env.REDIS_URL) && !isOpenTestMode();
      if (requireAdminWrites) {
        const isAdmin = !!(req?.auth && req.auth.isAdmin);
        if (!isAdmin && process.env.GETTY_TENANT_DEBUG !== '1') return res.status(401).json({ success:false, error:'admin_required' });
      }
      const reqLike = { ns: { admin: ns } };
      let value = '';
      try {
        const loaded = await loadTenantConfig(reqLike, null, GLOBAL_EXT_NOTIF_PATH, 'external-notifications-config.json');
        if (loaded && loaded.data && typeof loaded.data[field] === 'string') value = loaded.data[field];
      } catch {}
      return res.json({ success:true, field, value });
    } catch {
      return res.status(500).json({ success:false, error:'reveal_failed' });
    }
  });

  app.get('/api/external-notifications/live/reveal', async (req, res) => {
    try {
      const field = String(req.query.field || 'discordWebhook').trim();
      if (field !== 'discordWebhook') return res.status(400).json({ success: false, error: 'invalid_field' });

      // Require session in hosted or require-session mode
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const shouldRequireSession = (requireSessionFlag || hosted) && !isOpenTestMode();
      let ns = req?.ns?.admin || req?.ns?.pub || null;
      if (!ns && process.env.GETTY_TENANT_DEBUG === '1') {
        try {
          const ua = (req.get && req.get('user-agent')) || '';
          const ip = (req.ip || req.connection?.remoteAddress || '') + '';
          const seed = `${ua}::${ip}`.trim() || 'fallback';
          const crypto = require('crypto');
          const hash = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16);
          ns = `__earlydbg_${hash}`;
          if (!req.ns) req.ns = {}; req.ns.admin = ns;
        } catch {}
      }
      if (shouldRequireSession && !ns) return res.status(401).json({ success: false, error: 'session_required' });

      const requireAdminWrites = ((process.env.GETTY_REQUIRE_ADMIN_WRITE === '1') || hosted) && !isOpenTestMode();
      if (requireAdminWrites) {
        const isAdmin = !!(req?.auth && req.auth.isAdmin);
        if (!isAdmin && process.env.GETTY_TENANT_DEBUG !== '1') return res.status(401).json({ success: false, error: 'admin_required' });
      }

      let value = '';
      try {
        if (ns) {
          const reqLike = { ns: { admin: ns } };
          const loaded = await loadTenantConfig(reqLike, null,
            path.join(process.cwd(), 'config', 'live-announcement-config.json'),
            'live-announcement-config.json'
          );
          if (loaded && loaded.data && typeof loaded.data.discordWebhook === 'string') {
            value = loaded.data.discordWebhook;
          } else if (store) {
            try {
              const draft = await store.get(ns, 'live-announcement-draft', null);
              if (draft && typeof draft.discordWebhook === 'string') value = draft.discordWebhook;
            } catch {}
          }
        } else {
          const fs = require('fs');
          const file = path.join(process.cwd(), 'config', 'live-announcement-config.json');
          if (fs.existsSync(file)) {
            try { const draft = JSON.parse(fs.readFileSync(file, 'utf8')); if (draft && draft.discordWebhook) value = draft.discordWebhook; } catch {}
          }
        }
      } catch {}

      return res.json({ success: true, field, value });
    } catch {
      return res.status(500).json({ success: false, error: 'reveal_failed' });
    }
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
      const shouldRequireSession = (requireSessionFlag || !!process.env.REDIS_URL) && !isOpenTestMode();
      if (shouldRequireSession) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      if (requireAdminWrites) {
        const isAdmin = !!(req?.auth && req.auth.isAdmin);
        if (!isAdmin) return res.status(401).json({ success: false, error: 'admin_required' });
      }
      const schema = z.object({
        title: z.string().max(150).optional(),
        description: z.string().max(200).optional(),
        channelUrl: z.string().url().optional(),
        imageUrl: z.string().url().or(z.string().regex(/^\/(?:uploads\/live-announcements\/).+/)).optional(),
        signature: z.string().max(80).optional(),
        discordWebhook: z.union([z.string().url(), z.literal('')]).optional(),
        livePostClaimId: z.string().min(1).max(80).optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'invalid_payload' });
      const payload = parsed.data;
      if (Object.prototype.hasOwnProperty.call(payload, 'discordWebhook') && payload.discordWebhook === '') {
        delete payload.discordWebhook; // treat empty as clearing override for this call
      }

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
      
      if (ns || (process.env.GETTY_MULTI_TENANT_WALLET === '1' && process.env.GETTY_AUTO_LIVE_TENANT_HASH)) {
        try {
          const reqLike = ns ? { ns: { admin: ns } } : { __forceWalletHash: process.env.GETTY_AUTO_LIVE_TENANT_HASH };
          const loaded = await loadTenantConfig(reqLike, null, GLOBAL_EXT_NOTIF_PATH, 'external-notifications-config.json');
          if (loaded && loaded.data) {
            cfg = loaded.data;
          }
        } catch {}
      }
      
      if (!cfg && store && ns) {
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

      const hasLiveDiscordWebhook = !!(cfg.liveDiscordWebhook && String(cfg.liveDiscordWebhook).trim());
      const hasLiveTelegramBotToken = !!(cfg.liveTelegramBotToken && String(cfg.liveTelegramBotToken).trim());
      const hasLiveTelegramChatId = !!(cfg.liveTelegramChatId && String(cfg.liveTelegramChatId).trim());
      
      cfg.hasLiveDiscord = hasLiveDiscordWebhook;
      cfg.hasLiveTelegram = !!(hasLiveTelegramBotToken && hasLiveTelegramChatId);

      let liveDraft = null;
      if (store && ns) {
        try { liveDraft = await store.get(ns, 'live-announcement-draft', null); } catch {}
      } else {
        try {
          const fs = require('fs'); const path = require('path');
          const file = path.join(process.cwd(), 'config', 'live-announcement-config.json');
          if (fs.existsSync(file)) liveDraft = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {}
      }

      if (!cfg.liveDiscordWebhook && liveDraft && typeof liveDraft.discordWebhook === 'string' && liveDraft.discordWebhook.trim()) {
        cfg.liveDiscordWebhook = liveDraft.discordWebhook.trim();
        cfg.hasLiveDiscord = true;
      }

      let draft = null;
      if (store && ns) {
        try { draft = await store.get(ns, 'live-announcement-draft', null); } catch {}
      } else if (process.env.GETTY_MULTI_TENANT_WALLET === '1' && process.env.GETTY_AUTO_LIVE_TENANT_HASH) {
        try {
          const reqLike = { __forceWalletHash: process.env.GETTY_AUTO_LIVE_TENANT_HASH };
          const loaded = await loadTenantConfig(reqLike, null, path.join(process.cwd(), 'config', 'live-announcement-config.json'), 'live-announcement-config.json');
          if (loaded && loaded.data) draft = loaded.data;
        } catch {}
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
      try {
        console.warn('[live/send] result', {
          ns,
          ok,
          usedWebhook: payload.discordWebhook ? 'override' : (cfg.liveDiscordWebhook ? 'global' : 'none'),
          telegram: !!(cfg.liveTelegramBotToken && cfg.liveTelegramChatId),
          title: payload.title,
          channelUrl: payload.channelUrl,
          livePostClaimId: payload.livePostClaimId
        });
      } catch {}
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
      const shouldRequireSession = (requireSessionFlag || !!process.env.REDIS_URL) && !isOpenTestMode();
      if (shouldRequireSession) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      if (requireAdminWrites) {
        const isAdmin = !!(req?.auth && req.auth.isAdmin);
        if (!isAdmin) return res.status(401).json({ success: false, error: 'admin_required' });
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
      if (payload && Object.prototype.hasOwnProperty.call(payload, 'discordWebhook') && payload.discordWebhook === '') {
        delete payload.discordWebhook; // treat empty as clearing override for test call
      }

      let draft = null;
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (store && ns) {
        try { draft = await store.get(ns, 'live-announcement-draft', null); } catch {}
      } else if (process.env.GETTY_MULTI_TENANT_WALLET === '1' && process.env.GETTY_AUTO_LIVE_TENANT_HASH) {
        try {
          const reqLike = { __forceWalletHash: process.env.GETTY_AUTO_LIVE_TENANT_HASH };
          const loaded = await loadTenantConfig(reqLike, null, path.join(process.cwd(), 'config', 'live-announcement-config.json'), 'live-announcement-config.json');
          if (loaded && loaded.data) draft = loaded.data;
        } catch {}
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
      
      if (ns || (process.env.GETTY_MULTI_TENANT_WALLET === '1' && process.env.GETTY_AUTO_LIVE_TENANT_HASH)) {
        try {
          const reqLike = ns ? { ns: { admin: ns } } : { __forceWalletHash: process.env.GETTY_AUTO_LIVE_TENANT_HASH };
          const loaded = await loadTenantConfig(reqLike, null, GLOBAL_EXT_NOTIF_PATH, 'external-notifications-config.json');
          if (loaded && loaded.data) {
            cfg = loaded.data;
          }
        } catch {}
      }
      
      if (!cfg && store && ns) {
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

      const hasLiveDiscordWebhook = !!(cfg.liveDiscordWebhook && String(cfg.liveDiscordWebhook).trim());
      const hasLiveTelegramBotToken = !!(cfg.liveTelegramBotToken && String(cfg.liveTelegramBotToken).trim());
      const hasLiveTelegramChatId = !!(cfg.liveTelegramChatId && String(cfg.liveTelegramChatId).trim());
      
      cfg.hasLiveDiscord = hasLiveDiscordWebhook;
      cfg.hasLiveTelegram = !!(hasLiveTelegramBotToken && hasLiveTelegramChatId);

      let liveDraft = null;
      if (store && ns) {
        try { liveDraft = await store.get(ns, 'live-announcement-draft', null); } catch {}
      } else {
        try {
          const fs = require('fs'); const path = require('path');
          const file = path.join(process.cwd(), 'config', 'live-announcement-config.json');
          if (fs.existsSync(file)) liveDraft = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {}
      }

      if (!cfg.liveDiscordWebhook && liveDraft && typeof liveDraft.discordWebhook === 'string' && liveDraft.discordWebhook.trim()) {
        cfg.liveDiscordWebhook = liveDraft.discordWebhook.trim();
        cfg.hasLiveDiscord = true;
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
      try {
        console.warn('[live/test] result', {
          ns,
          ok,
          title: payload.title,
          channelUrl: payload.channelUrl,
          livePostClaimId: payload.livePostClaimId,
          hasOverride: !!payload.discordWebhook,
          hasGlobal: !!cfg.liveDiscordWebhook
        });
      } catch {}
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
      const shouldRequireSession = (requireSessionFlag || hosted) && !isOpenTestMode();
      if (shouldRequireSession) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      if (requireAdminWrites) {
        const isAdmin = !!(req?.auth && req.auth.isAdmin);
        if (!isAdmin) return res.status(401).json({ success: false, error: 'admin_required' });
      }
      const schema = z.object({
        title: z.string().max(150).optional(),
        description: z.string().max(200).optional(),
        channelUrl: z.string().url().optional(),
        imageUrl: z.string().url().or(z.string().regex(/^\/(?:uploads\/live-announcements\/).+/)).optional(),
        signature: z.string().max(80).optional(),
        discordWebhook: z.union([z.string().url(), z.literal('')]).optional(),
        auto: z.boolean().optional(),
        livePostClaimId: z.string().min(1).max(80).optional()
      });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ success: false, error: 'invalid_payload' });
      const data = parsed.data || {};

      const clientIncludedDiscord = Object.prototype.hasOwnProperty.call(req.body || {}, 'discordWebhook');
      if (clientIncludedDiscord && (!data.discordWebhook || data.discordWebhook === '')) {
        data.discordWebhook = '';
      }

      const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (ns || (process.env.GETTY_MULTI_TENANT_WALLET === '1' && process.env.GETTY_AUTO_LIVE_TENANT_HASH)) {
        try {
          const reqLike = ns ? { ns: { admin: ns } } : { __forceWalletHash: process.env.GETTY_AUTO_LIVE_TENANT_HASH };
          const saved = await saveTenantConfig(reqLike, null,
            path.join(process.cwd(), 'config', 'live-announcement-config.json'),
            'live-announcement-config.json',
            data
          );
          if (store && ns) {
            await store.set(ns, 'live-announcement-draft', data);
          }

          try {
            if (store && store.redis && typeof data.auto === 'boolean') {
              const SET_KEY = 'getty:auto-live:namespaces';
              if (data.auto) {
                await store.redis.sadd(SET_KEY, ns);
                try { console.warn('[auto-live] registered namespace for auto', ns); } catch {}
              } else {
                await store.redis.srem(SET_KEY, ns);
                try { console.warn('[auto-live] unregistered namespace for auto', ns); } catch {}
              }
            }
          } catch {}
          return res.json({ success: true, meta: saved && saved.meta ? {
            __version: saved.meta.__version,
            checksum: saved.meta.checksum,
            updatedAt: saved.meta.updatedAt
          } : null });
        } catch (e) {
          console.error('[live/config] tenant save failed, fallback to legacy store/file', e?.message || e);
        }
      }

      if (store && ns) {
        await store.set(ns, 'live-announcement-draft', data);
      } else {
        const fs = require('fs'); const path = require('path');
        const cfgDir = path.join(process.cwd(), 'config');
        const file = path.join(cfgDir, 'live-announcement-config.json');
        if (!fs.existsSync(cfgDir)) fs.mkdirSync(cfgDir, { recursive: true });
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
      }

      try {
        if (store && store.redis && typeof data.auto === 'boolean') {
          const SET_KEY = 'getty:auto-live:namespaces';
          const ns = req?.ns?.admin || req?.ns?.pub || null;
          if (ns) {
            if (data.auto) {
              await store.redis.sadd(SET_KEY, ns);
              try { console.warn('[auto-live] registered namespace for auto (fallback)', ns); } catch {}
            } else {
              await store.redis.srem(SET_KEY, ns);
              try { console.warn('[auto-live] unregistered namespace for auto (fallback)', ns); } catch {}
            }
          }
        }
      } catch {}
      res.json({ success: true, meta: null });
    } catch (e) {
      console.error('Error saving live draft:', e);
      res.status(500).json({ success: false, error: 'internal_error' });
    }
  });

  app.get('/api/external-notifications/live/config', async (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const shouldRequireSession = (requireSessionFlag || hosted) && !isOpenTestMode();
      if (shouldRequireSession) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      let draft = null; let meta = null;
      if (ns) {
        try {
          const reqLike = { ns: { admin: ns } };
          const loaded = await loadTenantConfig(reqLike, null,
            path.join(process.cwd(), 'config', 'live-announcement-config.json'),
            'live-announcement-config.json'
          );
          if (loaded && loaded.data) {
            draft = loaded.data;
            if (loaded.meta) meta = {
              __version: loaded.meta.__version,
              checksum: loaded.meta.checksum,
              updatedAt: loaded.meta.updatedAt
            };
          }
        } catch {}
      }
      if (!draft) {
        if (store && ns) {
          try { draft = await store.get(ns, 'live-announcement-draft', null); } catch {}
        } else if (process.env.GETTY_MULTI_TENANT_WALLET === '1' && process.env.GETTY_AUTO_LIVE_TENANT_HASH) {
          try {
            const reqLike = { __forceWalletHash: process.env.GETTY_AUTO_LIVE_TENANT_HASH };
            const loaded = await loadTenantConfig(reqLike, null, path.join(process.cwd(), 'config', 'live-announcement-config.json'), 'live-announcement-config.json');
            if (loaded && loaded.data) draft = loaded.data;
          } catch {}
        }
        if (!draft) {
            try {
              const fs = require('fs'); const path = require('path');
              const file = path.join(process.cwd(), 'config', 'live-announcement-config.json');
              if (fs.existsSync(file)) draft = JSON.parse(fs.readFileSync(file, 'utf8'));
            } catch {}
        }
      }
      if (!draft) draft = {};
      const sanitized = {
        title: draft.title || '',
        description: draft.description || '',
        channelUrl: draft.channelUrl || '',
        imageUrl: draft.imageUrl || '',
        signature: draft.signature || '',
        discordWebhook: '',
        hasDiscordOverride: !!draft.discordWebhook,
        auto: !!draft.auto,
        livePostClaimId: typeof draft.livePostClaimId === 'string' ? draft.livePostClaimId : ''
      };
      res.json({ success: true, config: sanitized, meta });
  } catch {
      res.json({ success: true, config: { title:'', description:'', channelUrl:'', imageUrl:'', signature:'', discordWebhook:'', hasDiscordOverride:false } });
    }
  });

  app.post('/api/external-notifications/live/upload', async (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const shouldRequireSession = (requireSessionFlag || !!process.env.REDIS_URL) && !isOpenTestMode();
      if (shouldRequireSession) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      if (requireAdminWrites) {
        const isAdmin = !!(req?.auth && req.auth.isAdmin);
        if (!isAdmin) return res.status(401).json({ success: false, error: 'admin_required' });
      }
      const multer = require('multer');
      const { imageSize } = require('image-size');

      // Use memory storage for multer - files will be uploaded to Supabase
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 2 * 1024 * 1024, files: 1 },
        fileFilter: (_req, file, cb) => {
          const ok = /^image\/(png|jpe?g|webp)$/i.test(file.mimetype);
          cb(ok ? null : new Error('invalid_type'), ok);
        }
      }).single('image');

      upload(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, error: String(err.message || err) });
        if (!req.file) return res.status(400).json({ success: false, error: 'no_file' });

        try {
          // Validate image dimensions from buffer
          const dim = imageSize(req.file.buffer);
          if (!dim || !dim.width || !dim.height) throw new Error('invalid_image');
          if (dim.width > 1920 || dim.height > 1080) {
            return res.status(400).json({ success: false, error: 'too_large_dimensions' });
          }

          // Upload to Supabase Storage
          const storage = getStorage();
          if (!storage) {
            return res.status(500).json({ success: false, error: 'Storage service not configured' });
          }

          const ns = req?.ns?.admin || req?.ns?.pub || null;
          const safeNs = ns ? ns.replace(/[^a-zA-Z0-9_-]/g, '_') : 'global';
          const filePath = `${safeNs}/live-announcement-${Date.now()}.${req.file.mimetype.split('/')[1]}`;

          const uploadResult = await storage.uploadFile('live-announcements', filePath, req.file.buffer, {
            contentType: req.file.mimetype
          });

          res.json({ success: true, url: uploadResult.publicUrl, width: dim.width, height: dim.height });
        } catch (uploadError) {
          console.error('Supabase upload error:', uploadError);
          return res.status(500).json({ success: false, error: 'Failed to upload file' });
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
        if (!hosted) {
          try {
            const { loadTenantConfig } = require('../lib/tenant-config');
            const reqCtx = (process.env.GETTY_MULTI_TENANT_WALLET === '1' && process.env.GETTY_AUTO_LIVE_TENANT_HASH)
              ? { __forceWalletHash: process.env.GETTY_AUTO_LIVE_TENANT_HASH }
              : {};
            const draftWrap = await loadTenantConfig(reqCtx, null, path.join(process.cwd(), 'config', 'live-announcement-config.json'), 'live-announcement-config.json');
            const extWrap = await loadTenantConfig(reqCtx, null, path.join(process.cwd(), 'config', 'external-notifications-config.json'), 'external-notifications-config.json');
            const shWrap = await loadTenantConfig(reqCtx, null, path.join(process.cwd(), 'config', 'stream-history-config.json'), 'stream-history-config.json');
            const lvWrap = await loadTenantConfig(reqCtx, null, path.join(process.cwd(), 'config', 'liveviews-config.json'), 'liveviews-config.json');
            const draft = draftWrap?.data || null;
            const ext = extWrap?.data || null;
            let claim = '';
            try { const c = shWrap?.data || {}; if (typeof c.claimid === 'string' && c.claimid.trim()) claim = c.claimid.trim(); } catch {}
            if (!claim) { try { const lv = lvWrap?.data || {}; if (typeof lv.claimid === 'string' && lv.claimid.trim()) claim = lv.claimid.trim(); } catch {} }

            const hasDiscord = !!(ext && typeof ext.liveDiscordWebhook === 'string' && ext.liveDiscordWebhook.trim());
            const hasTelegram = !!(ext && typeof ext.liveTelegramBotToken === 'string' && ext.liveTelegramBotToken.trim() && typeof ext.liveTelegramChatId === 'string' && ext.liveTelegramChatId.trim());
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
            return res.json({
              ok: true,
              hosted: false,
              ns: null,
              autoEnabled: !!draft?.auto,
              registered: false,
              lastPoll: null,
              hasDiscord,
              hasTelegram,
              hasDiscordOverride,
              hasAnyLiveTarget,
              hasImageUrl,
              imageUrl,
              ogCandidate,
              livePostClaimId,
              claimFromUrl,
              claimMatch,
              claimFromConfig: claim
            });
          } catch {}
        }
        const reason = !hosted ? 'not_hosted' : (!store ? 'no_store' : (!store.redis ? 'no_redis' : (!ns ? 'no_session' : 'unavailable')));
        return res.json({ ok: false, hosted, reason });
      }
      const AUTO_SET = 'getty:auto-live:namespaces';
      const LAST_POLL_KEY = 'getty:auto-live:lastpoll';
      const inSet = await store.redis.sismember(AUTO_SET, ns);
      const lastPoll = await store.redis.hget(LAST_POLL_KEY, ns);

      let prevLive = null;
      try {
        const lastStateRaw = await store.redis.get('getty:auto-live:laststate');
        if (lastStateRaw) {
          const obj = JSON.parse(lastStateRaw);
          if (Object.prototype.hasOwnProperty.call(obj || {}, ns)) {
            prevLive = !!obj[ns];
          }
        }
      } catch {}
      let draft = null;
      if (ns) {
        try {
          const reqLike = { ns: { admin: ns } };
          const loaded = await loadTenantConfig(reqLike, null,
            path.join(process.cwd(), 'config', 'live-announcement-config.json'),
            'live-announcement-config.json'
          );
          if (loaded && loaded.data) draft = loaded.data;
        } catch {}
      }
      if (!draft && store && ns) {
        try { draft = await store.get(ns, 'live-announcement-draft', null); } catch {}
      }
  let ext = null;
      if (ns) {
        try {
          const reqLike = { ns: { admin: ns } };
          const loaded = await loadTenantConfig(reqLike, null, GLOBAL_EXT_NOTIF_PATH, 'external-notifications-config.json');
          if (loaded && loaded.data) ext = loaded.data;
        } catch {}
      }
      if (!ext && store && ns) {
        try { ext = await store.get(ns, 'external-notifications-config', null); } catch {}
      }
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
      let claimFromConfig = '';
      try {
        const reqLike = { ns: { admin: ns } };
        const shLoaded = await loadTenantConfig(reqLike, null, path.join(process.cwd(), 'config', 'stream-history-config.json'), 'stream-history-config.json');
        if (shLoaded && shLoaded.data && typeof shLoaded.data.claimid === 'string' && shLoaded.data.claimid.trim()) claimFromConfig = shLoaded.data.claimid.trim();
      } catch {}
      if (!claimFromConfig) {
        try {
          const reqLike = { ns: { admin: ns } };
          const lvLoaded = await loadTenantConfig(reqLike, null, path.join(process.cwd(), 'config', 'liveviews-config.json'), 'liveviews-config.json');
          if (lvLoaded && lvLoaded.data && typeof lvLoaded.data.claimid === 'string' && lvLoaded.data.claimid.trim()) claimFromConfig = lvLoaded.data.claimid.trim();
        } catch {}
      }
      if (!claimFromConfig && store && ns) {
        try { const sh = await store.get(ns, 'stream-history-config', null); if (sh && typeof sh.claimid === 'string' && sh.claimid.trim()) claimFromConfig = sh.claimid.trim(); } catch {}
        if (!claimFromConfig) { try { const lv = await store.get(ns, 'liveviews-config', null); if (lv && typeof lv.claimid === 'string' && lv.claimid.trim()) claimFromConfig = lv.claimid.trim(); } catch {} }
      }
      let resolvedChannelClaimId = '';
      try {
        const axios = require('axios');
        const parse = (url) => {
          try {
            const u = new URL(url);
            if (!/^https?:$/i.test(u.protocol)) return { name: '', short: '' };
            if (!/^(www\.)?odysee\.com$/i.test(u.hostname)) return { name: '', short: '' };
            const parts = u.pathname.split('/').filter(Boolean);
            if (!parts.length) return { name: '', short: '' };
            const m = parts[0].match(/^@([^:]+):?([^/]*)/i);
            if (!m) return { name: '', short: '' };
            return { name: m[1] || '', short: m[2] || '' };
          } catch { return { name: '', short: '' }; }
        };
        if (channelUrl) {
          const { name, short } = parse(channelUrl);
          if (name) {
            const lbry = `lbry://@${name}${short ? ('#' + short) : ''}`;
            try {
              const r = await axios.post('https://api.na-backend.odysee.com/api/v1/proxy', { method: 'resolve', params: { urls: [lbry] } }, { timeout: 5000 });
              const result = r?.data?.result || r?.data?.data?.result || {};
              const entry = result[lbry];
              const cid = entry?.value?.claim_id || entry?.claim_id || '';
              if (cid && /^[a-f0-9]{40}$/i.test(cid)) resolvedChannelClaimId = cid;
            } catch {}
          }
        }
        if (!resolvedChannelClaimId && claimFromConfig) {
          try {
            const r2 = await axios.post('https://api.na-backend.odysee.com/api/v1/proxy', { method: 'claim_search', params: { claim_ids: [claimFromConfig], no_totals: true, page_size: 1 } }, { timeout: 5000 });
            const items = r2?.data?.result?.items || r2?.data?.data?.result?.items || [];
            const it = Array.isArray(items) && items[0] ? items[0] : null;
            const ch = it?.signing_channel || it?.publisher || it?.value?.signing_channel || null;
            const cid = ch?.claim_id || ch?.claimId || '';
            if (cid && /^[a-f0-9]{40}$/i.test(cid)) resolvedChannelClaimId = cid;
          } catch {}
        }
      } catch {}
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
        lastKnownLive: prevLive,
        hasDiscord,
        hasTelegram,
        hasDiscordOverride,
        hasAnyLiveTarget,
        hasImageUrl,
        imageUrl,
        ogCandidate,
        livePostClaimId,
        claimFromUrl,
        claimMatch,
        resolvedChannelClaimId
      });
    } catch (e) {
      res.json({ ok: false, error: e?.message || String(e) });
    }
  });

  app.post('/api/external-notifications/live/clear-override', limiter, async (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const shouldRequireSession = (requireSessionFlag || hosted) && !isOpenTestMode();
      if (shouldRequireSession) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      if (requireAdminWrites) {
        const isAdmin = !!(req?.ns?.admin) || !!(req?.auth && req.auth.isAdmin);
        if (!isAdmin) return res.status(401).json({ success: false, error: 'admin_required' });
      }
      const target = (req.body && typeof req.body.target === 'string') ? req.body.target.toLowerCase() : 'discord';
      const allowed = new Set(['discord','all']);
      if (!allowed.has(target)) return res.status(400).json({ success: false, error: 'invalid_target' });

      const ns = req?.ns?.admin || req?.ns?.pub || null;
      let draft = null;
      if (store && ns) {
        try { draft = await store.get(ns, 'live-announcement-draft', null); } catch {}
      } else if (process.env.GETTY_MULTI_TENANT_WALLET === '1' && process.env.GETTY_AUTO_LIVE_TENANT_HASH) {
        try {
          const reqLike = { __forceWalletHash: process.env.GETTY_AUTO_LIVE_TENANT_HASH };
          const loaded = await loadTenantConfig(reqLike, null, path.join(process.cwd(), 'config', 'live-announcement-config.json'), 'live-announcement-config.json');
          if (loaded && loaded.data) draft = loaded.data;
        } catch {}
      } else {
        try {
          const fs = require('fs'); const path = require('path');
            const file = path.join(process.cwd(), 'config', 'live-announcement-config.json');
            if (fs.existsSync(file)) draft = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {}
      }
      if (!draft) draft = {};

      const removed = [];
      if (target === 'discord' || target === 'all') {
        if (draft.discordWebhook) removed.push('discordWebhook');
        delete draft.discordWebhook;
      }

      if (store && ns) {
        await store.set(ns, 'live-announcement-draft', draft);
      } else if (process.env.GETTY_MULTI_TENANT_WALLET === '1' && process.env.GETTY_AUTO_LIVE_TENANT_HASH) {
        try {
          const reqLike = { __forceWalletHash: process.env.GETTY_AUTO_LIVE_TENANT_HASH };
          await saveTenantConfig(reqLike, null, path.join(process.cwd(), 'config', 'live-announcement-config.json'), 'live-announcement-config.json', draft);
        } catch {}
      } else {
        try {
          const fs = require('fs'); const path = require('path');
          const cfgDir = path.join(process.cwd(), 'config');
          const file = path.join(cfgDir, 'live-announcement-config.json');
          if (!fs.existsSync(cfgDir)) fs.mkdirSync(cfgDir, { recursive: true });
          fs.writeFileSync(file, JSON.stringify(draft, null, 2));
        } catch {}
      }

      try {
        console.warn('[live/clear-override] cleared', { ns, target, removed });
      } catch {}
      return res.json({ success: true, removed });
    } catch (e) {
      console.error('[live/clear-override] error', e?.message || e);
      res.status(500).json({ success: false, error: 'internal_error' });
    }
  });

  app.post('/api/external-notifications/live/reset-state', limiter, async (req, res) => {
    try {
      const hosted = !!process.env.REDIS_URL;
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (!hosted || !store || !store.redis) return res.status(400).json({ success: false, error: 'not_hosted' });
      if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      if (requireAdminWrites) {
        const isAdmin = !!(req?.auth && req.auth.isAdmin);
        if (!isAdmin) return res.status(401).json({ success: false, error: 'admin_required' });
      }
      try {
        const key = 'getty:auto-live:laststate';
        const raw = await store.redis.get(key);
        let obj = raw ? JSON.parse(raw) : {};
        if (obj && Object.prototype.hasOwnProperty.call(obj, ns)) delete obj[ns];
        await store.redis.set(key, JSON.stringify(obj), 'EX', 24 * 3600);
        try { console.warn('[auto-live] reset-state for ns', ns); } catch {}
        return res.json({ success: true });
      } catch (e) {
        return res.status(500).json({ success: false, error: 'reset_failed', details: e?.message || String(e) });
      }
    } catch (e) {
      return res.status(500).json({ success: false, error: 'internal_error', details: e?.message || String(e) });
    }
  });
}

module.exports = registerExternalNotificationsRoutes;
