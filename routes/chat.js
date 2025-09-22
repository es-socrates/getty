const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { shouldMaskSensitive, isTrustedLocalAdmin } = require('../lib/trust');
const { loadTenantConfig, saveTenantConfig } = require('../lib/tenant-config');
const { isOpenTestMode } = require('../lib/test-open-mode');
const { writeHybridConfig, readHybridConfig } = require('../lib/hybrid-config');

function registerChatRoutes(app, chat, limiter, chatConfigFilePath, options = {}) {
  const store = options.store;
  const chatNs = options.chatNs;
  const CHAT_CONFIG_FILE = chatConfigFilePath || path.join(process.cwd(), 'config', 'chat-config.json');

  function __requireSessionFlag() { return process.env.GETTY_REQUIRE_SESSION === '1'; }
  function __hostedWithRedis() { return !!process.env.REDIS_URL; }
  function __shouldRequireSession() { return (__requireSessionFlag() || __hostedWithRedis()); }

  app.get('/api/chat-config', async (req, res) => {
    try {
      const ns = (req.ns && (req.ns.admin || req.ns.pub)) ? (req.ns.admin || req.ns.pub) : null;
      let loaded = null; let meta = null; let source = 'global';
      try {
        const lt = await loadTenantConfig({ ns: { admin: ns } }, store, CHAT_CONFIG_FILE, 'chat-config.json');
        loaded = lt.data?.data ? lt.data.data : lt.data;
        source = lt.source;
        if (lt.tenantPath && fs.existsSync(lt.tenantPath)) {
          try {
            const raw = JSON.parse(fs.readFileSync(lt.tenantPath, 'utf8'));
            meta = { __version: raw.__version, checksum: raw.checksum, updatedAt: raw.updatedAt, source };
          } catch {}
        } else if (fs.existsSync(CHAT_CONFIG_FILE)) {
          try {
            const raw = JSON.parse(fs.readFileSync(CHAT_CONFIG_FILE, 'utf8'));
            if (raw && (raw.__version || raw.checksum)) meta = { __version: raw.__version, checksum: raw.checksum, updatedAt: raw.updatedAt, source };
          } catch {}
        }
      } catch {}
      let config = loaded && typeof loaded === 'object' ? loaded : {};
      config.themeCSS = config.themeCSS || '';

      const hasNs = !!ns;
      const conceal = shouldMaskSensitive(req);
      if (conceal && !isTrustedLocalAdmin(req) && !hasNs) {
        const sanitized = {
          bgColor: config.bgColor || '#080c10',
          msgBgColor: config.msgBgColor || '#0a0e12',
          msgBgAltColor: config.msgBgAltColor || '#0d1114',
          borderColor: config.borderColor || '#161b22',
          textColor: config.textColor || '#e6edf3',
          usernameColor: typeof config.usernameColor === 'string' ? config.usernameColor : '',
          usernameBgColor: typeof config.usernameBgColor === 'string' ? config.usernameBgColor : '',
          donationColor: config.donationColor || '#ddb826',
          donationBgColor: config.donationBgColor || '#131313',
          themeCSS: config.themeCSS || '',
          avatarRandomBg: !!config.avatarRandomBg,
          chatUrl: '',
          odyseeWsUrl: ''
        };
        return res.json(meta ? { meta, ...sanitized } : sanitized);
      }
      return res.json(meta ? { meta, ...config } : config);
    } catch (e) {
      res.status(500).json({ error: 'Error loading chat config', details: e.message });
    }
  });

  app.post('/api/chat', limiter, async (req, res) => {
    try {
      if (!isOpenTestMode() && __shouldRequireSession()) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (!ns) return res.status(401).json({ error: 'session_required' });
      }
      const schema = z.object({
        chatUrl: z.string().min(1),
        odyseeWsUrl: z.string().url().optional(),
        bgColor: z.string().optional(),
        msgBgColor: z.string().optional(),
        msgBgAltColor: z.string().optional(),
        borderColor: z.string().optional(),
        textColor: z.string().optional(),
        usernameColor: z.string().optional(),
        usernameBgColor: z.string().optional(),
        donationColor: z.string().optional(),
        donationBgColor: z.string().optional(),
        themeCSS: z.string().max(20000).optional(),
        avatarRandomBg: z.boolean().optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid chat config' });
      const { odyseeWsUrl, bgColor, msgBgColor, msgBgAltColor, borderColor, textColor, usernameColor, usernameBgColor, donationColor, donationBgColor, avatarRandomBg } = parsed.data;
      const chatUrl = (parsed.data.chatUrl || '').trim();
      let { themeCSS } = parsed.data;
      if (!chatUrl) {
        return res.status(400).json({ error: 'Chat URL is required' });
      }

      function sanitizeThemeCSS(input) {
        if (typeof input !== 'string') return '';
        let out = input.replace(/\0/g, '');
        out = out.replace(/@import[^;]*;?/gi, '').replace(/@charset[^;]*;?/gi, '');
        out = out.replace(/expression\s*\([^)]*\)/gi, '');
        out = out.replace(/url\(([^)]*?)javascript:[^)]+\)/gi, '');
        out = out.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        return out.trim();
      }
  if (typeof themeCSS === 'string') {
        themeCSS = sanitizeThemeCSS(themeCSS).slice(0, 20000);
      }

  let config = {};
      let ns = (req.ns && req.ns.admin) ? req.ns.admin : null;
      try {
        const lt = await loadTenantConfig({ ns: { admin: ns } }, store, CHAT_CONFIG_FILE, 'chat-config.json');
        const base = lt.data?.data ? lt.data.data : lt.data;
        if (base && typeof base === 'object') config = base;

      } catch {}

      const newConfig = {
        ...config,
        chatUrl,
        odyseeWsUrl: odyseeWsUrl || config.odyseeWsUrl || '',
        bgColor: bgColor || config.bgColor || '#080c10',
        msgBgColor: msgBgColor || config.msgBgColor || '#0a0e12',
        msgBgAltColor: msgBgAltColor || config.msgBgAltColor || '#0d1114',
        borderColor: borderColor || config.borderColor || '#161b22',
        textColor: textColor || config.textColor || '#e6edf3',
        usernameColor: (usernameColor !== undefined) ? usernameColor : (config.usernameColor ?? ''),
        usernameBgColor: (usernameBgColor !== undefined) ? usernameBgColor : (config.usernameBgColor ?? ''),
        donationColor: donationColor || config.donationColor || '#ddb826',
        donationBgColor: donationBgColor || config.donationBgColor || '#131313',
        themeCSS: typeof themeCSS === 'string' ? themeCSS : (config.themeCSS || ''),
        avatarRandomBg: (avatarRandomBg !== undefined) ? !!avatarRandomBg : !!config.avatarRandomBg
      };
      const isHosted = !!(store && req.ns && req.ns.admin);
      let prevUrl = null;
      if (isHosted) {
        try { const stPrev = await store.get(ns, 'chat-config', null); prevUrl = stPrev?.chatUrl || null; } catch {}
      }
      let meta = null;
      if (isHosted) {
        try {
          const saveRes = await saveTenantConfig({ ns: { admin: ns } }, store, CHAT_CONFIG_FILE, 'chat-config.json', newConfig);
          meta = saveRes.meta;
        } catch {
          await store.set(ns, 'chat-config', newConfig);
        }
      } else {
        try {
          const saveRes = await saveTenantConfig({ ns: { admin: null } }, store, CHAT_CONFIG_FILE, 'chat-config.json', newConfig);
          meta = saveRes.meta;
        } catch {
          try {
            const saveRes = writeHybridConfig(CHAT_CONFIG_FILE, newConfig);
            meta = saveRes.meta || meta;
          } catch {
            try { console.warn('[chat-config][save][fallback-flat] attempting fs.writeFileSync'); } catch {}
            try { fs.writeFileSync(CHAT_CONFIG_FILE, JSON.stringify(newConfig, null, 2)); } catch {}
          }
        }
      }
      let result = {};
      if (!isHosted) {
        result = chat.updateChatUrl(chatUrl) || {};
      }
      try {
        if (isHosted && chatNs) {
          const newUrl = chatUrl;
          const changed = (newUrl || '') !== (prevUrl || '');
          const st = chatNs.getStatus(ns) || {};
          const running = !!st.connected;
          if ((changed && newUrl) || (!running && newUrl)) {
            await chatNs.start(ns, newUrl);
            result = { ...(result||{}), relay: { started: true } };
          } else if ((changed && !newUrl) || (running && !newUrl)) {
            await chatNs.stop(ns);
            result = { ...(result||{}), relay: { stopped: true } };
          }
        }
      } catch (e) {
        result = { ...(result||{}), relayError: e?.message };
      }

      try {
        const wss = req.app?.get('wss');
        if (wss && typeof wss.broadcast === 'function') {
          if (ns) {
            try { wss.broadcast(ns, { type: 'chatConfigUpdate', data: newConfig, meta }); } catch {}
            try {
              const publicToken = await (store.get(ns, 'publicToken', null));
              if (typeof publicToken === 'string' && publicToken) {
                wss.broadcast(publicToken, { type: 'chatConfigUpdate', data: newConfig, meta });
              }
            } catch {}
          } else {
            try { wss.broadcast(null, { type: 'chatConfigUpdate', data: newConfig, meta }); } catch {}
          }
        }
      } catch {}
      res.json({ success: true, ...(meta ? { meta } : {}), ...newConfig, ...result });
    } catch (error) {
      console.error('Error updating chat:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });

  const CHAT_CUSTOM_THEMES_FILE = path.join(process.cwd(), 'config', 'chat-custom-themes.json');

  function sanitizeThemesArray(arr) {
    if (!Array.isArray(arr)) return [];
    const out = [];
    const nameSet = new Set();
    for (const raw of arr) {
      if (!raw || typeof raw.name !== 'string' || typeof raw.css !== 'string') continue;
      const name = raw.name.trim();
      if (!name || name.length > 100) continue;
      if (nameSet.has(name)) continue;
      const css = raw.css.slice(0, 50000);
      if (!css) continue;
      const updatedAt = (typeof raw.updatedAt === 'number' && isFinite(raw.updatedAt)) ? raw.updatedAt : Date.now();
      nameSet.add(name);
      out.push({ name, css, updatedAt });
      if (out.length >= 200) break;
    }
    return out;
  }

  async function loadStoredThemes(ns) {
    try {
      if (store && ns) {
        const arr = await store.get(ns, 'chat-custom-themes', []);
        return sanitizeThemesArray(arr);
      }
      if (fs.existsSync(CHAT_CUSTOM_THEMES_FILE)) {
        try {
          const hybrid = readHybridConfig(CHAT_CUSTOM_THEMES_FILE); // tolerant of legacy flat array
          const rawData = hybrid && Array.isArray(hybrid.data) ? hybrid.data : (hybrid.data || []);
          return sanitizeThemesArray(rawData);
        } catch {
          try {
            const rawLegacy = JSON.parse(fs.readFileSync(CHAT_CUSTOM_THEMES_FILE, 'utf8'));
            return sanitizeThemesArray(rawLegacy);
          } catch {}
        }
      }
    } catch { /* ignore */ }
    return [];
  }

  async function saveStoredThemes(ns, themes) {
    const sanitized = sanitizeThemesArray(themes);
    try {
      if (store && ns) {
        await store.set(ns, 'chat-custom-themes', sanitized);
      } else {
        try {
          writeHybridConfig(CHAT_CUSTOM_THEMES_FILE, sanitized);
        } catch {
          try { fs.writeFileSync(CHAT_CUSTOM_THEMES_FILE, JSON.stringify(sanitized, null, 2)); } catch {}
        }
      }
    } catch { /* ignore */ }
    return sanitized;
  }

  app.get('/api/chat-custom-themes', async (req, res) => {
    try {
    const shouldRequire = __shouldRequireSession() && !isOpenTestMode();
      const ns = (req.ns && (req.ns.admin || req.ns.pub)) ? (req.ns.admin || req.ns.pub) : null;
      if (shouldRequire && !ns) return res.status(401).json({ error: 'session_required' });
      const list = await loadStoredThemes( (store && ns && req.ns?.admin) ? req.ns.admin : null );
      res.json({ themes: list, count: list.length });
    } catch (e) {
      res.status(500).json({ error: 'failed_to_load_custom_themes', details: e?.message });
    }
  });

  app.post('/api/chat-custom-themes', limiter, async (req, res) => {
    try {
    const shouldRequire = __shouldRequireSession() && !isOpenTestMode();
      const ns = (req.ns && (req.ns.admin || req.ns.pub)) ? (req.ns.admin || req.ns.pub) : null;
      if (shouldRequire && !ns) return res.status(401).json({ error: 'session_required' });
      const payload = req.body || {};
      const themes = Array.isArray(payload.themes) ? payload.themes : [];
      if (themes.length > 500) {
        return res.status(400).json({ error: 'too_many_themes' });
      }
      const sanitized = sanitizeThemesArray(themes);
      if (sanitized.length !== themes.length && themes.length > 0 && sanitized.length === 0) {
        return res.status(400).json({ error: 'invalid_payload' });
      }
      const saved = await saveStoredThemes( (store && ns && req.ns?.admin) ? req.ns.admin : null, sanitized );
      res.json({ ok: true, count: saved.length });
    } catch (e) {
      res.status(500).json({ error: 'failed_to_save_custom_themes', details: e?.message });
    }
  });
}

module.exports = registerChatRoutes;
