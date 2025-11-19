const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');
const { getStorage, STORAGE_PROVIDERS } = require('../lib/storage');

function normalizeProvider(provider) {
  if (!provider || typeof provider !== 'string') return '';
  const lower = provider.trim().toLowerCase();
  if (lower === STORAGE_PROVIDERS.TURBO || lower === 'arweave') return STORAGE_PROVIDERS.TURBO;
  if (lower === STORAGE_PROVIDERS.SUPABASE) return STORAGE_PROVIDERS.SUPABASE;
  return lower;
}

function ensureSettingsShape(raw = {}) {
  const src = raw.audioSource === 'custom' ? 'custom' : 'remote';
  const size = Number.isFinite(raw.audioFileSize)
    ? raw.audioFileSize
    : Number(raw.audioFileSize) || 0;
  const volRaw = Number.isFinite(raw.volume) ? raw.volume : parseFloat(raw.volume);
  const volume = Number.isFinite(volRaw) ? Math.max(0, Math.min(1, volRaw)) : 0.5;
  return {
    audioSource: src,
    hasCustomAudio: !!raw.hasCustomAudio,
    audioFileName:
      typeof raw.audioFileName === 'string' && raw.audioFileName ? raw.audioFileName : null,
    audioFileSize: size >= 0 ? size : 0,
    audioFileUrl:
      typeof raw.audioFileUrl === 'string' && raw.audioFileUrl ? raw.audioFileUrl : null,
    audioFilePath:
      typeof raw.audioFilePath === 'string' && raw.audioFilePath ? raw.audioFilePath : null,
    audioLibraryId: typeof raw.audioLibraryId === 'string' ? raw.audioLibraryId : '',
    storageProvider: normalizeProvider(raw.storageProvider),
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    volume,
  };
}

function loadAudioSettings(AUDIO_CONFIG_FILE) {
  try {
    if (fs.existsSync(AUDIO_CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(AUDIO_CONFIG_FILE, 'utf8'));
      return ensureSettingsShape(parsed);
    }
  } catch (error) {
    console.error('Error loading audio settings:', error);
  }
  return ensureSettingsShape();
}

