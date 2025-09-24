const path = require('path');
const SupabaseStorage = require('../lib/supabase-storage');

function registerGoalAudioRoutes(app, strictLimiter, _GOAL_AUDIO_UPLOADS_DIR) {
  const { isOpenTestMode } = require('../lib/test-open-mode');
  const { loadTenantConfig } = require('../lib/tenant-config');
  const { loadConfigWithFallback, saveTenantAwareConfig } = require('../lib/tenant');
  app.get('/api/goal-audio', (req, res) => {
    try {

      if (req.query.widgetToken && req.app?.get('store')) {
        try {
          const walletHash = req.app.get('store').get(req.query.widgetToken, 'walletHash');
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

      try {
        const loaded = loadConfigWithFallback(req, GLOBAL_SETTINGS_PATH, SETTINGS_FILENAME);
        const settings = loaded.data;
        if (settings && settings.audioFileUrl) {
          customAudioUrl = settings.audioFileUrl;
        }
      } catch (e) {
        console.warn('Error loading goal audio settings for URL:', e.message);
      }

      if (customAudioUrl && typeof customAudioUrl === 'string') {
        return res.json({ url: customAudioUrl });
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
    };
  }

  app.get('/api/goal-audio-settings', (req, res) => {
    try {
      if (req.query.widgetToken && req.app?.get('store')) {
        try {
          const walletHash = req.app.get('store').get(req.query.widgetToken, 'walletHash');
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

  app.post('/api/goal-audio-settings', strictLimiter, (req, res) => {
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
      if (!audioSource || (audioSource !== 'remote' && audioSource !== 'custom')) {
        return res.status(400).json({ error: 'Invalid audio source' });
      }

      (async () => {
        try {
          const current = loadConfigWithFallback(req, GLOBAL_SETTINGS_PATH, SETTINGS_FILENAME);
          const currentData = normalizeSettings(current.data || {});

          const settings = { audioSource };

          if (audioSource === 'custom' && req.file) {
            const ns = req?.ns?.admin || req?.ns?.pub || null;
            const fileName = `goal-audio-${ns ? ns.replace(/[^a-zA-Z0-9_-]/g, '_') : 'global'}-${Date.now()}.mp3`;

            try {
              const supabaseStorage = new SupabaseStorage();
              const uploadResult = await supabaseStorage.uploadFile('tip-goal-audio', fileName, req.file.buffer, { contentType: 'audio/mpeg' });

              settings.hasCustomAudio = true;
              settings.audioFileName = req.file.originalname;
              settings.audioFileSize = req.file.size;
              settings.audioFileUrl = uploadResult.publicUrl;
              settings.audioFilePath = uploadResult.path;
            } catch (uploadError) {
              console.error('Error uploading goal audio to Supabase:', uploadError);
              return res.status(500).json({ error: 'Error uploading audio file' });
            }
          } else if (audioSource === 'remote') {
            if (currentData.audioFilePath) {
              try {
                const supabaseStorage = new SupabaseStorage();
                await supabaseStorage.deleteFile('tip-goal-audio', currentData.audioFilePath);
              } catch (deleteError) {
                console.warn('Error deleting old goal audio file from Supabase:', deleteError);
              }
            }
            settings.hasCustomAudio = false;
            settings.audioFileName = null;
            settings.audioFileSize = 0;
            settings.audioFileUrl = null;
            settings.audioFilePath = null;
          }

          const next = { ...currentData, ...settings };
          const saveRes = await saveTenantAwareConfig(req, GLOBAL_SETTINGS_PATH, SETTINGS_FILENAME, () => next);
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
        const TIP_GOAL_CONFIG_FILE = path.join(process.cwd(), 'config', 'tip-goal-config.json');
        const loaded = loadTenantConfig(req, req.app?.get('store'), TIP_GOAL_CONFIG_FILE, 'tip-goal-config.json');
        const data = loaded.data?.data ? loaded.data.data : loaded.data;
        if (data && data.customAudioUrl && typeof data.customAudioUrl === 'string' && data.customAudioUrl.includes('supabase')) {
          SupabaseStorage.deleteFile('tip-goal-audio', data.customAudioUrl).catch(deleteError => {
            console.warn('Failed to delete tip goal audio from Supabase:', deleteError.message);
          });
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
            audioFileSize: 0
          };
          const saveRes = await saveTenantAwareConfig(req, GLOBAL_SETTINGS_PATH, SETTINGS_FILENAME, () => next);
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

      const TIP_GOAL_CONFIG_FILE = path.join(process.cwd(), 'config', 'tip-goal-config.json');
      let customAudioUrl = null;

      try {
        const loaded = loadTenantConfig(req, req.app?.get('store'), TIP_GOAL_CONFIG_FILE, 'tip-goal-config.json');
        const data = loaded.data?.data ? loaded.data.data : loaded.data;
        if (data && data.customAudioUrl) {
          customAudioUrl = data.customAudioUrl;
        }
      } catch (e) {
        console.warn('Error loading tip-goal config for custom audio URL:', e.message);
      }

      if (customAudioUrl && typeof customAudioUrl === 'string' && customAudioUrl.includes('supabase')) {

        return res.redirect(302, customAudioUrl);
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
