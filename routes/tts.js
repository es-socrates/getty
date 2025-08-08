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
        ttsLanguage: settings.ttsLanguage || 'en'
      };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return { ttsEnabled: true, ttsLanguage: 'en' };
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

function registerTtsRoutes(app, wss, limiter) {
  app.get('/api/tts-setting', (_req, res) => {
    const settings = loadSettings();
    res.json({ ttsEnabled: settings.ttsEnabled });
  });

  app.post('/api/tts-setting', limiter, (req, res) => {
    const bodySchema = z.object({ ttsEnabled: z.coerce.boolean() });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid ttsEnabled value' });
    }
    const { ttsEnabled } = parsed.data;
    saveSettings({ ttsEnabled });

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'ttsSettingUpdate',
          data: { ttsEnabled: Boolean(ttsEnabled) }
        }));
      }
    });

    res.json({ success: true, ttsEnabled: Boolean(ttsEnabled), message: 'TTS setting updated successfully' });
  });

  app.get('/api/tts-language', (_req, res) => {
    const settings = loadSettings();
    res.json({ ttsLanguage: settings.ttsLanguage || 'en' });
  });

  app.post('/api/tts-language', limiter, (req, res) => {
    const bodySchema = z.object({ ttsLanguage: z.enum(['en', 'es']) });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid ttsLanguage value' });
    }
    const { ttsLanguage } = parsed.data;
    saveSettings({ ttsLanguage });

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'ttsLanguageUpdate', data: { ttsLanguage } }));
      }
    });
    res.json({ success: true, ttsLanguage, message: 'TTS language updated successfully' });
  });
}

module.exports = registerTtsRoutes;
