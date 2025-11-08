const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { z } = require('zod');
const { isTrustedLocalAdmin, shouldMaskSensitive } = require('../lib/trust');
const { isOpenTestMode } = require('../lib/test-open-mode');
const { getStorage } = require('../lib/supabase-storage');


function readGifDimensionsFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 10) {
    throw new Error('Invalid buffer');
  }

  const signature = buffer.toString('ascii', 0, 6);
  if (signature !== 'GIF87a' && signature !== 'GIF89a') {
    throw new Error('Invalid GIF signature');
  }

  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  return { width, height };
}

function registerTipNotificationGifRoutes(app, strictLimiter, { store } = {}) {
  const CONFIG_FILE = path.join(process.cwd(), 'config', 'tip-notification-config.json');
  const BUCKET_NAME = 'notification-gifs';
  const LIBRARY_FILE = path.join(process.cwd(), 'config', 'tip-notification-gif-library.json');
  const HOSTED_ENV = !!process.env.REDIS_URL;

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1024 * 1024 * 2 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === 'image/gif' || file.originalname.toLowerCase().endsWith('.gif')) {
        cb(null, true);
      } else {
        cb(new Error('Only GIF images are allowed'));
      }
    }
  });

  function ensureConfigShape(raw = {}) {
    const pos = typeof raw.position === 'string' && ['left', 'right', 'top', 'bottom'].includes(raw.position)
      ? raw.position
      : 'right';
    return {
      gifPath: typeof raw.gifPath === 'string' ? raw.gifPath : '',
      position: pos,
      width: Number.isFinite(raw.width) ? raw.width : Number(raw.width) || 0,
      height: Number.isFinite(raw.height) ? raw.height : Number(raw.height) || 0,
      libraryId: typeof raw.libraryId === 'string' ? raw.libraryId : ''
    };
  }

  function loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        return ensureConfigShape(parsed);
      }
    } catch {
      console.error('[gif-config] load error');
    }
    return ensureConfigShape();
  }

  function saveConfig(cfg) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(ensureConfigShape(cfg), null, 2));
  }

  function loadLibraryFromFile() {
    try {
      if (fs.existsSync(LIBRARY_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.items)) return parsed.items;
      }
    } catch (error) {
      console.error('[gif-library] load error', error.message);
    }
    return [];
  }

  function saveLibraryToFile(items) {
    try {
      fs.writeFileSync(LIBRARY_FILE, JSON.stringify(items, null, 2));
    } catch (error) {
      console.error('[gif-library] save error', error.message);
    }
  }

  async function loadLibrary(ns) {
    if (store && ns) {
      try {
        const stored = await store.get(ns, 'tip-notification-gif-library', null);
        if (Array.isArray(stored)) return stored;
        if (stored && Array.isArray(stored.items)) return stored.items;
      } catch (error) {
        console.warn('[gif-library] store load error', error.message);
      }
      return [];
    }
    return loadLibraryFromFile();
  }

  async function saveLibrary(ns, items) {
    if (store && ns) {
      try {
        await store.set(ns, 'tip-notification-gif-library', items);
      } catch (error) {
        console.warn('[gif-library] store save error', error.message);
      }
      if (!HOSTED_ENV) {
        saveLibraryToFile(items);
      }
      return;
    }
    saveLibraryToFile(items);
  }

  async function upsertLibraryEntry(ns, entry) {
    if (!entry || !entry.id) return;
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

  app.get('/api/tip-notification-gif', async (req, res) => {
    try {
      const cfg = loadConfig();
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
      const conceal = shouldMaskSensitive(req);
      const trusted = isTrustedLocalAdmin(req);

      if (!hasNs) {
        const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
        if (requireSessionFlag) {

          return res.json({ gifPath: '', width: 0, height: 0, libraryId: '' });
        }
        return res.json({ gifPath: '', position: 'right', width: 0, height: 0, libraryId: '' });
      }

      if (conceal && !trusted && !hasNs) {
        return res.json({ gifPath: '', width: 0, height: 0, libraryId: '' });
      }
      if (store && hasNs) {
        try {
          const ns = req.ns.admin || req.ns.pub;
          const st = await store.get(ns, 'tip-notification-gif', null);
          if (st && typeof st === 'object') {
            return res.json(ensureConfigShape(st));
          }
        } catch {}
        return res.json(ensureConfigShape());
      }
      res.json(cfg);
    } catch {
      res.status(500).json({ error: 'Error loading config' });
    }
  });

  app.get('/api/tip-notification-gif/library', strictLimiter, async (req, res) => {
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
      console.error('[gif-library] list error', error.message);
      res.status(500).json({ error: 'library_list_failed' });
    }
  });

  app.post('/api/tip-notification-gif', strictLimiter, (req, res, next) => {
    const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
    const hosted = !!process.env.REDIS_URL;
    const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
    const requireAdminWrites = (process.env.GETTY_REQUIRE_ADMIN_WRITE === '1') || hosted;
  if (!isOpenTestMode() && (requireSessionFlag || hosted) && !hasNs) {
      return res.status(401).json({ error: 'no_session' });
    }
  if (!isOpenTestMode() && requireAdminWrites) {
      const isAdmin = !!(req?.auth && req.auth.isAdmin);
      if (!isAdmin) return res.status(401).json({ error: 'admin_required' });
    }
    upload.single('gifFile')(req, res, function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const bodySchema = z
        .object({
          position: z.enum(['left', 'right', 'top', 'bottom']).default('right'),
          selectedGifId: z.string().max(220).optional().nullable()
        })
        .passthrough();
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid position' });
      const position = parsed.data.position;
      const selectedGifIdRaw = parsed.data.selectedGifId;
      const selectedGifId = typeof selectedGifIdRaw === 'string' && selectedGifIdRaw.trim()
        ? selectedGifIdRaw.trim()
        : null;
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      let config = ensureConfigShape(loadConfig());
      let libraryEntry = null;

      if (req.file) {

        let dims;
        try {
          dims = readGifDimensionsFromBuffer(req.file.buffer);
        } catch {
          return res.status(400).json({ error: 'Invalid GIF file' });
        }

        const storage = getStorage();
        if (!storage) {
          if (process.env.NODE_ENV === 'test') {
            const safeNs = ns ? ns.replace(/[^a-zA-Z0-9_-]/g, '_') : 'global';
            const mockUrl = `https://mock.supabase.co/storage/v1/object/public/notification-gifs/${safeNs}/tip-notification.gif`;
            config.gifPath = mockUrl;
            config.width = dims.width;
            config.height = dims.height;
            config.libraryId = '';
          } else {
            return res.status(500).json({ error: 'Storage service not configured' });
          }
        } else {
          const safeNs = ns ? ns.replace(/[^a-zA-Z0-9_-]/g, '_') : 'global';
          const filePath = `${safeNs}/tip-notification.gif`;

          try {
            const uploadResult = await storage.uploadFile(BUCKET_NAME, filePath, req.file.buffer, {
              contentType: 'image/gif'
            });

            config.gifPath = uploadResult.publicUrl;
            config.width = dims.width;
            config.height = dims.height;
            libraryEntry = {
              id: uploadResult.fileName,
              url: uploadResult.publicUrl,
              width: dims.width,
              height: dims.height,
              size: req.file.size || 0,
              originalName: req.file.originalname || '',
              uploadedAt: new Date().toISOString()
            };
            config.libraryId = libraryEntry.id;
            await upsertLibraryEntry(ns, libraryEntry);
          } catch (uploadError) {
            console.error('Supabase upload error:', uploadError);
            return res.status(500).json({ error: 'Failed to upload file' });
          }
        }
      } else if (selectedGifId) {
        try {
          const entry = await findLibraryEntry(ns, selectedGifId);
          if (!entry) {
            return res.status(404).json({ error: 'library_item_not_found' });
          }
          config.gifPath = entry.url || '';
          config.width = Number.isFinite(entry.width) ? entry.width : Number(entry.width) || 0;
          config.height = Number.isFinite(entry.height) ? entry.height : Number(entry.height) || 0;
          config.libraryId = entry.id;
          libraryEntry = entry;
        } catch (error) {
          console.error('[gif-library] lookup error', error.message);
          return res.status(500).json({ error: 'library_lookup_failed' });
        }
      }

      config.position = position;
      const hosted = !!process.env.REDIS_URL;
      if (store && ns) {
        try {
          await store.set(ns, 'tip-notification-gif', config);
        } catch {}
        if (!hosted) saveConfig(config);
        res.json({ success: true, ...config, libraryItem: libraryEntry });
      } else {
        saveConfig(config);
        res.json({ success: true, ...config, libraryItem: libraryEntry });
      }
    } catch (_e) {
      console.error('Error saving GIF config:', _e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/tip-notification-gif', strictLimiter, async (req, res) => {
    const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
    const hosted = !!process.env.REDIS_URL;
    if (process.env.GETTY_DISABLE_GIF_DELETE === '1') {
      return res.status(405).json({ error: 'gif_delete_disabled' });
    }
    const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
    const requireAdminWrites = (process.env.GETTY_REQUIRE_ADMIN_WRITE === '1') || hosted;
  if (!isOpenTestMode() && (requireSessionFlag || hosted) && !hasNs) {
      return res.status(401).json({ error: 'no_session' });
    }
  if (!isOpenTestMode() && requireAdminWrites) {
      const isAdmin = !!(req?.auth && req.auth.isAdmin);
      if (!isAdmin) return res.status(401).json({ error: 'admin_required' });
    }
  if (!isOpenTestMode() && !hosted && !requireSessionFlag && !isTrustedLocalAdmin(req)) {
      return res.status(403).json({ error: 'forbidden_untrusted_context' });
    }
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      let cfgToUse = ensureConfigShape(loadConfig());
      if (store && ns) {
        try {
          const st = await store.get(ns, 'tip-notification-gif', null);
          if (st && typeof st === 'object') cfgToUse = ensureConfigShape(st);
        } catch {}
      }

      const shouldDeleteStoredFile =
        cfgToUse.gifPath && !cfgToUse.libraryId && cfgToUse.gifPath.includes('supabase');
      if (shouldDeleteStoredFile) {
        const storage = getStorage();
        if (storage) {
          try {
            const urlParts = cfgToUse.gifPath.split('/storage/v1/object/public/');
            if (urlParts.length === 2) {
              const filePath = urlParts[1].split('/').slice(1).join('/');
              await storage.deleteFile(BUCKET_NAME, filePath);
            }
          } catch (deleteError) {
            console.warn('Failed to delete file from Supabase:', deleteError.message);
          }
        }
      }

      const cleared = { gifPath: '', position: 'right', width: 0, height: 0, libraryId: '' };
      const hosted = !!process.env.REDIS_URL;
      if (store && ns) {
        try { await store.set(ns, 'tip-notification-gif', cleared); } catch {}
        if (!hosted) saveConfig(cleared);
        return res.json({ success: true, ...cleared });
      }
      saveConfig(cleared);
      res.json({ success: true, ...cleared });
  } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

module.exports = registerTipNotificationGifRoutes;
