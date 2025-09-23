const { z } = require('zod');
const { isTrustedLocalAdmin, shouldMaskSensitive } = require('../lib/trust');
const path = require('path');
const { saveTenantConfig, loadTenantConfig } = require('../lib/tenant-config');

async function resolveNsFromReq(req) {
  try {
    const direct = req?.ns?.admin || req?.ns?.pub || null;
    if (direct) return direct;
    const token = typeof req.query?.token === 'string' ? req.query.token : null;
    if (token && req.app && req.app.get && req.app.get('store')) {
      const st = req.app.get('store');
      try {
        const meta = await st.get(token, 'meta', null);
        if (meta) return token;
      } catch {}
    }
  } catch {}
  return null;
}

function registerSocialMediaRoutes(app, socialMediaModule, strictLimiter, options = {}) {
  const { isOpenTestMode } = require('../lib/test-open-mode');
  const store = options.store || null;
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const hostedWithRedis = !!process.env.REDIS_URL;
  const shouldRequireSession = requireSessionFlag || hostedWithRedis;
  const requireAdminWrites = (process.env.GETTY_REQUIRE_ADMIN_WRITE === '1') || hostedWithRedis;

  app.get('/api/socialmedia-config', async (req, res) => {
    try {
      const ns = await resolveNsFromReq(req);
      const trustedLocalAdmin = isTrustedLocalAdmin(req);
      const conceal = shouldMaskSensitive(req);

      const isAdminSession = !!(req?.auth && req.auth.isAdmin);
      if (conceal && !trustedLocalAdmin && !isAdminSession) {
        return res.json({ success: true, config: [] });
      }
      let config = null;
      let meta = null;
      const globalPath = path.join(process.cwd(), 'config', 'socialmedia-config.json');
      if (store && ns) {
        const loaded = await store.getConfig(ns, 'socialmedia-config.json', null) || await store.get(ns, 'socialmedia-config', null);
        if (loaded) {
          config = loaded.data ? loaded.data : loaded;
        }
      }

      if (!config) {
        const ltReq = ns ? { ...req, ns: { admin: ns } } : req;
        const lt = await loadTenantConfig(ltReq, store, globalPath, 'socialmedia-config.json');
        const raw = lt.data?.data ? lt.data.data : lt.data;
        config = raw || socialMediaModule.loadConfig();
        if (lt && lt.data && (lt.data.__version || lt.data.checksum || lt.data.updatedAt)) {
          meta = {
            __version: lt.data.__version,
            checksum: lt.data.checksum,
            updatedAt: lt.data.updatedAt,
            source: lt.source
          };
        }
      } else {
        try {
          const ltReq = ns ? { ns: { admin: ns } } : {};
            const lt = await loadTenantConfig(ltReq, store, globalPath, 'socialmedia-config.json');
            if (lt && lt.data && (lt.data.__version || lt.data.checksum || lt.data.updatedAt)) {
              meta = {
                __version: lt.data.__version,
                checksum: lt.data.checksum,
                updatedAt: lt.data.updatedAt,
                source: lt.source
              };
            }
        } catch {}
      }
      if (!meta) {
        try {
          const { computeChecksum } = require('../lib/tenant-config');
          meta = { __version: 1, checksum: computeChecksum({ config }), updatedAt: new Date().toISOString(), source: 'memory' };
        } catch {}
      }

      if (!Array.isArray(config)) {
        if (config && typeof config === 'object' && Array.isArray(config.data)) {
          config = config.data;
        } else {
          config = [];
        }
      }
      res.json({ success: true, config: config, meta });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/socialmedia-config', strictLimiter, async (req, res) => {
    try {
  if (!isOpenTestMode() && shouldRequireSession) {
        const nsCheck = await resolveNsFromReq(req);
        if (!nsCheck) return res.status(401).json({ success: false, error: 'session_required' });
      }
      if (requireAdminWrites) {
        const isAdmin = !!(req?.auth && req.auth.isAdmin);
        if (!isAdmin) return res.status(401).json({ success: false, error: 'admin_required' });
      }

      const env = process.env.NODE_ENV || 'development';
      const enforceHttpsOnly = (process.env.SOCIALMEDIA_HTTPS_ONLY === 'true') || env === 'production';
      const AdminItem = z.object({
        name: z.string(),
        icon: z.string(),
        link: z.string().url(),
        customIcon: z.string().optional()
      });
      const LegacyItem = z.object({
        platform: z.string(),
        enabled: z.boolean().optional(),
        url: z.string().url().optional(),
        handle: z.string().optional()
      });
      const schema = z.object({
        config: z.array(z.union([AdminItem, LegacyItem]))
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid config format' });
      const { config } = parsed.data;

      if (!Array.isArray(config) || config.length > 50) {
        return res.status(400).json({ success: false, error: 'Too many items (max 50)' });
      }

      const knownIcons = new Set(['x', 'instagram', 'youtube', 'telegram', 'discord', 'odysee', 'rumble']);
      const guessIcon = (platform) => {
        const key = String(platform || '').toLowerCase();
        if (knownIcons.has(key)) return key;
        if (key === 'twitter') return 'x';
        return 'custom';
      };
      const normalizedPreTrim = config.map(item => {
        if ('name' in item && 'icon' in item && 'link' in item) {
      const iconLc = String(item.icon || '').toLowerCase();
      const normalizedIcon = knownIcons.has(iconLc) || iconLc === 'custom' ? iconLc : 'custom';
      return { ...item, icon: normalizedIcon };
        }

        return {
          name: item.platform,
          icon: guessIcon(item.platform),
          link: item.url || '',
          customIcon: undefined
        };
      });

      const normalized = normalizedPreTrim.map(it => ({
        name: String(it.name || '').trim(),
        icon: String(it.icon || '').trim(),
        link: String(it.link || '').trim(),
        ...(it.customIcon ? { customIcon: String(it.customIcon).trim() } : {})
      }));

      const MAX_NAME = 50;
      const MAX_LINK = 2000;
      const MAX_CUSTOM_ICON_CHARS = 150_000;
      for (const [idx, item] of normalized.entries()) {
        if (!item.name) {
          console.warn('[socialmedia] reject:', { idx: idx + 1, reason: 'missing name' });
          return res.status(400).json({ success: false, error: `Item ${idx + 1}: name is required` });
        }
        if (item.name.length > MAX_NAME) {
          console.warn('[socialmedia] reject:', { idx: idx + 1, reason: 'name too long', len: item.name.length });
          return res.status(400).json({ success: false, error: `Item ${idx + 1}: name is too long (max ${MAX_NAME})` });
        }
        if (!item.link) {
          console.warn('[socialmedia] reject:', { idx: idx + 1, reason: 'missing link' });
          return res.status(400).json({ success: false, error: `Item ${idx + 1}: link is required` });
        }
        if (item.link.length > MAX_LINK) {
          console.warn('[socialmedia] reject:', { idx: idx + 1, reason: 'link too long', len: item.link.length });
          return res.status(400).json({ success: false, error: `Item ${idx + 1}: link is too long (max ${MAX_LINK})` });
        }
        try {
          const u = new URL(item.link);
          if (enforceHttpsOnly) {
            const isLocalhost = (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
            if (!(u.protocol === 'https:' || (u.protocol === 'http:' && isLocalhost))) {
              throw new Error('Non-HTTPS link rejected');
            }
          } else {
            if (!(u.protocol === 'http:' || u.protocol === 'https:')) {
              throw new Error('Unsupported protocol');
            }
          }
        } catch {
          const msg = enforceHttpsOnly ? 'link must be a valid HTTPS URL' : 'link must be a valid URL (http/https)';
          console.warn('[socialmedia] reject:', { idx: idx + 1, reason: msg, link: item.link });
          return res.status(400).json({ success: false, error: `Item ${idx + 1}: ${msg}` });
        }
        const iconLc = String(item.icon || '').toLowerCase();
        if (!(knownIcons.has(iconLc) || iconLc === 'custom')) {
          item.icon = 'custom';
        } else {
          item.icon = iconLc;
        }
        if (item.icon === 'custom') {
          if (!item.customIcon || !item.customIcon.startsWith('data:image/')) {
            console.warn('[socialmedia] reject:', { idx: idx + 1, reason: 'invalid customIcon (not data:image/*)' });
            return res.status(400).json({ success: false, error: `Item ${idx + 1}: customIcon must be a data:image/* base64 URL` });
          }
          if (item.customIcon.length > MAX_CUSTOM_ICON_CHARS) {
            console.warn('[socialmedia] reject:', { idx: idx + 1, reason: 'customIcon too large', len: item.customIcon.length });
            return res.status(400).json({ success: false, error: `Item ${idx + 1}: customIcon is too large` });
          }
        } else {
          delete item.customIcon;
        }
      }

      const ns = await resolveNsFromReq(req);
      let meta = null;
      if (ns && store) {
        const globalPath = path.join(process.cwd(), 'config', 'socialmedia-config.json');
        await store.setConfig(ns, 'socialmedia-config.json', normalized);

        let forceHash = null;
        if (req.walletSession && req.walletSession.walletHash) {
          forceHash = req.walletSession.walletHash;
        } else {
          const h = [...ns].reduce((a,c)=>((a*33) ^ c.charCodeAt(0))>>>0,5381).toString(36);
          forceHash = h;
        }
        const fakeReq = { ns: { admin: ns }, walletSession: req.walletSession, tenant: req.tenant, __forceWalletHash: forceHash };
        const saveResult = await saveTenantConfig(fakeReq, store, globalPath, 'socialmedia-config.json', normalized);
        meta = saveResult && saveResult.meta;
      } else {
        socialMediaModule.saveConfig(normalized);
      }
  res.json({ success: true, ...(meta ? { meta } : {}) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/socialmedia-config', strictLimiter, async (req, res) => {
    try {
      const ns = await resolveNsFromReq(req);
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hostedWithRedis = !!process.env.REDIS_URL;
      const shouldRequireSession = requireSessionFlag || hostedWithRedis;
      const requireAdminWrites = (process.env.GETTY_REQUIRE_ADMIN_WRITE === '1') || hostedWithRedis;
  if (!isOpenTestMode() && shouldRequireSession && !ns) return res.status(401).json({ success: false, error: 'session_required' });
      if (requireAdminWrites && !(req?.auth && req.auth.isAdmin)) return res.status(401).json({ success: false, error: 'admin_required' });
      if (!ns || !store) {
        socialMediaModule.saveConfig([]);
        return res.json({ success: true, cleared: true, global: true });
      }
      const globalPath = path.join(process.cwd(), 'config', 'socialmedia-config.json');
      await store.setConfig(ns, 'socialmedia-config.json', []);
      const fakeReq = { ns: { admin: ns }, walletSession: req.walletSession, tenant: req.tenant };
      const saveResult = await saveTenantConfig(fakeReq, store, globalPath, 'socialmedia-config.json', []);
      if (process.env.GETTY_TENANT_DEBUG === '1') {
        try { console.warn('[socialmedia] cleared config', { ns, tenantPath: saveResult.tenantPath }); } catch {}
      }
      return res.json({ success: true, cleared: true, meta: saveResult.meta });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/socialmedia-config/:idx', strictLimiter, async (req, res) => {
    try {
      const ns = await resolveNsFromReq(req);
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hostedWithRedis = !!process.env.REDIS_URL;
      const shouldRequireSession = requireSessionFlag || hostedWithRedis;
      const requireAdminWrites = (process.env.GETTY_REQUIRE_ADMIN_WRITE === '1') || hostedWithRedis;
  if (!isOpenTestMode() && shouldRequireSession && !ns) return res.status(401).json({ success: false, error: 'session_required' });
      if (requireAdminWrites && !(req?.auth && req.auth.isAdmin)) return res.status(401).json({ success: false, error: 'admin_required' });
      const idx = parseInt(req.params.idx, 10);
      if (!Number.isFinite(idx) || idx < 0) return res.status(400).json({ success: false, error: 'invalid_index' });
      let items = [];
      if (store && ns) {
        const existing = await store.getConfig(ns, 'socialmedia-config.json', null) || await store.get(ns, 'socialmedia-config', null) || [];
        items = existing.data ? existing.data : existing;
      } else {
        items = socialMediaModule.loadConfig();
      }
      if (!Array.isArray(items)) items = [];
      if (idx >= items.length) return res.status(404).json({ success: false, error: 'index_out_of_range' });
      const removed = items.splice(idx, 1);
      const globalPath = path.join(process.cwd(), 'config', 'socialmedia-config.json');
      if (ns && store) {
        await store.setConfig(ns, 'socialmedia-config.json', items);
        const fakeReq = { ns: { admin: ns }, walletSession: req.walletSession, tenant: req.tenant };
        const saveResult = await saveTenantConfig(fakeReq, store, globalPath, 'socialmedia-config.json', items);
        if (process.env.GETTY_TENANT_DEBUG === '1') {
          try { console.warn('[socialmedia] removed index', { ns, idx, tenantPath: saveResult.tenantPath }); } catch {}
        }
        return res.json({ success: true, removed, meta: saveResult.meta, length: items.length });
      }
      socialMediaModule.saveConfig(items);
      return res.json({ success: true, removed, length: items.length, global: true });
    } catch (e) { return res.status(500).json({ success: false, error: e.message }); }
  });
}

module.exports = registerSocialMediaRoutes;
