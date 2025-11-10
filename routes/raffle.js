const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');
const { z } = require('zod');
const { resolveAdminNamespace } = require('../lib/namespace');
const { getStorage, STORAGE_PROVIDERS } = require('../lib/storage');

function registerRaffleRoutes(app, raffle, wss, opts = {}) {
  const store = opts.store || null;
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const hostedWithRedis = !!process.env.REDIS_URL;
  const shouldRequireSession = requireSessionFlag || hostedWithRedis;
  const { isOpenTestMode } = require('../lib/test-open-mode');
  const BUCKET_NAME = 'raffle-images';
  const LIBRARY_FILE = path.join(process.cwd(), 'config', 'raffle-image-library.json');
  const HOSTED_ENV = hostedWithRedis;
  const isTestEnv = process.env.NODE_ENV === 'test';
  const allowRealSupabaseInTests = process.env.SUPABASE_TEST_USE_REAL === '1';
  const shouldMockStorage = isTestEnv && !allowRealSupabaseInTests;

  function normalizeLibraryEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = typeof raw.id === 'string' ? raw.id : '';
    if (!id) return null;
    const sizeNum = Number(raw.size);
    return {
      id,
      url: typeof raw.url === 'string' ? raw.url : '',
      size: Number.isFinite(sizeNum) && sizeNum >= 0 ? sizeNum : 0,
      originalName: typeof raw.originalName === 'string' ? raw.originalName : '',
      uploadedAt: typeof raw.uploadedAt === 'string' ? raw.uploadedAt : new Date(0).toISOString(),
      provider: typeof raw.provider === 'string' ? raw.provider : STORAGE_PROVIDERS.SUPABASE,
      path: typeof raw.path === 'string' ? raw.path : '',
      sha256: typeof raw.sha256 === 'string' ? raw.sha256 : '',
      fingerprint: typeof raw.fingerprint === 'string' ? raw.fingerprint : '',
      mimeType: typeof raw.mimeType === 'string' ? raw.mimeType : '',
    };
  }

  function loadLibraryFromFile() {
    try {
      if (fs.existsSync(LIBRARY_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
        const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.items) ? parsed.items : []);
        return list.map(normalizeLibraryEntry).filter(Boolean);
      }
    } catch (error) {
      console.error('[raffle-library] load error', error.message);
    }
    return [];
  }

  function saveLibraryToFile(items) {
    try {
      fs.writeFileSync(LIBRARY_FILE, JSON.stringify(items, null, 2));
    } catch (error) {
      console.error('[raffle-library] save error', error.message);
    }
  }

  async function loadLibrary(ns) {
    if (store && ns) {
      try {
        const stored = await store.get(ns, 'raffle-image-library', null);
        const list = Array.isArray(stored) ? stored : (stored && Array.isArray(stored.items) ? stored.items : []);
        return list.map(normalizeLibraryEntry).filter(Boolean);
      } catch (error) {
        console.warn('[raffle-library] store load error', error.message);
      }
      return [];
    }
    return loadLibraryFromFile();
  }

  async function saveLibrary(ns, items) {
    if (store && ns) {
      try {
        await store.set(ns, 'raffle-image-library', items);
      } catch (error) {
        console.warn('[raffle-library] store save error', error.message);
      }
      if (!HOSTED_ENV) {
        saveLibraryToFile(items);
      }
      return;
    }
    saveLibraryToFile(items);
  }

  async function upsertLibraryEntry(ns, entry) {
    if (!entry || !entry.id) return [];
    const normalized = normalizeLibraryEntry(entry);
    if (!normalized) return [];
    const current = await loadLibrary(ns);
    const filtered = current.filter((item) => item && item.id !== normalized.id);
    const updated = [normalized, ...filtered];
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

  function mapEntryToImagePayload(entry) {
    if (!entry) return null;
    return {
      url: entry.url || '',
      libraryId: entry.id || '',
      storageProvider: entry.provider || '',
      storagePath: entry.path || '',
      sha256: entry.sha256 || '',
      fingerprint: entry.fingerprint || '',
      originalName: entry.originalName || '',
    };
  }

  const raffleImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1024 * 1024 * 1 }, // 1MB limit
    fileFilter: (_req, file, cb) => {
      const allowedMimes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
      const isValidMime = allowedMimes.includes(file.mimetype);
      const isValidExt = allowedExtensions.some(ext => file.originalname.toLowerCase().endsWith(ext));
      
      if (isValidMime && isValidExt) {
        cb(null, true);
      } else {
        cb(new Error('Only PNG, JPEG, GIF, and WebP images are allowed'));
      }
    }
  });

  app.get('/api/raffle/settings', async (req, res) => {
    try {
      let adminNs = resolveAdminNamespace(req);
  if (!isOpenTestMode() && shouldRequireSession && !adminNs) {
        return res.json({});
      }
      const { settings, meta } = await raffle.getSettingsWithMeta(adminNs);
      const hosted = shouldRequireSession;
      try {
        const { canReadSensitive } = require('../lib/authz');
        const allowSensitive = canReadSensitive(req);
        if (hosted && !allowSensitive && settings && typeof settings === 'object') {
          const clone = { ...settings };
          if ('prize' in clone) clone.prize = '';
          if ('command' in clone) clone.command = '';
          return res.json({ data: clone, meta });
        }
      } catch {}
      res.json({ data: settings, meta });
    } catch (error) {
      console.error('Error in GET /api/raffle/settings:', error);
      res.status(500).json({ error: 'Error getting raffle settings', details: error.message });
    }
  });

  app.get('/api/raffle/state', async (req, res) => {
    try {
      let adminNs = resolveAdminNamespace(req);
  if (!isOpenTestMode() && shouldRequireSession && !adminNs) {
        return res.json({ active: false, paused: false, participants: [], totalWinners: 0 });
      }
      const state = await raffle.getPublicState(adminNs);
      const hosted = shouldRequireSession;
      try {
        const { canReadSensitive } = require('../lib/authz');
        const allowSensitive = canReadSensitive(req);
        if (hosted && !allowSensitive && state && typeof state === 'object') {
          const clone = { ...state };
          if ('prize' in clone) clone.prize = '';
          if ('command' in clone) clone.command = '';
          return res.json(clone);
        }
      } catch {}
      res.json(state);
    } catch (error) {
      console.error('Error in GET /api/raffle/state:', error);
      res.status(500).json({ error: 'Error getting raffle state', details: error.message });
    }
  });

  app.get('/api/raffle/image-library', async (req, res) => {
    try {
      const requireSession = shouldRequireSession;
      const adminNs = resolveAdminNamespace(req);
      if (!isOpenTestMode() && requireSession && !adminNs) {
        return res.status(401).json({ error: 'session_required' });
      }
      const items = await loadLibrary(adminNs);
      res.json({ items });
    } catch (error) {
      console.error('[raffle-library] list error', error.message);
      res.status(500).json({ error: 'library_list_failed' });
    }
  });

  app.post('/api/raffle/settings', async (req, res) => {
    try {
      let adminNs = resolveAdminNamespace(req);
    if (!isOpenTestMode() && shouldRequireSession && !adminNs) return res.status(401).json({ success: false, error: 'session_required' });
      const { canWriteConfig } = require('../lib/authz');
  if (!isOpenTestMode() && shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ success: false, error: 'forbidden_untrusted_remote_write' });
        }
      }
      const schema = z.object({
        command: z.string().trim().default('!giveaway'),
        prize: z.string().trim().min(1).max(15),
        duration: z.coerce.number().int().positive().default(5),
        maxWinners: z.coerce.number().int().positive().default(1),
        enabled: z
          .union([z.boolean(), z.string(), z.number()])
          .transform(v => v === true || v === 'true' || v === 1 || v === '1')
          .optional(),
        mode: z.enum(['manual', 'auto']).default('manual').optional(),
        interval: z.coerce.number().int().positive().default(5),
        imageUrl: z.string().optional().refine(v => {
          if (v === undefined || v === '') return true;
          if (typeof v !== 'string') return false;
          if (/^https?:\/\/.+/i.test(v)) return true;
          if (v.startsWith('/uploads/raffle/')) return true;
          return false;
        }, { message: 'Invalid URL' }),
        imageLibraryId: z.string().max(200).optional(),
        imageStorageProvider: z.string().max(50).optional(),
        imageStoragePath: z.string().max(400).optional(),
        imageSha256: z.string().max(128).optional(),
        imageFingerprint: z.string().max(256).optional(),
        imageOriginalName: z.string().max(260).optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        const first = parsed.error?.issues?.[0];
        const msg = first?.path?.length
          ? `${first.path.join('.')}: ${first.message}`
          : (first?.message || 'Invalid payload');
        return res.status(400).json({ success: false, error: msg });
      }
      const settings = parsed.data;
      await raffle.saveSettings(adminNs, settings);
      const { meta } = await raffle.getSettingsWithMeta(adminNs);
      res.json({ success: true, meta: meta || null });
    } catch (error) {
      console.error('Error in POST /api/raffle/settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/start', async (req, res) => {
    try {
      let adminNs = resolveAdminNamespace(req);
  if (!isOpenTestMode() && shouldRequireSession && !adminNs) return res.status(401).json({ success: false, error: 'session_required' });
      const { canWriteConfig } = require('../lib/authz');
  if (!isOpenTestMode() && shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ success: false, error: 'forbidden_untrusted_remote_write' });
        }
      }
      await raffle.start(adminNs);
      broadcastRaffleState(wss, raffle, adminNs);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/stop', async (req, res) => {
    try {
      let adminNs = resolveAdminNamespace(req);
  if (!isOpenTestMode() && shouldRequireSession && !adminNs) return res.status(401).json({ success: false, error: 'session_required' });
      const { canWriteConfig } = require('../lib/authz');
  if (!isOpenTestMode() && shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ success: false, error: 'forbidden_untrusted_remote_write' });
        }
      }
      await raffle.stop(adminNs);
      broadcastRaffleState(wss, raffle, adminNs);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/pause', async (req, res) => {
    try {
      let adminNs = req?.ns?.admin || null;
      if (!adminNs && req.query && req.query.ns) adminNs = String(req.query.ns);
      if (!adminNs && process.env.GETTY_MULTI_TENANT_WALLET === '1' && req.walletSession && req.walletSession.walletHash) {
        adminNs = req.walletSession.walletHash;
      }
  if (!isOpenTestMode() && shouldRequireSession && !adminNs) return res.status(401).json({ success: false, error: 'session_required' });
      const { canWriteConfig } = require('../lib/authz');
  if (!isOpenTestMode() && shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ success: false, error: 'forbidden_untrusted_remote_write' });
        }
      }
      await raffle.pause(adminNs);
      broadcastRaffleState(wss, raffle, adminNs);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/resume', async (req, res) => {
    try {
      let adminNs = resolveAdminNamespace(req);
  if (!isOpenTestMode() && shouldRequireSession && !adminNs) return res.status(401).json({ success: false, error: 'session_required' });
      const { canWriteConfig } = require('../lib/authz');
  if (!isOpenTestMode() && shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ success: false, error: 'forbidden_untrusted_remote_write' });
        }
      }
      await raffle.resume(adminNs);
      broadcastRaffleState(wss, raffle, adminNs);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/draw', async (req, res) => {
    try {
      let adminNs = resolveAdminNamespace(req);
      if (shouldRequireSession && !adminNs) return res.status(401).json({ success: false, error: 'session_required' });
      const { canWriteConfig } = require('../lib/authz');
      if (shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ success: false, error: 'forbidden_untrusted_remote_write' });
        }
      }
      const winner = await raffle.drawWinner(adminNs);
      broadcastRaffleWinner(wss, winner, adminNs);
      broadcastRaffleState(wss, raffle, adminNs);
      res.json({ success: true, winner });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/reset', async (req, res) => {
    try {
      const adminNs = req?.ns?.admin || null;
      if (shouldRequireSession && !adminNs) return res.status(401).json({ success: false, error: 'session_required' });
      const { canWriteConfig } = require('../lib/authz');
      if (shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ success: false, error: 'forbidden_untrusted_remote_write' });
        }
      }
      await raffle.resetWinners(adminNs);
      broadcastRaffleState(wss, raffle, adminNs, { reset: true });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/upload-image', raffleImageUpload.single('image'), async (req, res) => {
    const adminNs = resolveAdminNamespace(req);
    if (!isOpenTestMode() && shouldRequireSession && !adminNs) {
      return res.status(401).json({ error: 'session_required' });
    }

    const { canWriteConfig } = require('../lib/authz');
    if (!isOpenTestMode() && shouldRequireSession) {
      const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
      if (!allowRemoteWrites && !canWriteConfig(req)) {
        return res.status(403).json({ error: 'forbidden_untrusted_remote_write' });
      }
    }

    const preferredProvider = typeof req.body?.storageProvider === 'string' ? req.body.storageProvider : '';
    const requestedLibraryId = typeof req.body?.libraryId === 'string' ? req.body.libraryId.trim() : '';

    if (!req.file && !requestedLibraryId) {
      return res.status(400).json({ error: 'no_image_supplied' });
    }

    try {
      const prevState = await (async () => {
        try { return await raffle.getPublicState(adminNs); } catch { return null; }
      })();

      if (requestedLibraryId && !req.file) {
        const entry = await findLibraryEntry(adminNs, requestedLibraryId);
        if (!entry) {
          return res.status(404).json({ error: 'library_item_not_found' });
        }
        const payload = mapEntryToImagePayload(entry);
        await raffle.setImage(adminNs, payload);

        if (prevState && prevState.imageStorageProvider === STORAGE_PROVIDERS.SUPABASE) {
          const prevPath = prevState.imageStoragePath || '';
          const prevLib = prevState.imageLibraryId || '';
          const shouldDeletePrev = prevPath && prevLib && prevLib !== entry.id;
          if (shouldDeletePrev) {
            try {
              const prevStorage = getStorage(STORAGE_PROVIDERS.SUPABASE);
              await prevStorage?.deleteFile(BUCKET_NAME, prevPath);
            } catch (deleteError) {
              console.warn('[raffle] failed to delete previous image:', deleteError.message);
            }
          }
        }

        broadcastRaffleState(wss, raffle, adminNs);
        return res.json({
          success: true,
          imageUrl: entry.url,
          imageLibraryId: entry.id,
          imageStorageProvider: entry.provider,
          imageStoragePath: entry.path,
          imageSha256: entry.sha256,
          imageFingerprint: entry.fingerprint,
          imageOriginalName: entry.originalName,
          duplicate: true,
          libraryItem: entry,
        });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'no_file' });
      }

      const fileBuffer = req.file.buffer || Buffer.alloc(0);
      const sizeFromRequest = Number(req.file.size);
      const fileSize = Number.isFinite(sizeFromRequest) ? sizeFromRequest : fileBuffer.length;
      let fileHash = '';
      try {
        fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      } catch (hashError) {
        console.warn('[raffle] failed to compute image hash:', hashError.message);
      }
      const normalizedName = (req.file.originalname || '').trim().toLowerCase();
      const fingerprint = `${normalizedName || 'raffle-image'}::${fileSize || 0}`;

      const existingItems = await loadLibrary(adminNs);
      const duplicate = existingItems.find((item) => {
        if (fileHash && item.sha256 && item.sha256 === fileHash) return true;
        if (fingerprint && item.fingerprint && item.fingerprint === fingerprint) return true;
        const itemSize = Number(item.size) || 0;
        if (itemSize && fileSize && itemSize !== fileSize) return false;
        const entryName = (item.originalName || '').trim().toLowerCase();
        return entryName && entryName === normalizedName;
      });

      if (duplicate) {
        const payload = mapEntryToImagePayload(duplicate);
        await raffle.setImage(adminNs, payload);

        if (prevState && prevState.imageStorageProvider === STORAGE_PROVIDERS.SUPABASE) {
          const prevPath = prevState.imageStoragePath || '';
          const prevLib = prevState.imageLibraryId || '';
          const shouldDeletePrev = prevPath && prevLib && prevLib !== duplicate.id;
          if (shouldDeletePrev) {
            try {
              const prevStorage = getStorage(STORAGE_PROVIDERS.SUPABASE);
              await prevStorage?.deleteFile(BUCKET_NAME, prevPath);
            } catch (deleteError) {
              console.warn('[raffle] failed to delete previous image:', deleteError.message);
            }
          }
        }

        broadcastRaffleState(wss, raffle, adminNs);
        return res.json({
          success: true,
          imageUrl: duplicate.url,
          imageLibraryId: duplicate.id,
          imageStorageProvider: duplicate.provider,
          imageStoragePath: duplicate.path,
          imageSha256: duplicate.sha256,
          imageFingerprint: duplicate.fingerprint,
          imageOriginalName: duplicate.originalName,
          duplicate: true,
          libraryItem: duplicate,
        });
      }

      let uploadResult = null;
      if (shouldMockStorage) {
        const safeNs = (adminNs ? String(adminNs) : 'global').replace(/[^a-zA-Z0-9_-]/g, '_');
        const stamp = Date.now();
        const baseName = `raffle-${stamp}.png`;
        uploadResult = {
          publicUrl: `https://mock.supabase.co/storage/v1/object/public/${BUCKET_NAME}/${safeNs}/${baseName}`,
          provider: STORAGE_PROVIDERS.SUPABASE,
          path: `${safeNs}/${baseName}`,
          fileName: baseName,
        };
      } else {
        const storage = getStorage(preferredProvider);
        if (!storage) {
          return res.status(500).json({ error: 'storage_not_configured' });
        }

        const extFromName = path.extname(req.file.originalname || '').toLowerCase();
        const inferredExt = extFromName || `.${req.file.mimetype.split('/')[1] || 'png'}`;
        const safeBase = (adminNs ? adminNs : 'global').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${safeBase}-raffle-${Date.now()}-${Math.random().toString(36).slice(2)}${inferredExt}`;

        uploadResult = await storage.uploadFile(BUCKET_NAME, fileName, fileBuffer, {
          contentType: req.file.mimetype,
        });
      }

      const entry = normalizeLibraryEntry({
        id: uploadResult.fileName,
        url: uploadResult.publicUrl,
        provider: uploadResult.provider || preferredProvider || STORAGE_PROVIDERS.SUPABASE,
        path: uploadResult.path || uploadResult.fileName,
        size: fileSize,
        originalName: req.file.originalname || '',
        uploadedAt: new Date().toISOString(),
        sha256: fileHash,
        fingerprint,
        mimeType: req.file.mimetype || '',
      });

      await upsertLibraryEntry(adminNs, entry);
      await raffle.setImage(adminNs, mapEntryToImagePayload(entry));

      if (prevState && prevState.imageStorageProvider === STORAGE_PROVIDERS.SUPABASE) {
        const prevPath = prevState.imageStoragePath || '';
        const prevLib = prevState.imageLibraryId || '';
        const nextLib = entry.id || '';
        const shouldDeletePrev = prevPath && prevLib && prevLib !== nextLib;
        if (shouldDeletePrev) {
          try {
            const prevStorage = getStorage(STORAGE_PROVIDERS.SUPABASE);
            await prevStorage?.deleteFile(BUCKET_NAME, prevPath);
          } catch (deleteError) {
            console.warn('[raffle] failed to delete previous image:', deleteError.message);
          }
        }
      }

      broadcastRaffleState(wss, raffle, adminNs);
      res.json({
        success: true,
        imageUrl: entry.url,
        imageLibraryId: entry.id,
        imageStorageProvider: entry.provider,
        imageStoragePath: entry.path,
        imageSha256: entry.sha256,
        imageFingerprint: entry.fingerprint,
        imageOriginalName: entry.originalName,
        duplicate: false,
        libraryItem: entry,
      });
    } catch (error) {
      console.error('Error uploading raffle image:', error);
      res.status(500).json({ error: 'Failed to upload image', details: error.message });
    }
  });

  app.post('/api/raffle/clear-image', async (req, res) => {
    try {
      let adminNs = req?.ns?.admin || null;
      if (!adminNs && req.query && req.query.ns) adminNs = String(req.query.ns);
      if (!adminNs && process.env.GETTY_MULTI_TENANT_WALLET === '1' && req.walletSession && req.walletSession.walletHash) {
        adminNs = req.walletSession.walletHash;
      }
  if (!isOpenTestMode() && shouldRequireSession && !adminNs) return res.status(401).json({ success: false, error: 'session_required' });

      let currentState = null;
      try { currentState = await raffle.getPublicState(adminNs); } catch {}
      const currentUrl = currentState?.imageUrl || '';
      const currentProvider = currentState?.imageStorageProvider || '';
      const currentPath = currentState?.imageStoragePath || '';
      const { canWriteConfig } = require('../lib/authz');
      if (shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ success: false, error: 'forbidden_untrusted_remote_write' });
        }
      }
      await raffle.setImage(adminNs, '');

      if (currentProvider === STORAGE_PROVIDERS.SUPABASE && currentPath) {
        try {
          const removalStorage = getStorage(STORAGE_PROVIDERS.SUPABASE);
          await removalStorage?.deleteFile(BUCKET_NAME, currentPath);
        } catch (deleteError) {
          console.error('Error deleting raffle image from Supabase:', deleteError);
        }
      } else if (typeof currentUrl === 'string' && currentUrl.startsWith('/uploads/raffle/')) {
        const uploadsDir = path.resolve('./public/uploads/raffle');
        const rel = currentUrl.replace(/^\/+/, '');
        const abs = path.resolve(path.join('./public', rel));

        if (abs.startsWith(uploadsDir + path.sep) || abs === uploadsDir) {
          fs.promises.unlink(abs).catch(() => {});
        }
      }
      broadcastRaffleState(wss, raffle, adminNs);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  async function __broadcastToNsAndPublic(sendFn, adminNs, opts = {}) {
    try {
      if (!adminNs) return;
      await sendFn(adminNs);
      const { kind } = opts;
      const multiTenant = process.env.GETTY_MULTI_TENANT_WALLET === '1';
      const allowPublicWinner = process.env.GETTY_RAFFLE_BROADCAST_PUBLIC === '1';
      const shouldSendPublic = !multiTenant || kind !== 'winner' || allowPublicWinner;
      if (shouldSendPublic && store && typeof store.get === 'function') {
        try {
          const pubToken = await store.get(adminNs, 'publicToken', null);
          if (typeof pubToken === 'string' && pubToken) await sendFn(pubToken);
        } catch {}
      }
    } catch {}
  }

  function broadcastRaffleState(wss, raffle, ns, extra = {}) {
    const doSend = async (token) => {
      try {
        if (typeof wss.broadcast === 'function' && token) {
          const st = await raffle.getPublicState(token);
          wss.broadcast(token, { type: 'raffle_state', ...st, ...extra });
        } else {
          const st = await raffle.getPublicState(token);
          const payload = JSON.stringify({ type: 'raffle_state', ...st, ...extra });
          wss.clients.forEach(client => {
            try {
              if (client.readyState !== WebSocket.OPEN) return;
              if (token && client.nsToken && client.nsToken !== token) return;
              if (token && !client.nsToken) return;
              client.send(payload);
            } catch {}
          });
        }
      } catch {}
    };
    if (ns) {
      __broadcastToNsAndPublic(doSend, ns, { kind: 'state' });
    } else {
      doSend(null);
    }
  }

  function broadcastRaffleWinner(wss, winner, ns) {
    if (!ns) {
      return;
    }
    const doSend = async (token) => {
      try {
        const pub = await (async () => { try { return await raffle.getPublicState(token); } catch { return {}; } })();
        const payloadObj = {
          type: 'raffle_winner',
          ...(typeof winner === 'object' ? winner : { winner }),
          command: pub.command,
          prize: pub.prize,
          imageUrl: pub.imageUrl
        };

        if (typeof wss.broadcast === 'function' && token) {
          wss.broadcast(token, payloadObj);
        } else {
          const payload = JSON.stringify(payloadObj);
          wss.clients.forEach(client => {
            try {
              if (client.readyState !== WebSocket.OPEN) return;
              if (token && client.nsToken && client.nsToken !== token) return;
              if (token && !client.nsToken) return;
              client.send(payload);
            } catch {}
          });
        }
      } catch {}
    };
    if (ns) {
      __broadcastToNsAndPublic(doSend, ns, { kind: 'winner' });
    } else {
      doSend(null);
    }
  }
}

module.exports = registerRaffleRoutes;
