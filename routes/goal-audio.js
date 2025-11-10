const path = require('path');
const { getStorage, STORAGE_PROVIDERS } = require('../lib/storage');

function registerGoalAudioRoutes(app, wss, strictLimiter, _GOAL_AUDIO_UPLOADS_DIR) {
  const multer = require('multer');
  const multerUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 1024 * 1024 * 1, // 1MB limit
      files: 1
    },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
      } else {
        cb(new Error('Only audio files are allowed'));
      }
    }
  });
  const { isOpenTestMode } = require('../lib/test-open-mode');
  const { loadConfigWithFallback, saveTenantAwareConfig } = require('../lib/tenant');
  app.get('/api/goal-audio', (req, res) => {
    try {

      const tokenParam = (typeof req.query?.widgetToken === 'string' && req.query.widgetToken.trim())
        ? req.query.widgetToken.trim()
        : (typeof req.query?.token === 'string' && req.query.token.trim() ? req.query.token.trim() : '');
      if (tokenParam && req.app?.get('store')) {
        try {
          const walletHash = req.app.get('store').get(tokenParam, 'walletHash');
          if (walletHash) {
            req.ns = req.ns || {};
            req.ns.pub = walletHash;
          }
        } catch (e) {
          console.warn('Failed to resolve widgetToken for goal audio:', e.message);
        }
      }

      const ns = req?.ns?.admin || req?.ns?.pub || null;
      const hosted = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
      if (hosted && !ns) {
        return res.status(404).json({ error: 'No audio file found' });
      }

      const SETTINGS_FILENAME = 'goal-audio-settings.json';
      const GLOBAL_SETTINGS_PATH = path.join(process.cwd(), 'config', SETTINGS_FILENAME);
      let customAudioUrl = null;
      let storageProvider = '';

      try {
        const loaded = loadConfigWithFallback(req, GLOBAL_SETTINGS_PATH, SETTINGS_FILENAME);
        const settings = loaded.data;
        if (settings && settings.audioFileUrl) {
          customAudioUrl = settings.audioFileUrl;
        }
        if (settings && typeof settings.storageProvider === 'string') {
          storageProvider = settings.storageProvider;
        }
      } catch (e) {
        console.warn('Error loading goal audio settings for URL:', e.message);
      }

      if (customAudioUrl && typeof customAudioUrl === 'string') {
        return res.json({ url: customAudioUrl, storageProvider });
      } else {
        return res.json({ url: 'https://52agquhrbhkx3u72ikhun7oxngtan55uvxqbp4pzmhslirqys6wq.arweave.net/7oBoUPEJ1X3T-kKPRv3XaaYG97St4Bfx-WHktEYYl60' });
      }
    } catch (error) {
      console.error('Error serving goal audio:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const SETTINGS_FILENAME = 'goal-audio-settings.json';
  const GLOBAL_SETTINGS_PATH = path.join(process.cwd(), 'config', SETTINGS_FILENAME);

  function normalizeSettings(raw) {
    const base = raw && typeof raw === 'object' ? raw : {};
    return {
      audioSource: base.audioSource || 'remote',
      hasCustomAudio: !!base.hasCustomAudio,
      audioFileName: base.audioFileName || null,
      audioFileSize: base.audioFileSize || 0,
      audioFileUrl: base.audioFileUrl || null,
      audioFilePath: base.audioFilePath || null,
      storageProvider: typeof base.storageProvider === 'string' ? base.storageProvider : '',
    };
  }

  app.get('/api/goal-audio-settings', (req, res) => {
    try {
      const tokenParam = (typeof req.query?.widgetToken === 'string' && req.query.widgetToken.trim())
        ? req.query.widgetToken.trim()
        : (typeof req.query?.token === 'string' && req.query.token.trim() ? req.query.token.trim() : '');
      if (tokenParam && req.app?.get('store')) {
        try {
          const walletHash = req.app.get('store').get(tokenParam, 'walletHash');
          if (walletHash) {
            req.ns = req.ns || {};
            req.ns.pub = walletHash;
          }
        } catch (e) {
          console.warn('Failed to resolve widgetToken for goal audio settings:', e.message);
        }
      }

      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
  if (!isOpenTestMode() && (requireSessionFlag || hosted) && !hasNs) {
        return res.json({ audioSource: 'remote', hasCustomAudio: false });
      }
      (async () => {
        try {
          const loaded = loadConfigWithFallback(req, GLOBAL_SETTINGS_PATH, SETTINGS_FILENAME);
          const raw = loaded.data;
          const meta = loaded.tenant ? { source: 'tenant' } : { source: 'global' };
          const flat = normalizeSettings(raw || {});
          return res.json(meta ? { meta, ...flat } : flat);
        } catch (e) {
          console.error('Error loading goal audio settings (tenant):', e);
          return res.json({ audioSource: 'remote', hasCustomAudio: false });
        }
      })();
    } catch (error) {
      console.error('Error loading goal audio settings:', error);
      res.status(500).json({ error: 'Error loading settings' });
    }
  });

  app.post('/api/goal-audio-settings', strictLimiter, multerUpload.single('audioFile'), (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
      if (!isOpenTestMode() && (requireSessionFlag || hosted) && !hasNs) {
        return res.status(401).json({ error: 'no_session' });
      }
      const requireAdminWrites = (process.env.GETTY_REQUIRE_ADMIN_WRITE === '1') || hosted;
      if (requireAdminWrites) {
        const isAdmin = !!(req?.auth && req.auth.isAdmin);
        if (!isAdmin) return res.status(401).json({ error: 'admin_required' });
      }

      const { audioSource } = req.body;
      const requestedStorageProvider =
        typeof req.body.storageProvider === 'string' ? req.body.storageProvider : '';
      if (!audioSource || (audioSource !== 'remote' && audioSource !== 'custom')) {
        return res.status(400).json({ error: 'Invalid audio source' });
      }

      (async () => {
        try {
          const current = loadConfigWithFallback(req, GLOBAL_SETTINGS_PATH, SETTINGS_FILENAME);
          const currentData = normalizeSettings(current.data || {});

          const settings = { audioSource, storageProvider: currentData.storageProvider || '' };

          if (audioSource === 'custom' && req.file) {
            const ns = req?.ns?.admin || req?.ns?.pub || null;
            const fileName = `goal-audio-${ns ? ns.replace(/[^a-zA-Z0-9_-]/g, '_') : 'global'}-${Date.now()}.mp3`;

            try {
              const storage = getStorage(requestedStorageProvider || undefined);
              if (!storage) {
                throw new Error('Storage service not configured');
              }
              const uploadResult = await storage.uploadFile('tip-goal-audio', fileName, req.file.buffer, { contentType: req.file.mimetype || 'audio/mpeg' });

              settings.hasCustomAudio = true;
              settings.audioFileName = req.file.originalname;
              settings.audioFileSize = req.file.size;
              settings.audioFileUrl = uploadResult.publicUrl;
              settings.audioFilePath = uploadResult.path || null;
              settings.storageProvider = uploadResult.provider || storage.provider || STORAGE_PROVIDERS.SUPABASE;
            } catch (uploadError) {
              console.error('Error uploading goal audio to storage:', uploadError);
              return res.status(500).json({ error: 'Error uploading audio file' });
            }
          } else if (audioSource === 'remote') {
            if (
              currentData.audioFilePath &&
              currentData.storageProvider === STORAGE_PROVIDERS.SUPABASE
            ) {
              try {
                const storage = getStorage(STORAGE_PROVIDERS.SUPABASE);
                if (storage && storage.provider === STORAGE_PROVIDERS.SUPABASE) {
                  await storage.deleteFile('tip-goal-audio', currentData.audioFilePath);
                }
              } catch (deleteError) {
                console.warn('Error deleting old goal audio file from Supabase:', deleteError);
              }
            }
            settings.hasCustomAudio = false;
            settings.audioFileName = null;
            settings.audioFileSize = 0;
            settings.audioFileUrl = null;
            settings.audioFilePath = null;
            settings.storageProvider = '';
          }

          const next = { ...currentData, ...settings };
          const saveRes = await saveTenantAwareConfig(req, GLOBAL_SETTINGS_PATH, SETTINGS_FILENAME, () => next);

          try {
            const ns = req?.ns?.admin || req?.ns?.pub || null;
            if (ns) {
              if (typeof wss.broadcast === 'function') {
                wss.broadcast(ns, { type: 'goalAudioSettingsUpdate', data: next });
              } else {
                wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'goalAudioSettingsUpdate', data: next })); });
              }
            } else {
              wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'goalAudioSettingsUpdate', data: next })); });
            }
          } catch (broadcastError) {
            console.warn('Error broadcasting goal audio settings update:', broadcastError);
          }

          return res.json({ success: true, meta: saveRes.meta, ...next });
        } catch (e) {
          console.error('Error saving goal audio settings (tenant):', e);
          return res.json({ success: false, error: 'Error saving settings' });
        }
      })();
    } catch (error) {
      console.error('Error saving goal audio settings:', error);
      res.status(500).json({ error: 'Error saving settings' });
    }
  });

  app.delete('/api/goal-audio-settings', strictLimiter, (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hostedWithRedis = !!process.env.REDIS_URL;
      const shouldRequireSession = requireSessionFlag || hostedWithRedis;
      const requireAdminWrites = (process.env.GETTY_REQUIRE_ADMIN_WRITE === '1') || hostedWithRedis;

  if (!isOpenTestMode() && shouldRequireSession) {
        const nsCheck = req?.ns?.admin || req?.ns?.pub || null;
        if (!nsCheck) return res.status(401).json({ error: 'session_required' });
      }
      if (requireAdminWrites) {
        const isAdmin = !!(req?.auth && req.auth.isAdmin);
        if (!isAdmin) return res.status(401).json({ error: 'admin_required' });
      }

      try {
        const loaded = loadConfigWithFallback(req, GLOBAL_SETTINGS_PATH, SETTINGS_FILENAME);
        const data = loaded.data;
        if (
          data &&
          data.audioFilePath &&
          typeof data.audioFilePath === 'string' &&
          data.storageProvider === STORAGE_PROVIDERS.SUPABASE
        ) {
          const storage = getStorage(STORAGE_PROVIDERS.SUPABASE);
          if (storage && storage.provider === STORAGE_PROVIDERS.SUPABASE) {
            storage.deleteFile('tip-goal-audio', data.audioFilePath).catch(deleteError => {
              console.warn('Failed to delete goal audio from Supabase:', deleteError.message);
            });
          }
        }
      } catch (configError) {
        console.warn('Error loading config for audio deletion:', configError.message);
      }

      (async () => {
        try {
          const next = {
            audioSource: 'remote',
            hasCustomAudio: false,
            audioFileName: null,
            audioFileSize: 0,
            storageProvider: '',
          };
          const saveRes = await saveTenantAwareConfig(req, GLOBAL_SETTINGS_PATH, SETTINGS_FILENAME, () => next);

          try {
            const ns = req?.ns?.admin || req?.ns?.pub || null;
            if (ns) {
              if (typeof wss.broadcast === 'function') {
                wss.broadcast(ns, { type: 'goalAudioSettingsUpdate', data: next });
              } else {
                wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'goalAudioSettingsUpdate', data: next })); });
              }
            } else {
              wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'goalAudioSettingsUpdate', data: next })); });
            }
          } catch (broadcastError) {
            console.warn('Error broadcasting goal audio settings reset:', broadcastError);
          }

          return res.json({ success: true, meta: saveRes.meta, ...next });
        } catch (e) {
          console.error('Error resetting goal audio settings (tenant):', e);
          return res.json({ success: true, audioSource: 'remote', hasCustomAudio: false });
        }
      })();
    } catch (error) {
      console.error('Error deleting goal audio:', error);
      res.status(500).json({ error: 'Error deleting audio' });
    }
  });

  app.get('/api/goal-custom-audio', (req, res) => {
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      const hosted = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
  if (!isOpenTestMode() && hosted && !ns) {
        return res.status(404).json({ error: 'Custom goal audio not found' });
      }

      let customAudioUrl = null;
      let storageProvider = '';
      const loaded = loadConfigWithFallback(req, GLOBAL_SETTINGS_PATH, SETTINGS_FILENAME);
      const data = loaded.data;
      if (data && data.audioFileUrl) {
        customAudioUrl = data.audioFileUrl;
      }
      if (data && typeof data.storageProvider === 'string') {
        storageProvider = data.storageProvider;
      }

      if (customAudioUrl && typeof customAudioUrl === 'string') {
        return res.json({ url: customAudioUrl, storageProvider });
      } else {
        return res.status(404).json({ error: 'Custom goal audio not found' });
      }
    } catch (error) {
      console.error('Error serving custom goal audio:', error);
      res.status(500).json({ error: 'Error serving custom goal audio' });
    }
  });
}

module.exports = registerGoalAudioRoutes;
