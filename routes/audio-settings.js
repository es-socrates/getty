const fs = require('fs');
const WebSocket = require('ws');
const { SupabaseStorage } = require('../lib/supabase-storage');

function loadAudioSettings(AUDIO_CONFIG_FILE) {
  try {
    if (fs.existsSync(AUDIO_CONFIG_FILE)) {
      const settings = JSON.parse(fs.readFileSync(AUDIO_CONFIG_FILE, 'utf8'));
      return {
        audioSource: settings.audioSource || 'remote',
        hasCustomAudio: settings.hasCustomAudio || false,
        audioFileName: settings.audioFileName || null,
        audioFileSize: settings.audioFileSize || 0,
        audioFileUrl: settings.audioFileUrl || null,
        audioFilePath: settings.audioFilePath || null,
        enabled: typeof settings.enabled === 'boolean' ? settings.enabled : true,
        volume:
          typeof settings.volume === 'number' && settings.volume >= 0 && settings.volume <= 1
            ? settings.volume
            : 0.5,
      };
    }
  } catch (error) {
    console.error('Error loading audio settings:', error);
  }
  return {
    audioSource: 'remote',
    hasCustomAudio: false,
    audioFileName: null,
    audioFileSize: 0,
    audioFileUrl: null,
    audioFilePath: null,
    enabled: true,
    volume: 0.5,
  };
}

