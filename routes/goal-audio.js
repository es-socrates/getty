const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');
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

  const LIBRARY_FILE = path.join(process.cwd(), 'config', 'audio-library.json');
  const HOSTED_ENV = !!process.env.REDIS_URL;

  function normalizeProvider(provider) {
    if (!provider || typeof provider !== 'string') return '';
    const lower = provider.trim().toLowerCase();
    if (lower === STORAGE_PROVIDERS.TURBO || lower === 'arweave') {
      return STORAGE_PROVIDERS.TURBO;
    }
    if (lower === STORAGE_PROVIDERS.SUPABASE) {
      return STORAGE_PROVIDERS.SUPABASE;
    }
    return lower;
  }

  function resolveStore() {
    try {
      if (typeof app?.get === 'function') {
        return app.get('store') || null;
      }
    } catch {}
    return null;
  }

  function loadLibraryFromFile() {
    try {
      if (fs.existsSync(LIBRARY_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.items)) return parsed.items;
      }
    } catch (error) {
      console.error('[goal-audio][library] load error', error.message);
    }
    return [];
  }

  function saveLibraryToFile(items) {
    try {
      fs.writeFileSync(LIBRARY_FILE, JSON.stringify(items, null, 2));
    } catch (error) {
      console.error('[goal-audio][library] save error', error.message);
    }
  }

  async function loadLibrary(ns) {
    const store = resolveStore();
    if (store && ns) {
      try {
        const stored = await store.get(ns, 'audio-library', null);
        if (Array.isArray(stored)) return stored;
        if (stored && Array.isArray(stored.items)) return stored.items;
      } catch (error) {
        console.warn('[goal-audio][library] store load error', error.message);
      }
      return [];
    }
    return loadLibraryFromFile();
  }

  async function saveLibrary(ns, items) {
    const store = resolveStore();
    if (store && ns) {
      try {
        await store.set(ns, 'audio-library', items);
      } catch (error) {
        console.warn('[goal-audio][library] store save error', error.message);
      }
      if (!HOSTED_ENV) {
        saveLibraryToFile(items);
      }
      return;
    }
    saveLibraryToFile(items);
  }

  async function upsertLibraryEntry(ns, entry) {
    if (!entry || !entry.id) return null;
    const current = await loadLibrary(ns);
    const filtered = current.filter((item) => item && item.id !== entry.id);
    const updated = [entry, ...filtered];
    const maxItems = 50;
    const trimmed = updated.slice(0, maxItems);
    await saveLibrary(ns, trimmed);
    return trimmed;
  }

  async function findLibraryEntry(ns, entryId) {
    if (!entryId) return null;
    const items = await loadLibrary(ns);
    return items.find((item) => item && item.id === entryId) || null;
  }
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
    const size = Number.isFinite(base.audioFileSize)
      ? base.audioFileSize
      : Number(base.audioFileSize) || 0;
    const volumeRaw =
      typeof base.volume === 'number' ? base.volume : parseFloat(base.volume);
    const volume = Number.isFinite(volumeRaw)
      ? Math.min(Math.max(volumeRaw, 0), 1)
      : 0.8;
    const enabled = (() => {
      if (typeof base.enabled === 'boolean') return base.enabled;
      if (typeof base.enabled === 'string') {
        const lowered = base.enabled.trim().toLowerCase();
        if (['false', '0', 'off', 'no'].includes(lowered)) return false;
        if (['true', '1', 'on', 'yes'].includes(lowered)) return true;
      }
      return true;
    })();
    return {
      audioSource: base.audioSource || 'remote',
      hasCustomAudio: !!base.hasCustomAudio,
      audioFileName:
        typeof base.audioFileName === 'string' && base.audioFileName ? base.audioFileName : null,
      audioFileSize: size >= 0 ? size : 0,
      audioFileUrl:
        typeof base.audioFileUrl === 'string' && base.audioFileUrl
          ? base.audioFileUrl
          : typeof base.customAudioUrl === 'string'
          ? base.customAudioUrl
          : null,
      audioFilePath:
        typeof base.audioFilePath === 'string' && base.audioFilePath ? base.audioFilePath : null,
      audioLibraryId: typeof base.audioLibraryId === 'string' ? base.audioLibraryId : '',
      storageProvider: normalizeProvider(base.storageProvider),
      enabled,
      volume,
    };
  }

  app.get('/api/goal-audio-settings', async (req, res) => {
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

      try {
        const loaded = loadConfigWithFallback(req, GLOBAL_SETTINGS_PATH, SETTINGS_FILENAME);
        const raw = loaded.data;
        const meta = loaded.tenant ? { source: 'tenant' } : { source: 'global' };
        const flat = normalizeSettings(raw || {});
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        const libraryItem = flat.audioLibraryId ? await findLibraryEntry(ns, flat.audioLibraryId) : null;
        return res.json(meta ? { meta, libraryItem, ...flat } : { libraryItem, ...flat });
      } catch (e) {
        console.error('Error loading goal audio settings (tenant):', e);
        return res.json({ audioSource: 'remote', hasCustomAudio: false });
      }
    } catch (error) {
      console.error('Error loading goal audio settings:', error);
      res.status(500).json({ error: 'Error loading settings' });
    }
  });

  app.post('/api/goal-audio-settings', strictLimiter, multerUpload.single('audioFile'), async (req, res) => {
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
      const requestedStorageProviderRaw =
        typeof req.body.storageProvider === 'string' ? req.body.storageProvider : '';
      const preferredProvider = normalizeProvider(requestedStorageProviderRaw);
      if (!audioSource || (audioSource !== 'remote' && audioSource !== 'custom')) {
        return res.status(400).json({ error: 'Invalid audio source' });
      }

      const selectedAudioIdRaw = req.body.selectedAudioId;
      const selectedAudioId =
        typeof selectedAudioIdRaw === 'string' && selectedAudioIdRaw.trim()
          ? selectedAudioIdRaw.trim()
          : '';

      const current = loadConfigWithFallback(req, GLOBAL_SETTINGS_PATH, SETTINGS_FILENAME);
      const currentData = normalizeSettings(current.data || {});
      const ns = req?.ns?.admin || req?.ns?.pub || null;

      const settings = {
        audioSource,
        storageProvider: currentData.storageProvider,
        hasCustomAudio: currentData.hasCustomAudio,
        audioFileName: currentData.audioFileName,
        audioFileSize: currentData.audioFileSize,
        audioFileUrl: currentData.audioFileUrl,
        audioFilePath: currentData.audioFilePath,
        audioLibraryId: currentData.audioLibraryId,
        enabled: typeof currentData.enabled === 'boolean' ? currentData.enabled : true,
        volume: Number.isFinite(currentData.volume) ? currentData.volume : 0.8,
      };
      let libraryItem = null;

      if (Object.prototype.hasOwnProperty.call(req.body, 'enabled')) {
        const rawEnabled = req.body.enabled;
        if (typeof rawEnabled === 'boolean') {
          settings.enabled = rawEnabled;
        } else if (typeof rawEnabled === 'string') {
          const lowered = rawEnabled.trim().toLowerCase();
          if (['false', '0', 'off', 'no'].includes(lowered)) settings.enabled = false;
          if (['true', '1', 'on', 'yes'].includes(lowered)) settings.enabled = true;
        }
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'volume')) {
        const parsedVolume = parseFloat(req.body.volume);
        if (Number.isFinite(parsedVolume)) {
          settings.volume = Math.min(Math.max(parsedVolume, 0), 1);
        }
      }

      if (audioSource === 'custom' && req.file) {
        const nsSafe = ns ? ns.replace(/[^a-zA-Z0-9_-]/g, '_') : 'global';
        const fileName = `goal-audio-${nsSafe}-${Date.now()}.mp3`;

        const shouldDeleteStoredFile = currentData.audioFilePath && !currentData.audioLibraryId;
        if (
          shouldDeleteStoredFile &&
          normalizeProvider(currentData.storageProvider) === STORAGE_PROVIDERS.SUPABASE
        ) {
          try {
            const storage = getStorage(STORAGE_PROVIDERS.SUPABASE);
            if (storage && storage.provider === STORAGE_PROVIDERS.SUPABASE) {
              await storage.deleteFile('tip-goal-audio', currentData.audioFilePath);
            }
          } catch (deleteError) {
            console.warn('[goal-audio] failed to delete previous audio from Supabase:', deleteError.message);
          }
        }

        const storage = getStorage(preferredProvider || undefined);
        if (!storage) {
          throw new Error('Storage service not configured');
        }
        const fileBuffer = req.file.buffer || Buffer.alloc(0);
        const fileHash =
          fileBuffer.length ? crypto.createHash('sha256').update(fileBuffer).digest('hex') : '';
        const normalizedName = (req.file.originalname || fileName || '').toLowerCase();
        const fingerprint = `${normalizedName}::${req.file.size || 0}`;

        const uploadResult = await storage.uploadFile('tip-goal-audio', fileName, fileBuffer, {
          contentType: req.file.mimetype || 'audio/mpeg',
        });

        const providerId = normalizeProvider(
          uploadResult.provider || storage.provider || preferredProvider
        );
        const derivedId =
          uploadResult.fileName ||
          uploadResult.path ||
          uploadResult.transactionId ||
          fingerprint ||
          `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        libraryItem = {
          id: derivedId,
          url: uploadResult.publicUrl,
          size: Number(req.file.size) || Number(uploadResult.size) || 0,
          originalName:
            req.file.originalname || uploadResult.originalName || uploadResult.fileName || derivedId,
          path: uploadResult.path || uploadResult.fileName || derivedId,
          uploadedAt: new Date().toISOString(),
          mimeType: req.file.mimetype || 'audio/mpeg',
          sha256: fileHash,
          fingerprint,
          provider: providerId,
        };

        await upsertLibraryEntry(ns, libraryItem);

        settings.hasCustomAudio = true;
        settings.audioFileName = libraryItem.originalName;
        settings.audioFileSize = libraryItem.size;
        settings.audioFileUrl = libraryItem.url;
        settings.audioFilePath = libraryItem.path;
        settings.audioLibraryId = libraryItem.id;
        settings.storageProvider = providerId;
      } else if (audioSource === 'custom' && selectedAudioId) {
        try {
          const entry = await findLibraryEntry(ns, selectedAudioId);
          if (!entry) {
            return res.status(404).json({ error: 'audio_library_item_not_found' });
          }
          const providerId = normalizeProvider(entry.provider);
          libraryItem = entry;
          settings.hasCustomAudio = true;
          settings.audioFileName = entry.originalName || entry.id;
          settings.audioFileSize = Number(entry.size) || 0;
          settings.audioFileUrl = entry.url || null;
          settings.audioFilePath = entry.path || entry.id || null;
          settings.audioLibraryId = entry.id;
          settings.storageProvider = providerId;
        } catch (lookupError) {
          console.error('[goal-audio][library] lookup error', lookupError.message);
          return res.status(500).json({ error: 'audio_library_lookup_failed' });
        }
      } else if (audioSource === 'remote') {
        const shouldDeleteStoredFile = currentData.audioFilePath && !currentData.audioLibraryId;
        if (
          shouldDeleteStoredFile &&
          normalizeProvider(currentData.storageProvider) === STORAGE_PROVIDERS.SUPABASE
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
        settings.audioLibraryId = '';
        settings.storageProvider = '';
      }

      const next = normalizeSettings({ ...currentData, ...settings });
      const saveRes = await saveTenantAwareConfig(req, GLOBAL_SETTINGS_PATH, SETTINGS_FILENAME, () => next);

      try {
        const nsForBroadcast = req?.ns?.admin || req?.ns?.pub || null;
        if (nsForBroadcast) {
          if (typeof wss.broadcast === 'function') {
            wss.broadcast(nsForBroadcast, { type: 'goalAudioSettingsUpdate', data: next });
          } else {
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'goalAudioSettingsUpdate', data: next }));
              }
            });
          }
        } else {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'goalAudioSettingsUpdate', data: next }));
            }
          });
        }
      } catch (broadcastError) {
        console.warn('Error broadcasting goal audio settings update:', broadcastError);
      }

      return res.json({ success: true, meta: saveRes.meta, ...next, libraryItem });
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
          (!data.audioLibraryId || !data.audioLibraryId.length) &&
          normalizeProvider(data.storageProvider) === STORAGE_PROVIDERS.SUPABASE
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
            audioFileUrl: null,
            audioFilePath: null,
            audioLibraryId: '',
            storageProvider: '',
            enabled: true,
            volume: 0.8,
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
