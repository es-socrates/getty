const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { z } = require('zod');

const SETTINGS_FILE = path.join(process.cwd(), 'tts-settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      return {
        ttsEnabled: typeof settings.ttsEnabled === 'boolean' ? settings.ttsEnabled : true,
        ttsAllChat: typeof settings.ttsAllChat === 'boolean' ? settings.ttsAllChat : false,
        ttsLanguage: settings.ttsLanguage || 'en',
      };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return { ttsEnabled: true, ttsAllChat: false, ttsLanguage: 'en' };
}

function saveSettings(newSettings) {
  let current = {};
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      current = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error reading settings for merge:', error);
  }
  const merged = { ...current, ...newSettings };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

function registerTtsRoutes(app, wss, limiter, options = {}) {
  const { isOpenTestMode } = require('../lib/test-open-mode');
  const store = options.store;
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const hostedWithRedis = !!process.env.REDIS_URL;
  const shouldRequireSession = requireSessionFlag || hostedWithRedis;
  const requireAdminWrites = process.env.GETTY_REQUIRE_ADMIN_WRITE === '1' || hostedWithRedis;
  app.get('/api/tts-setting', async (req, res) => {
    const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
    if (!isOpenTestMode() && shouldRequireSession && !hasNs) {
      return res.json({ ttsEnabled: true, ttsAllChat: false });
    }

    if (store && hasNs) {
      const ns = req.ns.admin || req.ns.pub;
      const st = await store.get(ns, 'tts-settings', null);
      if (st && typeof st === 'object') {
        return res.json({ ttsEnabled: !!st.ttsEnabled, ttsAllChat: !!st.ttsAllChat });
      }
    }
    const settings = loadSettings();
    res.json({ ttsEnabled: settings.ttsEnabled, ttsAllChat: settings.ttsAllChat });
  });

  app.post('/api/tts-setting', limiter, async (req, res) => {
    if (!isOpenTestMode() && shouldRequireSession) {
      const nsCheck = req?.ns?.admin || req?.ns?.pub || null;
      if (!nsCheck) return res.status(401).json({ success: false, error: 'session_required' });
    }
    if (!isOpenTestMode() && requireAdminWrites) {
      const isAdmin = !!(req?.auth && req.auth.isAdmin);
      if (!isAdmin) return res.status(401).json({ success: false, error: 'admin_required' });
    }
    const bodySchema = z.object({
      ttsEnabled: z.coerce.boolean().optional(),
      ttsAllChat: z.coerce.boolean().optional(),
    });
    const parsed = bodySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }
    let { ttsEnabled, ttsAllChat } = parsed.data;

    if (typeof ttsEnabled === 'undefined' && typeof ttsAllChat === 'undefined') {
      ttsEnabled = false;
    }
    const toSave = {};
    if (typeof ttsEnabled !== 'undefined') toSave.ttsEnabled = ttsEnabled;
    if (typeof ttsAllChat !== 'undefined') toSave.ttsAllChat = ttsAllChat;
    if (store && req.ns && req.ns.admin) {
      const current = await store.get(req.ns.admin, 'tts-settings', {});
      await store.set(req.ns.admin, 'tts-settings', { ...current, ...toSave });
    } else {
      saveSettings(toSave);
    }

    const payload = {
      type: 'ttsSettingUpdate',
      data: {
        ...(typeof ttsEnabled !== 'undefined' ? { ttsEnabled: Boolean(ttsEnabled) } : {}),
        ...(typeof ttsAllChat !== 'undefined' ? { ttsAllChat: Boolean(ttsAllChat) } : {}),
      },
    };
    if (typeof wss.broadcast === 'function' && req.ns && (req.ns.admin || req.ns.pub)) {
      wss.broadcast(req.ns.admin || req.ns.pub, payload);
    } else {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(payload));
        }
      });
    }

    if (store && req.ns && req.ns.admin) {
      const latest = await store.get(req.ns.admin, 'tts-settings', {
        ttsEnabled: true,
        ttsAllChat: false,
      });
      return res.json({ success: true, ...latest, message: 'TTS setting updated successfully' });
    } else {
      const latest = loadSettings();
      return res.json({ success: true, ...latest, message: 'TTS setting updated successfully' });
    }
  });

  app.get('/api/tts-language', async (req, res) => {
    const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
    if (!isOpenTestMode() && shouldRequireSession && !hasNs) {
      return res.json({ ttsLanguage: 'en' });
    }

    if (store && hasNs) {
      const ns = req.ns.admin || req.ns.pub;
      const st = await store.get(ns, 'tts-settings', null);
      if (st && typeof st === 'object' && st.ttsLanguage) {
        return res.json({ ttsLanguage: st.ttsLanguage });
      }
    }
    const settings = loadSettings();
    res.json({ ttsLanguage: settings.ttsLanguage || 'en' });
  });

  app.post('/api/tts-language', limiter, async (req, res) => {
    if (!isOpenTestMode() && shouldRequireSession) {
      const nsCheck = req?.ns?.admin || req?.ns?.pub || null;
      if (!nsCheck) return res.status(401).json({ success: false, error: 'session_required' });
    }
    if (!isOpenTestMode() && requireAdminWrites) {
      const isAdmin = !!(req?.auth && req.auth.isAdmin);
      if (!isAdmin) return res.status(401).json({ success: false, error: 'admin_required' });
    }
    const bodySchema = z.object({ ttsLanguage: z.enum(['en', 'es']) });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid ttsLanguage value' });
    }
    const { ttsLanguage } = parsed.data;
    if (store && req.ns && req.ns.admin) {
      const current = await store.get(req.ns.admin, 'tts-settings', {});
      await store.set(req.ns.admin, 'tts-settings', { ...current, ttsLanguage });
    } else {
      saveSettings({ ttsLanguage });
    }

    const payload = { type: 'ttsLanguageUpdate', data: { ttsLanguage } };
    if (typeof wss.broadcast === 'function' && req.ns && (req.ns.admin || req.ns.pub)) {
      wss.broadcast(req.ns.admin || req.ns.pub, payload);
    } else {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(payload));
        }
      });
    }
    res.json({ success: true, ttsLanguage, message: 'TTS language updated successfully' });
  });
}

module.exports = registerTtsRoutes;