function saveAudioSettings(AUDIO_CONFIG_FILE, newSettings) {
  try {
    const current = loadAudioSettings(AUDIO_CONFIG_FILE);
    const merged = { ...current, ...newSettings };
    fs.writeFileSync(AUDIO_CONFIG_FILE, JSON.stringify(merged, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving audio settings:', error);
    return false;
  }
}

function registerAudioSettingsRoutes(app, wss, audioUpload, AUDIO_UPLOADS_DIR, AUDIO_CONFIG_FILE = './audio-settings.json', { store } = {}) {
  const { isOpenTestMode } = require('../lib/test-open-mode');
  const requireAdminWrites = (process.env.GETTY_REQUIRE_ADMIN_WRITE === '1') || !!process.env.REDIS_URL;
  app.get('/api/audio-settings', async (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
      if (!isOpenTestMode() && (requireSessionFlag || hosted) && !hasNs) {
        return res.json({
          audioSource: 'remote',
          hasCustomAudio: false,
          enabled: true,
          volume: 0.5,
        });
      }

      if (store && hasNs) {
        const ns = req.ns.admin || req.ns.pub;
        try {
          const st = await store.get(ns, 'audio-settings', null);
          if (st && typeof st === 'object') {
            return res.json(st);
          }
        } catch (error) {
          console.error('Error loading tenant audio settings:', error);
        }

        return res.json({
          audioSource: 'remote',
          hasCustomAudio: false,
          audioFileName: null,
          audioFileSize: 0,
          audioFileUrl: null,
          audioFilePath: null,
          enabled: true,
          volume: 0.5,
        });
      }

      // For non-tenant mode, use global file
      const settings = loadAudioSettings(AUDIO_CONFIG_FILE);
      res.json(settings);
    } catch (error) {
      console.error('Error getting audio settings:', error);
      res.status(500).json({ error: 'Error al cargar configuración de audio' });
    }
  });

  app.post('/api/audio-settings', audioUpload.single('audioFile'), async (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
  if (!isOpenTestMode() && (requireSessionFlag || hosted) && !hasNs) {
        return res.status(401).json({ error: 'no_session' });
      }
      if (requireAdminWrites) {
        const isAdmin = !!(req?.auth && req.auth.isAdmin);
        if (!isAdmin) return res.status(401).json({ error: 'admin_required' });
      }
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      const { audioSource } = req.body;
      if (!audioSource || (audioSource !== 'remote' && audioSource !== 'custom')) {
        return res.status(400).json({ error: 'Invalid audio source' });
      }

      const settings = { audioSource };

      if (Object.prototype.hasOwnProperty.call(req.body, 'enabled')) {
        settings.enabled = req.body.enabled === 'true' || req.body.enabled === true ? true : false;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'volume')) {
        const vol = parseFloat(req.body.volume);
        if (!isNaN(vol)) settings.volume = Math.max(0, Math.min(1, vol));
      }

      let currentSettings = null;
      if (ns && store) {
        try {
          currentSettings = await store.get(ns, 'audio-settings', null);
          if (!currentSettings) {
            currentSettings = {
              audioSource: 'remote',
              hasCustomAudio: false,
              audioFileName: null,
              audioFileSize: 0,
              audioFileUrl: null,
              audioFilePath: null,
              enabled: true,
              volume: 0.5,
            };
          }
        } catch (error) {
          console.error('Error loading current tenant audio settings:', error);
          currentSettings = {
            audioSource: 'remote',
            hasCustomAudio: false,
            audioFileName: null,
            audioFileSize: 0,
            audioFileUrl: null,
            audioFilePath: null,
            enabled: true,
            volume: 0.5,
          };
        }
      } else {
        currentSettings = loadAudioSettings(AUDIO_CONFIG_FILE);
      }

      if (audioSource === 'custom' && req.file) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        const fileName = `custom-notification-audio-${ns ? ns.replace(/[^a-zA-Z0-9_-]/g, '_') : 'global'}-${Date.now()}.mp3`;
        
        try {
          const supabaseStorage = new SupabaseStorage();
          const uploadResult = await supabaseStorage.uploadFile('tip-goal-audio', fileName, req.file.buffer, { contentType: 'audio/mpeg' });
          
          settings.hasCustomAudio = true;
          settings.audioFileName = req.file.originalname;
          settings.audioFileSize = req.file.size;
          settings.audioFileUrl = uploadResult.publicUrl;
          settings.audioFilePath = uploadResult.path;
        } catch (uploadError) {
          console.error('Error uploading audio to Supabase:', uploadError);
          return res.status(500).json({ error: 'Error uploading audio file' });
        }
      } else if (audioSource === 'remote') {

        if (currentSettings.audioFilePath) {
          try {
            const supabaseStorage = new SupabaseStorage();
            await supabaseStorage.deleteFile('tip-goal-audio', currentSettings.audioFilePath);
          } catch (deleteError) {
            console.warn('Error deleting old audio file from Supabase:', deleteError);
          }
        }
        settings.hasCustomAudio = false;
        settings.audioFileName = null;
        settings.audioFileSize = 0;
        settings.audioFileUrl = null;
        settings.audioFilePath = null;
      }

      let success = false;
      let payload = null;

      if (ns && store) {
        try {
          const merged = { ...currentSettings, ...settings };
          await store.set(ns, 'audio-settings', merged);
          payload = merged;
          success = true;
        } catch (error) {
          console.error('Error saving tenant audio settings:', error);
          return res.status(500).json({ error: 'Error saving audio configuration' });
        }
      } else {

        const merged = { ...currentSettings, ...settings };
        success = saveAudioSettings(AUDIO_CONFIG_FILE, merged);
        if (success) {
          payload = loadAudioSettings(AUDIO_CONFIG_FILE);
        } else {
          return res.status(500).json({ error: 'Error saving audio configuration' });
        }
      }

      try {
        if (ns && store) {
          if (typeof wss.broadcast === 'function') {
            wss.broadcast(ns, { type: 'audioSettingsUpdate', data: payload });
          } else {
            wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'audioSettingsUpdate', data: payload })); });
          }
        } else {
          wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'audioSettingsUpdate', data: payload })); });
        }
      } catch (broadcastError) {
        console.warn('Error broadcasting audio settings update:', broadcastError);
      }

      res.json({ success: true, message: 'Audio configuration successfully saved', settings: payload });
    } catch (error) {
      console.error('Error saving audio settings:', error);
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'The file is too large. Maximum 1MB.' });
      }
      if (error.message === 'Only MP3 files are allowed') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/audio-settings', async (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
  if (!isOpenTestMode() && (requireSessionFlag || hosted) && !hasNs) {
        return res.status(401).json({ error: 'no_session' });
      }
      if (requireAdminWrites) {
        const isAdmin = !!(req?.auth && req.auth.isAdmin);
        if (!isAdmin) return res.status(401).json({ error: 'admin_required' });
      }
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      
      let currentSettings = null;
      if (ns && store) {
        try {
          currentSettings = await store.get(ns, 'audio-settings', null);
          if (!currentSettings) {
            currentSettings = {
              audioSource: 'remote',
              hasCustomAudio: false,
              audioFileName: null,
              audioFileSize: 0,
              audioFileUrl: null,
              audioFilePath: null,
              enabled: true,
              volume: 0.5,
            };
          }
        } catch (error) {
          console.error('Error loading current tenant audio settings for delete:', error);
          currentSettings = {
            audioSource: 'remote',
            hasCustomAudio: false,
            audioFileName: null,
            audioFileSize: 0,
            audioFileUrl: null,
            audioFilePath: null,
            enabled: true,
            volume: 0.5,
          };
        }
      } else {
        currentSettings = loadAudioSettings(AUDIO_CONFIG_FILE);
      }
      
      if (currentSettings.audioFilePath) {
        try {
          const supabaseStorage = new SupabaseStorage();
          await supabaseStorage.deleteFile('tip-goal-audio', currentSettings.audioFilePath);
        } catch (deleteError) {
          console.warn('Error deleting audio file from Supabase:', deleteError);
        }
      }

      const resetSettings = {
        audioSource: 'remote',
        hasCustomAudio: false,
        audioFileName: null,
        audioFileSize: 0,
        audioFileUrl: null,
        audioFilePath: null,
      };

      let success = false;
      let payload = null;

      if (ns && store) {

        try {
          const merged = { ...currentSettings, ...resetSettings };
          await store.set(ns, 'audio-settings', merged);
          payload = merged;
          success = true;
        } catch (error) {
          console.error('Error resetting tenant audio settings:', error);
          return res.status(500).json({ error: 'Error deleting audio configuration' });
        }
      } else {

        success = saveAudioSettings(AUDIO_CONFIG_FILE, resetSettings);
        if (success) {
          payload = loadAudioSettings(AUDIO_CONFIG_FILE);
        } else {
          return res.status(500).json({ error: 'Error deleting audio configuration' });
        }
      }

      try {
        if (ns && store) {
          if (typeof wss.broadcast === 'function') {
            wss.broadcast(ns, { type: 'audioSettingsUpdate', data: payload });
          } else {
            wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'audioSettingsUpdate', data: payload })); });
          }
        } else {
          wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'audioSettingsUpdate', data: payload })); });
        }
      } catch (broadcastError) {
        console.warn('Error broadcasting audio settings reset:', broadcastError);
      }

      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting audio settings:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/custom-audio', async (req, res) => {
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      let settings = null;

      if (ns && store) {
        try {
          settings = await store.get(ns, 'audio-settings', null);
        } catch (error) {
          console.error('Error loading tenant audio settings for custom audio:', error);
        }
      }

      if (!settings) {
        settings = loadAudioSettings(AUDIO_CONFIG_FILE);
      }
      
      if (!settings || !settings.audioFileUrl) {
        return res.status(404).json({ error: 'Custom audio not found' });
      }
      
      res.json({ url: settings.audioFileUrl });
    } catch (error) {
      console.error('Error serving custom audio:', error);
      res.status(500).json({ error: 'Error serving custom audio' });
    }
  });
}

module.exports = registerAudioSettingsRoutes;