function saveAudioSettings(AUDIO_CONFIG_FILE, newSettings) {
  try {
    const current = loadAudioSettings(AUDIO_CONFIG_FILE);
    const merged = ensureSettingsShape({ ...current, ...newSettings });
    fs.writeFileSync(AUDIO_CONFIG_FILE, JSON.stringify(merged, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving audio settings:', error);
    return false;
  }
}

function registerAudioSettingsRoutes(
  app,
  wss,
  audioUpload,
  AUDIO_UPLOADS_DIR,
  AUDIO_CONFIG_FILE = './audio-settings.json',
  { store } = {}
) {
  const { isOpenTestMode } = require('../lib/test-open-mode');
  const requireAdminWrites =
    process.env.GETTY_REQUIRE_ADMIN_WRITE === '1' || !!process.env.REDIS_URL;
  const LIBRARY_FILE = path.join(process.cwd(), 'config', 'audio-library.json');

  function loadLibraryFromFile() {
    try {
      if (fs.existsSync(LIBRARY_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.items)) return parsed.items;
      }
    } catch (error) {
      console.error('[audio-library] load error', error.message);
    }
    return [];
  }

  function saveLibraryToFile(items) {
    try {
      fs.writeFileSync(LIBRARY_FILE, JSON.stringify(items, null, 2));
    } catch (error) {
      console.error('[audio-library] save error', error.message);
    }
  }

  async function loadLibrary(ns) {
    if (store && ns) {
      try {
        const stored = await store.get(ns, 'audio-library', null);
        if (stored) {
          if (Array.isArray(stored)) return stored;
          if (stored && Array.isArray(stored.items)) return stored.items;
        }
      } catch (error) {
        console.warn('[audio-library] store load error', error.message);
      }
    }
    return loadLibraryFromFile();
  }

  async function saveLibrary(ns, items) {
    saveLibraryToFile(items);
    if (store && ns) {
      try {
        await store.set(ns, 'audio-library', items);
      } catch (error) {
        console.warn('[audio-library] store save error', error.message);
      }
    }
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

  app.get('/api/audio-settings', async (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
      const ns = hasNs ? req.ns.admin || req.ns.pub : null;
      if (!isOpenTestMode() && (requireSessionFlag || hosted) && !hasNs) {
        const sanitized = ensureSettingsShape({
          audioSource: 'remote',
          hasCustomAudio: false,
          enabled: true,
          volume: 0.5,
        });
        return res.json({ ...sanitized, libraryItem: null });
      }

      let settings = ensureSettingsShape(loadAudioSettings(AUDIO_CONFIG_FILE));
      if (store && hasNs) {
        try {
          const st = await store.get(ns, 'audio-settings', null);
          if (st && typeof st === 'object') {
            settings = ensureSettingsShape(st);
          }
        } catch (error) {
          console.error('Error loading tenant audio settings:', error);
        }
      }

      const libraryItem = settings.audioLibraryId
        ? await findLibraryEntry(ns, settings.audioLibraryId)
        : null;
      res.json({ ...settings, libraryItem });
    } catch (error) {
      console.error('Error getting audio settings:', error);
      res.status(500).json({ error: 'Error al cargar configuración de audio' });
    }
  });

  app.get('/api/audio-settings/library', async (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
      if (!isOpenTestMode() && (requireSessionFlag || hosted) && !hasNs) {
        return res.status(401).json({ error: 'no_session' });
      }
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      const items = await loadLibrary(ns);
      res.json({ items });
    } catch (error) {
      console.error('[audio-library] list error', error.message);
      res.status(500).json({ error: 'audio_library_list_failed' });
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
      const selectedAudioIdRaw = req.body.selectedAudioId;
      const selectedAudioId =
        typeof selectedAudioIdRaw === 'string' && selectedAudioIdRaw.trim()
          ? selectedAudioIdRaw.trim()
          : '';
      const preferredProviderRaw =
        typeof req.body.storageProvider === 'string' ? req.body.storageProvider : '';
      const preferredProvider = normalizeProvider(preferredProviderRaw);

      if (!audioSource || (audioSource !== 'remote' && audioSource !== 'custom')) {
        return res.status(400).json({ error: 'Invalid audio source' });
      }

      let libraryItem = null;
      let currentSettings = null;
      if (ns && store) {
        try {
          currentSettings = await store.get(ns, 'audio-settings', null);
          if (!currentSettings) {
            currentSettings = ensureSettingsShape({
              audioSource: 'remote',
              hasCustomAudio: false,
              audioFileName: null,
              audioFileSize: 0,
              audioFileUrl: null,
              audioFilePath: null,
              enabled: true,
              volume: 0.5,
            });
          } else {
            currentSettings = ensureSettingsShape(currentSettings);
          }
        } catch (error) {
          console.error('Error loading current tenant audio settings:', error);
          currentSettings = ensureSettingsShape({
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
      } else {
        currentSettings = ensureSettingsShape(loadAudioSettings(AUDIO_CONFIG_FILE));
      }

      const settings = {
        audioSource,
        storageProvider: normalizeProvider(currentSettings?.storageProvider),
      };

      if (Object.prototype.hasOwnProperty.call(req.body, 'enabled')) {
        settings.enabled = req.body.enabled === 'true' || req.body.enabled === true ? true : false;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'volume')) {
        const vol = parseFloat(req.body.volume);
        if (!isNaN(vol)) settings.volume = Math.max(0, Math.min(1, vol));
      }

      if (audioSource === 'custom' && req.file) {
        const fileName = `custom-notification-audio-${ns ? ns.replace(/[^a-zA-Z0-9_-]/g, '_') : 'global'}-${Date.now()}.mp3`;

        try {
          const storageInstance = getStorage(preferredProvider || undefined);
          if (!storageInstance) {
            throw new Error('Storage service not configured');
          }

          const fileBuffer = req.file.buffer || Buffer.alloc(0);
          const fileHash =
            fileBuffer && fileBuffer.length
              ? crypto.createHash('sha256').update(fileBuffer).digest('hex')
              : '';
          const normalizedName = (req.file.originalname || fileName || '').toLowerCase();
          const fingerprint = `${normalizedName}::${req.file.size || 0}`;
          const uploadResult = await storageInstance.uploadFile(
            'tip-goal-audio',
            fileName,
            fileBuffer,
            {
              contentType: req.file.mimetype || 'audio/mpeg',
            }
          );

          const providerId = normalizeProvider(
            uploadResult.provider || storageInstance.provider || preferredProvider
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
              req.file.originalname ||
              uploadResult.originalName ||
              uploadResult.fileName ||
              derivedId,
            path: uploadResult.path || uploadResult.fileName || derivedId,
            uploadedAt: new Date().toISOString(),
            mimeType: req.file.mimetype || 'audio/mpeg',
            sha256: fileHash,
            fingerprint,
            provider: providerId,
          };

          settings.hasCustomAudio = true;
          settings.audioFileName = libraryItem.originalName;
          settings.audioFileSize = libraryItem.size;
          settings.audioFileUrl = libraryItem.url;
          settings.audioFilePath = libraryItem.path;
          settings.audioLibraryId = libraryItem.id;
          settings.storageProvider = providerId;
          await upsertLibraryEntry(ns, libraryItem);
        } catch (uploadError) {
          console.error('Error uploading audio file:', uploadError);
          if (uploadError.code === 'TURBO_FILE_TOO_LARGE') {
            return res.status(400).json({ error: 'File too large for free upload. Maximum 100KB. Try using a smaller file or switch to Supabase storage.' });
          }
          if (uploadError.code === 'TURBO_INSUFFICIENT_BALANCE') {
            return res.status(400).json({ error: 'Upload not possible with Turbo. Please switch to Supabase storage.' });
          }
          return res.status(500).json({ error: 'Error uploading audio file' });
        }
      } else if (audioSource === 'custom' && selectedAudioId) {
        try {
          const entry = await findLibraryEntry(ns, selectedAudioId);
          if (!entry) {
            return res.status(404).json({ error: 'audio_library_item_not_found' });
          }
          const providerId = normalizeProvider(entry.provider);
          settings.hasCustomAudio = true;
          settings.audioFileName = entry.originalName || entry.id;
          settings.audioFileSize = Number(entry.size) || 0;
          settings.audioFileUrl = entry.url || null;
          settings.audioFilePath = entry.path || entry.id || null;
          settings.audioLibraryId = entry.id;
          settings.storageProvider = providerId;
          libraryItem = entry;
        } catch (lookupError) {
          console.error('[audio-library] lookup error', lookupError.message);
          return res.status(500).json({ error: 'audio_library_lookup_failed' });
        }
      } else if (audioSource === 'remote') {
        const shouldDeleteStoredFile =
          currentSettings.audioFilePath && !currentSettings.audioLibraryId;
        if (
          shouldDeleteStoredFile &&
          normalizeProvider(currentSettings.storageProvider) === STORAGE_PROVIDERS.SUPABASE
        ) {
          try {
            const storageInstance = getStorage(STORAGE_PROVIDERS.SUPABASE);
            if (storageInstance && storageInstance.provider === STORAGE_PROVIDERS.SUPABASE) {
              await storageInstance.deleteFile('tip-goal-audio', currentSettings.audioFilePath);
            }
          } catch (deleteError) {
            console.warn('Error deleting old audio file from Supabase:', deleteError);
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

      let success = false;
      let payload = null;

      const merged = ensureSettingsShape({ ...currentSettings, ...settings });
      success = saveAudioSettings(AUDIO_CONFIG_FILE, merged);
      if (success) {
        payload = merged;
        if (ns && store) {
          try {
            await store.set(ns, 'audio-settings', merged);
          } catch (error) {
            console.error('Error saving tenant audio settings:', error);
          }
        }
      } else {
        return res.status(500).json({ error: 'Error saving audio configuration' });
      }

      try {
        if (ns && store) {
          if (typeof wss.broadcast === 'function') {
            wss.broadcast(ns, { type: 'audioSettingsUpdate', data: payload });
          } else {
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'audioSettingsUpdate', data: payload }));
              }
            });
          }
        } else {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'audioSettingsUpdate', data: payload }));
            }
          });
        }
      } catch (broadcastError) {
        console.warn('Error broadcasting audio settings update:', broadcastError);
      }

      res.json({
        success: true,
        message: 'Audio configuration successfully saved',
        settings: payload,
        libraryItem,
      });
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

  app.delete('/api/audio-settings/library/:id', async (req, res) => {
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
      const entryId = typeof req.params?.id === 'string' ? req.params.id.trim() : '';
      if (!entryId) {
        return res.status(400).json({ error: 'invalid_library_id' });
      }

      const items = await loadLibrary(ns);
      const target = items.find((item) => item && item.id === entryId) || null;
      if (!target) {
        return res.status(404).json({ error: 'audio_library_item_not_found' });
      }

      const providerId = normalizeProvider(target.provider);
      if (providerId && providerId !== STORAGE_PROVIDERS.SUPABASE) {
        return res.status(400).json({ error: 'audio_library_delete_unsupported' });
      }

      if (providerId === STORAGE_PROVIDERS.SUPABASE && target.path) {
        try {
          const storageInstance = getStorage(STORAGE_PROVIDERS.SUPABASE);
          if (storageInstance && storageInstance.provider === STORAGE_PROVIDERS.SUPABASE) {
            await storageInstance.deleteFile('tip-goal-audio', target.path);
          }
        } catch (deleteError) {
          console.warn('[audio-library] failed to delete Supabase file:', deleteError.message);
        }
      }

      const updatedItems = items.filter((item) => item && item.id !== entryId);
      await saveLibrary(ns, updatedItems);

      let settingsPayload = null;
      const currentSettings = ensureSettingsShape(loadAudioSettings(AUDIO_CONFIG_FILE));
      if (ns && store) {
        try {
          const storedSettings = await store.get(ns, 'audio-settings', null);
          if (storedSettings && typeof storedSettings === 'object') {
            const normalized = ensureSettingsShape(storedSettings);
            if (normalized.audioLibraryId === entryId) {
              const merged = ensureSettingsShape({
                ...normalized,
                audioSource: 'remote',
                hasCustomAudio: false,
                audioFileName: null,
                audioFileSize: 0,
                audioFileUrl: null,
                audioFilePath: null,
                audioLibraryId: '',
                storageProvider: '',
              });
              saveAudioSettings(AUDIO_CONFIG_FILE, merged);
              await store.set(ns, 'audio-settings', merged);
              settingsPayload = merged;
            }
          }
        } catch (settingsError) {
          console.warn(
            '[audio-library] failed to reset audio settings after deletion:',
            settingsError.message
          );
        }
      } else {
        if (currentSettings.audioLibraryId === entryId) {
          const merged = ensureSettingsShape({
            ...currentSettings,
            audioSource: 'remote',
            hasCustomAudio: false,
            audioFileName: null,
            audioFileSize: 0,
            audioFileUrl: null,
            audioFilePath: null,
            audioLibraryId: '',
            storageProvider: '',
          });
          const saved = saveAudioSettings(AUDIO_CONFIG_FILE, merged);
          if (saved) {
            settingsPayload = merged;
          }
        }
      }

      if (settingsPayload) {
        try {
          if (ns && store) {
            if (typeof wss.broadcast === 'function') {
              wss.broadcast(ns, { type: 'audioSettingsUpdate', data: settingsPayload });
            } else {
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(
                    JSON.stringify({ type: 'audioSettingsUpdate', data: settingsPayload })
                  );
                }
              });
            }
          } else {
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'audioSettingsUpdate', data: settingsPayload }));
              }
            });
          }
        } catch (broadcastError) {
          console.warn(
            'Error broadcasting audio settings update after library delete:',
            broadcastError
          );
        }
      }

      return res.json({ success: true });
    } catch (error) {
      console.error('[audio-library] delete error', error);
      return res.status(500).json({ error: 'audio_library_delete_failed' });
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
            currentSettings = ensureSettingsShape({
              audioSource: 'remote',
              hasCustomAudio: false,
              audioFileName: null,
              audioFileSize: 0,
              audioFileUrl: null,
              audioFilePath: null,
              enabled: true,
              volume: 0.5,
            });
          } else {
            currentSettings = ensureSettingsShape(currentSettings);
          }
        } catch (error) {
          console.error('Error loading current tenant audio settings for delete:', error);
          currentSettings = ensureSettingsShape({
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
      } else {
        currentSettings = ensureSettingsShape(loadAudioSettings(AUDIO_CONFIG_FILE));
      }

      const shouldDeleteStoredFile =
        currentSettings.audioFilePath && !currentSettings.audioLibraryId;
      if (
        shouldDeleteStoredFile &&
        normalizeProvider(currentSettings.storageProvider) === STORAGE_PROVIDERS.SUPABASE
      ) {
        try {
          const storageInstance = getStorage(STORAGE_PROVIDERS.SUPABASE);
          if (storageInstance && storageInstance.provider === STORAGE_PROVIDERS.SUPABASE) {
            await storageInstance.deleteFile('tip-goal-audio', currentSettings.audioFilePath);
          }
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
        audioLibraryId: '',
        storageProvider: '',
      };

      let success = false;
      let payload = null;

      const merged = ensureSettingsShape({ ...currentSettings, ...resetSettings });
      success = saveAudioSettings(AUDIO_CONFIG_FILE, merged);
      if (success) {
        payload = merged;
        if (ns && store) {
          try {
            await store.set(ns, 'audio-settings', merged);
          } catch (error) {
            console.error('Error resetting tenant audio settings:', error);
          }
        }
      } else {
        return res.status(500).json({ error: 'Error deleting audio configuration' });
      }

      try {
        if (ns && store) {
          if (typeof wss.broadcast === 'function') {
            wss.broadcast(ns, { type: 'audioSettingsUpdate', data: payload });
          } else {
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN)
                client.send(JSON.stringify({ type: 'audioSettingsUpdate', data: payload }));
            });
          }
        } else {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN)
              client.send(JSON.stringify({ type: 'audioSettingsUpdate', data: payload }));
          });
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
