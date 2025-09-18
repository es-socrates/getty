const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { shouldMaskSensitive, isTrustedLocalAdmin } = require('../lib/trust');

function registerChatRoutes(app, chat, limiter, chatConfigFilePath, options = {}) {
  const store = options.store;
  const chatNs = options.chatNs;
  const CHAT_CONFIG_FILE = chatConfigFilePath || path.join(process.cwd(), 'config', 'chat-config.json');
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const hostedWithRedis = !!process.env.REDIS_URL;

  app.get('/api/chat-config', async (req, res) => {
    try {
      let config = {};

      if (store && req.ns && (req.ns.admin || req.ns.pub)) {
        const ns = req.ns.admin || req.ns.pub;
        const st = await store.get(ns, 'chat-config', null);
        if (st && typeof st === 'object') config = st;
      } else if (fs.existsSync(CHAT_CONFIG_FILE)) {
        config = JSON.parse(fs.readFileSync(CHAT_CONFIG_FILE, 'utf8'));
      }
      config.themeCSS = config.themeCSS || '';

  const hasNs = !!(req.ns && (req.ns.admin || req.ns.pub));
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
        return res.json(sanitized);
      }

      res.json(config);
    } catch (e) {
      res.status(500).json({ error: 'Error loading chat config', details: e.message });
    }
  });

  app.post('/api/chat', limiter, async (req, res) => {
    try {
      if (hostedWithRedis || requireSessionFlag) {
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
      if (store && req.ns && req.ns.admin) {
        const st = await store.get(req.ns.admin, 'chat-config', null);
        if (st && typeof st === 'object') config = st;
      } else if (fs.existsSync(CHAT_CONFIG_FILE)) {
        config = JSON.parse(fs.readFileSync(CHAT_CONFIG_FILE, 'utf8'));
      }

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
      const ns = isHosted ? req.ns.admin : null;
      let prevUrl = null;
      if (isHosted) {
        try { const stPrev = await store.get(ns, 'chat-config', null); prevUrl = stPrev?.chatUrl || null; } catch {}
      }
      if (isHosted) {
        await store.set(req.ns.admin, 'chat-config', newConfig);
        try {
          const wss = req.app?.get('wss');
          if (wss && typeof wss.broadcast === 'function') {
            try { wss.broadcast(req.ns.admin, { type: 'chatConfigUpdate', data: newConfig }); } catch {}
            try {
              const publicToken = await (store.get(req.ns.admin, 'publicToken', null));
              if (typeof publicToken === 'string' && publicToken) {
                wss.broadcast(publicToken, { type: 'chatConfigUpdate', data: newConfig });
              }
            } catch {}
          }
        } catch {}
      } else {
        fs.writeFileSync(CHAT_CONFIG_FILE, JSON.stringify(newConfig, null, 2));
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
      res.json({ success: true, ...newConfig, ...result });
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
        const raw = JSON.parse(fs.readFileSync(CHAT_CUSTOM_THEMES_FILE, 'utf8'));
        return sanitizeThemesArray(raw);
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
        fs.writeFileSync(CHAT_CUSTOM_THEMES_FILE, JSON.stringify(sanitized, null, 2));
      }
    } catch { /* ignore */ }
    return sanitized;
  }

  app.get('/api/chat-custom-themes', async (req, res) => {
    try {
      const shouldRequire = requireSessionFlag || hostedWithRedis;
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
      const shouldRequire = requireSessionFlag || hostedWithRedis;
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
