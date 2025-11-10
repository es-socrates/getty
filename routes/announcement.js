const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const crypto = require('crypto');
const { z } = require('zod');
const __faviconCache = Object.create(null);
const { isOpenTestMode } = require('../lib/test-open-mode');
const { getStorage, STORAGE_PROVIDERS } = require('../lib/storage');
const FAVICON_TTL_MS = 60 * 60 * 1000;

function registerAnnouncementRoutes(app, announcementModule, limiters) {
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const hostedWithRedis = !!process.env.REDIS_URL;
  const shouldRequireSession = (requireSessionFlag || hostedWithRedis);
  const isTestEnv = process.env.NODE_ENV === 'test';
  const allowRealSupabaseInTests = process.env.SUPABASE_TEST_USE_REAL === '1';
  const shouldMockStorage = isTestEnv && !allowRealSupabaseInTests;
  const BUCKET_NAME = 'announcement-images';
  const HOSTED_ENV = hostedWithRedis;
  const store = announcementModule && announcementModule.store ? announcementModule.store : (app && typeof app.get === 'function' ? app.get('store') : null);
  const LIBRARY_FILE = path.join(process.cwd(), 'config', 'announcement-image-library.json');

  function normalizeLibraryEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = typeof raw.id === 'string' ? raw.id : '';
    if (!id) return null;
    const sizeNum = Number(raw.size);
    const widthNum = Number(raw.width);
    const heightNum = Number(raw.height);
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
      width: Number.isFinite(widthNum) && widthNum > 0 ? widthNum : undefined,
      height: Number.isFinite(heightNum) && heightNum > 0 ? heightNum : undefined,
    };
  }

  function loadLibraryFromFile() {
    try {
      if (fs.existsSync(LIBRARY_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
        const list = Array.isArray(parsed)
          ? parsed
          : parsed && Array.isArray(parsed.items)
            ? parsed.items
            : [];
        return list.map(normalizeLibraryEntry).filter(Boolean);
      }
    } catch (error) {
      console.error('[announcement-library] load error', error.message);
    }
    return [];
  }

  function saveLibraryToFile(items) {
    try {
      fs.writeFileSync(LIBRARY_FILE, JSON.stringify(items, null, 2));
    } catch (error) {
      console.error('[announcement-library] save error', error.message);
    }
  }

  async function loadLibrary(ns) {
    if (store && ns) {
      try {
        const stored = await store.get(ns, 'announcement-image-library', null);
        const list = Array.isArray(stored)
          ? stored
          : stored && Array.isArray(stored.items)
            ? stored.items
            : [];
        return list.map(normalizeLibraryEntry).filter(Boolean);
      } catch (error) {
        console.warn('[announcement-library] store load error', error.message);
      }
      return [];
    }
    return loadLibraryFromFile();
  }

  async function saveLibrary(ns, items) {
    if (store && ns) {
      try {
        await store.set(ns, 'announcement-image-library', items);
      } catch (error) {
        console.warn('[announcement-library] store save error', error.message);
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
    const maxItems = 100;
    const trimmed = updated.slice(0, maxItems);
    await saveLibrary(ns, trimmed);
    return trimmed;
  }

  async function findLibraryEntry(ns, entryId) {
    if (!entryId) return null;
    const items = await loadLibrary(ns);
    return items.find((item) => item && item.id === entryId) || null;
  }

  async function findLibraryDuplicate(ns, sha256, fingerprint) {
    if (!sha256 && !fingerprint) return null;
    const items = await loadLibrary(ns);
    return (
      items.find((item) => {
        if (!item) return false;
        if (sha256 && item.sha256 && item.sha256 === sha256) return true;
        if (fingerprint && item.fingerprint && item.fingerprint === fingerprint) return true;
        return false;
      }) || null
    );
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

  function sanitizeIncomingImageMeta(body = {}) {
    const stringOrEmpty = (val) => (typeof val === 'string' ? val : '');
    return {
      url: stringOrEmpty(body.imageUrl).trim(),
      libraryId: stringOrEmpty(body.imageLibraryId).trim(),
      storageProvider: stringOrEmpty(body.imageStorageProvider).trim(),
      storagePath: stringOrEmpty(body.imageStoragePath).trim(),
      sha256: stringOrEmpty(body.imageSha256).trim(),
      fingerprint: stringOrEmpty(body.imageFingerprint).trim(),
      originalName: stringOrEmpty(body.imageOriginalName).trim(),
    };
  }

  function buildImageFingerprint(name, size) {
    const normalized = (name || '').toLowerCase();
    const finalSize = Number.isFinite(size) ? Number(size) : Number(size) || 0;
    return `${normalized}::${finalSize}`;
  }

  async function deleteStoredImage(provider, storagePath) {
    if (provider === STORAGE_PROVIDERS.SUPABASE && storagePath) {
      try {
        const storage = getStorage(STORAGE_PROVIDERS.SUPABASE);
        await storage?.deleteFile(BUCKET_NAME, storagePath);
      } catch (error) {
        console.warn('[announcement] failed to delete stored image', error.message);
      }
    }
  }
  async function resolveNsFromReq(req) {
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (ns) return ns;
      const token = typeof req.query?.token === 'string' ? req.query.token : null;
      if (token && req.app && req.app.get && req.app.get('store')) {
        const st = req.app.get('store');
        try { const meta = await st.get(token, 'meta', null); if (meta) return token; } catch {}
      }
    } catch {}
    return null;
  }
  async function isAdminRequest(req) {
    try {
      const st = req?.app?.get && req.app.get('store');
      const token = req?.ns?.admin || req?.ns?.pub || null;
      if (!st || !token) return false;
      const meta = await st.get(token, 'meta', null);
      if (!meta) return false;

      return (meta.role && String(meta.role).toLowerCase() === 'admin');
    } catch { return false; }
  }
  function maskedDefaults() {

    return {
      messages: [],
      cooldownSeconds: 300,
      theme: 'horizontal',
      bgColor: '#0e1014',
      textColor: '#e8eef2',
      animationMode: 'fade',
      defaultDurationSeconds: 10,
      staticMode: false,
      bannerBgType: 'solid',
      gradientFrom: '#4f36ff',
      gradientTo: '#10d39e'
    };
  }
  const getLimiter = (key) => {
    if (typeof limiters === 'function') return limiters;
    if (limiters && typeof limiters[key] === 'function') return limiters[key];
    return (_req,_res,next)=>next();
  };

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 512 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = ['image/png', 'image/jpeg', 'image/gif'].includes(file.mimetype);
      cb(ok ? null : new Error('Invalid image type (png,jpg,gif only)'), ok);
    }
  });

  app.get('/api/announcement', getLimiter('config'), async (req, res) => {
    try {
      const ns = await resolveNsFromReq(req);
      const cfg = await announcementModule.getPublicConfig(ns);
  if (!isOpenTestMode() && (hostedWithRedis || requireSessionFlag)) {
        const isAdmin = await isAdminRequest(req);
        if (!isAdmin) {
          return res.json({ success: true, config: maskedDefaults() });
        }
      }
      return res.json({ success: true, config: cfg });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  app.get('/api/announcement/image-library', getLimiter('config'), async (req, res) => {
    try {
      if (!isOpenTestMode() && shouldRequireSession) {
        const nsTest = await resolveNsFromReq(req);
        if (!nsTest) return res.status(401).json({ error: 'session_required' });
      }
      const ns = await resolveNsFromReq(req);
      const items = await loadLibrary(ns);
      res.json({ items });
    } catch (error) {
      console.error('[announcement-library] list error', error.message);
      res.status(500).json({ error: 'library_list_failed' });
    }
  });

  app.post('/api/announcement', getLimiter('config'), async (req, res) => {
    try {
  if (!isOpenTestMode() && shouldRequireSession) {
        const ns = await resolveNsFromReq(req);
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const colorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
      const schema = z.object({
        cooldownSeconds: z.coerce.number().int().positive().max(86400).optional(),
        theme: z.literal('horizontal').optional(),
        bgColor: z.string().regex(colorRegex).optional(),
        textColor: z.string().regex(colorRegex).optional(),
        animationMode: z.enum(['fade','slide-up','slide-left','scale','random']).optional(),
        defaultDurationSeconds: z.coerce.number().int().min(1).max(60).optional(),
        applyAllDurations: z.union([z.boolean(), z.string()]).transform(v => v === true || v === 'true' || v === '1').optional(),
        staticMode: z.union([z.boolean(), z.string()]).transform(v => v === true || v === 'true' || v === '1').optional(),
        bannerBgType: z.enum(['solid','gradient']).optional(),
        gradientFrom: z.string().regex(colorRegex).optional(),
        gradientTo: z.string().regex(colorRegex).optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
      const ns = await resolveNsFromReq(req);
      const updated = await announcementModule.setSettings(parsed.data, ns);
      res.json({ success: true, config: updated });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/announcement/message', getLimiter('message'), upload.single('image'), async (req, res) => {
    try {
  if (!isOpenTestMode() && shouldRequireSession) {
        const ns = await resolveNsFromReq(req);
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const colorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
      const schema = z.object({
        text: z.string().trim().max(90).optional(),
        linkUrl: z.string().url().optional(),
        durationSeconds: z.coerce.number().int().min(1).max(60).optional(),
        title: z.string().trim().max(80).optional(),
        subtitle1: z.string().trim().max(90).optional(),
        subtitle2: z.string().trim().max(80).optional(),
        subtitle3: z.string().trim().max(50).optional(),
        titleColor: z.string().regex(colorRegex).optional(),
        subtitle1Color: z.string().regex(colorRegex).optional(),
        subtitle2Color: z.string().regex(colorRegex).optional(),
        subtitle3Color: z.string().regex(colorRegex).optional(),
        titleSize: z.coerce.number().int().min(8).max(72).optional(),
        subtitle1Size: z.coerce.number().int().min(8).max(64).optional(),
        subtitle2Size: z.coerce.number().int().min(8).max(64).optional(),
        subtitle3Size: z.coerce.number().int().min(8).max(64).optional(),
        ctaText: z.string().trim().max(40).optional(),
        ctaTextSize: z.coerce.number().int().min(8).max(64).optional(),
        ctaIcon: z.string().url().or(z.string().trim().max(200)).optional(),
        ctaBgColor: z.string().regex(colorRegex).optional(),
        textColorOverride: z.string().regex(colorRegex).optional(),
        textSize: z.coerce.number().int().min(8).max(64).optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
      const ns = await resolveNsFromReq(req);
      const incomingMeta = sanitizeIncomingImageMeta(req.body);
      let imagePayload = null;
      let libraryItem = null;
      let duplicateDetected = false;

      if (req.file) {
        const safeNs = ns ? ns.replace(/[^a-zA-Z0-9_-]/g, '_') : 'global';
        const fileBuffer = req.file.buffer || Buffer.alloc(0);
        const fileSize = Number.isFinite(req.file.size) ? Number(req.file.size) : fileBuffer.length;
        let fileHash = '';
        try {
          fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        } catch (hashError) {
          console.warn('[announcement] failed to hash upload', hashError.message);
        }
        const preferredProvider = typeof req.body?.storageProvider === 'string' ? req.body.storageProvider : '';
        const extFromName = path.extname(req.file.originalname || '').toLowerCase();
        const inferredExt = extFromName || `.${req.file.mimetype.split('/')[1] || 'png'}`;
        const fingerprint = buildImageFingerprint((req.file.originalname || '').toLowerCase(), fileSize || 0);

        const duplicateEntry = await findLibraryDuplicate(ns, fileHash, fingerprint);
        if (duplicateEntry) {
          duplicateDetected = true;
          libraryItem = duplicateEntry;
          imagePayload = mapEntryToImagePayload(duplicateEntry);
          await upsertLibraryEntry(ns, duplicateEntry);
        } else if (shouldMockStorage) {
          const stamp = Date.now();
          const baseName = `announcement-${stamp}-${Math.random().toString(36).slice(2)}${inferredExt}`;
          const entry = normalizeLibraryEntry({
            id: baseName,
            url: `https://mock.supabase.co/storage/v1/object/public/${BUCKET_NAME}/${safeNs}/${baseName}`,
            provider: STORAGE_PROVIDERS.SUPABASE,
            path: `${safeNs}/${baseName}`,
            size: fileSize,
            originalName: req.file.originalname || '',
            uploadedAt: new Date().toISOString(),
            sha256: fileHash,
            fingerprint,
            mimeType: req.file.mimetype || '',
          });
          await upsertLibraryEntry(ns, entry);
          libraryItem = entry;
          imagePayload = mapEntryToImagePayload(entry);
        } else {
          const storage = getStorage(preferredProvider);
          if (!storage) {
            if (isTestEnv) {
              const stamp = Date.now();
              const baseName = `announcement-${stamp}-${Math.random().toString(36).slice(2)}${inferredExt}`;
              const entry = normalizeLibraryEntry({
                id: baseName,
                url: `https://mock.supabase.co/storage/v1/object/public/${BUCKET_NAME}/${safeNs}/${baseName}`,
                provider: STORAGE_PROVIDERS.SUPABASE,
                path: `${safeNs}/${baseName}`,
                size: fileSize,
                originalName: req.file.originalname || '',
                uploadedAt: new Date().toISOString(),
                sha256: fileHash,
                fingerprint,
                mimeType: req.file.mimetype || '',
              });
              await upsertLibraryEntry(ns, entry);
              libraryItem = entry;
              imagePayload = mapEntryToImagePayload(entry);
            } else {
              return res.status(500).json({ success: false, error: 'Storage service not configured' });
            }
          } else {
            const fileName = `${safeNs}-announcement-${Date.now()}-${Math.random().toString(36).slice(2)}${inferredExt}`;
            try {
              const uploadResult = await storage.uploadFile(BUCKET_NAME, fileName, fileBuffer, {
                contentType: req.file.mimetype,
              });
              const entry = normalizeLibraryEntry({
                id: uploadResult.fileName,
                url: uploadResult.publicUrl,
                provider: uploadResult.provider || storage.provider || preferredProvider || STORAGE_PROVIDERS.SUPABASE,
                path: uploadResult.path || uploadResult.fileName,
                size: fileSize,
                originalName: req.file.originalname || '',
                uploadedAt: new Date().toISOString(),
                sha256: fileHash,
                fingerprint,
                mimeType: req.file.mimetype || '',
              });
              await upsertLibraryEntry(ns, entry);
              libraryItem = entry;
              imagePayload = mapEntryToImagePayload(entry);
            } catch (uploadError) {
              console.error('Announcement upload error:', uploadError);
              return res.status(500).json({ success: false, error: 'Failed to upload file' });
            }
          }
        }
      } else if (incomingMeta.libraryId) {
        const entry = await findLibraryEntry(ns, incomingMeta.libraryId);
        if (entry) {
          await upsertLibraryEntry(ns, entry);
          libraryItem = entry;
          imagePayload = mapEntryToImagePayload(entry);
        } else if (incomingMeta.url) {
          imagePayload = incomingMeta;
        }
      } else if (incomingMeta.url) {
        imagePayload = incomingMeta;
      }

      const msg = await announcementModule.addMessage({
        text: (parsed.data.text ?? '').trim(),
        imageUrl: imagePayload ? imagePayload.url : null,
        linkUrl: parsed.data.linkUrl,
        durationSeconds: parsed.data.durationSeconds,
        title: parsed.data.title,
        subtitle1: parsed.data.subtitle1,
        subtitle2: parsed.data.subtitle2,
        subtitle3: parsed.data.subtitle3,
        titleColor: parsed.data.titleColor,
        subtitle1Color: parsed.data.subtitle1Color,
        subtitle2Color: parsed.data.subtitle2Color,
        subtitle3Color: parsed.data.subtitle3Color,
        titleSize: parsed.data.titleSize,
        subtitle1Size: parsed.data.subtitle1Size,
        subtitle2Size: parsed.data.subtitle2Size,
        subtitle3Size: parsed.data.subtitle3Size,
        ctaText: parsed.data.ctaText,
        ctaTextSize: parsed.data.ctaTextSize,
        ctaIcon: parsed.data.ctaIcon,
        ctaBgColor: parsed.data.ctaBgColor,
        textColorOverride: parsed.data.textColorOverride,
        textSize: parsed.data.textSize,
        imageLibraryId: imagePayload ? imagePayload.libraryId : '',
        imageStorageProvider: imagePayload ? imagePayload.storageProvider : '',
        imageStoragePath: imagePayload ? imagePayload.storagePath : '',
        imageSha256: imagePayload ? imagePayload.sha256 : '',
        imageFingerprint: imagePayload ? imagePayload.fingerprint : '',
        imageOriginalName: imagePayload ? imagePayload.originalName : '',
      }, ns);
      res.json({ success: true, message: msg, duplicate: duplicateDetected, libraryItem: libraryItem || null });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  app.put('/api/announcement/message/:id', getLimiter('message'), async (req, res) => {
    try {
  if (!isOpenTestMode() && shouldRequireSession) {
        const ns = await resolveNsFromReq(req);
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const colorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  const schema = z.object({
        text: z.string().trim().max(90).optional(),
        enabled: z.union([z.boolean(), z.string()]).transform(v => v === true || v === 'true' || v === '1').optional(),
        linkUrl: z.string().url().optional().or(z.literal('')),
        removeImage: z.union([z.boolean(), z.string()]).transform(v => v === true || v === 'true' || v === '1').optional(),
        durationSeconds: z.coerce.number().int().min(1).max(60).optional(),
        title: z.string().trim().max(80).optional(),
        subtitle1: z.string().trim().max(90).optional(),
        subtitle2: z.string().trim().max(80).optional(),
        subtitle3: z.string().trim().max(50).optional(),
        titleColor: z.string().regex(colorRegex).optional(),
        subtitle1Color: z.string().regex(colorRegex).optional(),
        subtitle2Color: z.string().regex(colorRegex).optional(),
        subtitle3Color: z.string().regex(colorRegex).optional(),
        titleSize: z.coerce.number().int().min(8).max(72).optional(),
        subtitle1Size: z.coerce.number().int().min(8).max(64).optional(),
        subtitle2Size: z.coerce.number().int().min(8).max(64).optional(),
        subtitle3Size: z.coerce.number().int().min(8).max(64).optional(),
        ctaText: z.string().trim().max(40).optional(),
        ctaTextSize: z.coerce.number().int().min(8).max(64).optional(),
        ctaIcon: z.string().url().or(z.string().trim().max(200)).optional(),
        ctaBgColor: z.string().regex(colorRegex).optional(),
        textColorOverride: z.string().regex(colorRegex).optional(),
    textSize: z.coerce.number().int().min(8).max(64).optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    imageLibraryId: z.string().max(200).optional(),
    imageStorageProvider: z.string().max(50).optional(),
    imageStoragePath: z.string().max(400).optional(),
    imageSha256: z.string().max(128).optional(),
    imageFingerprint: z.string().max(256).optional(),
    imageOriginalName: z.string().max(260).optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
      const ns = await resolveNsFromReq(req);
      const existing = await announcementModule.getMessage(req.params.id, ns);
      if (!existing) return res.status(404).json({ success: false, error: 'Not found' });
      const patch = { ...parsed.data };
      const incomingMeta = sanitizeIncomingImageMeta(req.body);
      if (patch.linkUrl === '') patch.linkUrl = null;
      if (patch.removeImage) {
        await deleteStoredImage(existing.imageStorageProvider, existing.imageStoragePath);
        patch.imageUrl = null;
        patch.imageLibraryId = '';
        patch.imageStorageProvider = '';
        patch.imageStoragePath = '';
        patch.imageSha256 = '';
        patch.imageFingerprint = '';
        patch.imageOriginalName = '';
        delete patch.removeImage;
      } else if (incomingMeta.libraryId) {
        const entry = await findLibraryEntry(ns, incomingMeta.libraryId);
        if (entry) {
          patch.imageUrl = entry.url;
          patch.imageLibraryId = entry.id;
          patch.imageStorageProvider = entry.provider;
          patch.imageStoragePath = entry.path;
          patch.imageSha256 = entry.sha256;
          patch.imageFingerprint = entry.fingerprint;
          patch.imageOriginalName = entry.originalName;
          await upsertLibraryEntry(ns, entry);
        } else if (incomingMeta.url) {
          patch.imageUrl = incomingMeta.url;
          patch.imageLibraryId = incomingMeta.libraryId;
          patch.imageStorageProvider = incomingMeta.storageProvider;
          patch.imageStoragePath = incomingMeta.storagePath;
          patch.imageSha256 = incomingMeta.sha256;
          patch.imageFingerprint = incomingMeta.fingerprint;
          patch.imageOriginalName = incomingMeta.originalName;
        }
      } else if (incomingMeta.url) {
        patch.imageUrl = incomingMeta.url;
        patch.imageLibraryId = incomingMeta.libraryId;
        patch.imageStorageProvider = incomingMeta.storageProvider;
        patch.imageStoragePath = incomingMeta.storagePath;
        patch.imageSha256 = incomingMeta.sha256;
        patch.imageFingerprint = incomingMeta.fingerprint;
        patch.imageOriginalName = incomingMeta.originalName;
      }
      const updated = await announcementModule.updateMessage(req.params.id, patch, ns);
      res.json({ success: true, message: updated });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.put('/api/announcement/message/:id/image', getLimiter('message'), upload.single('image'), async (req, res) => {
    try {
  if (!isOpenTestMode() && shouldRequireSession) {
        const ns = await resolveNsFromReq(req);
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const ns = await resolveNsFromReq(req);
      const existing = await announcementModule.getMessage(req.params.id, ns);
      if (!existing) return res.status(404).json({ success: false, error: 'Not found' });
      const schema = z.object({ text: z.string().trim().max(90).optional(), linkUrl: z.string().url().optional(), enabled: z.union([z.boolean(), z.string()]).transform(v => v === true || v === 'true' || v === '1').optional(), durationSeconds: z.coerce.number().int().min(1).max(60).optional() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
      const patch = { ...parsed.data };
      const incomingMeta = sanitizeIncomingImageMeta(req.body);
      const requestedLibraryId = incomingMeta.libraryId || (typeof req.body?.libraryId === 'string' ? req.body.libraryId.trim() : '');
      let libraryItem = null;
      let duplicateDetected = false;

      const removePreviousIfNeeded = async (nextLibraryId = '', nextProvider = '', nextPath = '') => {
        const prevProvider = existing.imageStorageProvider || '';
        const prevPath = existing.imageStoragePath || '';
        const prevLibraryId = existing.imageLibraryId || '';
        if (prevProvider !== STORAGE_PROVIDERS.SUPABASE || !prevPath) return;
        const normalizedNextLibraryId = typeof nextLibraryId === 'string' ? nextLibraryId : '';
        if (prevLibraryId && normalizedNextLibraryId && prevLibraryId === normalizedNextLibraryId) return;
        const normalizedNextPath = typeof nextPath === 'string' ? nextPath : '';
        const normalizedNextProvider = typeof nextProvider === 'string' ? nextProvider : '';
        if (normalizedNextPath && normalizedNextPath === prevPath && normalizedNextProvider === prevProvider) return;
        await deleteStoredImage(prevProvider, prevPath);
      };

      if (req.file) {
        const safeNs = ns ? ns.replace(/[^a-zA-Z0-9_-]/g, '_') : 'global';
        const fileBuffer = req.file.buffer || Buffer.alloc(0);
        const fileSize = Number.isFinite(req.file.size) ? Number(req.file.size) : fileBuffer.length;
        let fileHash = '';
        try {
          fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        } catch (hashError) {
          console.warn('[announcement] failed to hash upload', hashError.message);
        }
        const preferredProvider = typeof req.body?.storageProvider === 'string' ? req.body.storageProvider : '';
        const extFromName = path.extname(req.file.originalname || '').toLowerCase();
        const inferredExt = extFromName || `.${req.file.mimetype.split('/')[1] || 'png'}`;
        const fingerprint = buildImageFingerprint((req.file.originalname || '').toLowerCase(), fileSize || 0);

        const duplicateEntry = await findLibraryDuplicate(ns, fileHash, fingerprint);
        if (duplicateEntry) {
          duplicateDetected = true;
          libraryItem = duplicateEntry;
          patch.imageUrl = duplicateEntry.url;
          patch.imageLibraryId = duplicateEntry.id;
          patch.imageStorageProvider = duplicateEntry.provider;
          patch.imageStoragePath = duplicateEntry.path;
          patch.imageSha256 = duplicateEntry.sha256;
          patch.imageFingerprint = duplicateEntry.fingerprint;
          patch.imageOriginalName = duplicateEntry.originalName;
          await upsertLibraryEntry(ns, duplicateEntry);
        } else if (shouldMockStorage) {
          const stamp = Date.now();
          const baseName = `announcement-${stamp}-${Math.random().toString(36).slice(2)}${inferredExt}`;
          const entry = normalizeLibraryEntry({
            id: baseName,
            url: `https://mock.supabase.co/storage/v1/object/public/${BUCKET_NAME}/${safeNs}/${baseName}`,
            provider: STORAGE_PROVIDERS.SUPABASE,
            path: `${safeNs}/${baseName}`,
            size: fileSize,
            originalName: req.file.originalname || '',
            uploadedAt: new Date().toISOString(),
            sha256: fileHash,
            fingerprint,
            mimeType: req.file.mimetype || '',
          });
          await upsertLibraryEntry(ns, entry);
          libraryItem = entry;
          patch.imageUrl = entry.url;
          patch.imageLibraryId = entry.id;
          patch.imageStorageProvider = entry.provider;
          patch.imageStoragePath = entry.path;
          patch.imageSha256 = entry.sha256;
          patch.imageFingerprint = entry.fingerprint;
          patch.imageOriginalName = entry.originalName;
        } else {
          const storage = getStorage(preferredProvider);
          if (!storage) {
            if (isTestEnv) {
              const stamp = Date.now();
              const baseName = `announcement-${stamp}-${Math.random().toString(36).slice(2)}${inferredExt}`;
              const entry = normalizeLibraryEntry({
                id: baseName,
                url: `https://mock.supabase.co/storage/v1/object/public/${BUCKET_NAME}/${safeNs}/${baseName}`,
                provider: STORAGE_PROVIDERS.SUPABASE,
                path: `${safeNs}/${baseName}`,
                size: fileSize,
                originalName: req.file.originalname || '',
                uploadedAt: new Date().toISOString(),
                sha256: fileHash,
                fingerprint,
                mimeType: req.file.mimetype || '',
              });
              await upsertLibraryEntry(ns, entry);
              libraryItem = entry;
              patch.imageUrl = entry.url;
              patch.imageLibraryId = entry.id;
              patch.imageStorageProvider = entry.provider;
              patch.imageStoragePath = entry.path;
              patch.imageSha256 = entry.sha256;
              patch.imageFingerprint = entry.fingerprint;
              patch.imageOriginalName = entry.originalName;
            } else {
              return res.status(500).json({ success: false, error: 'Storage service not configured' });
            }
          } else {
            const fileName = `${safeNs}-announcement-${Date.now()}-${Math.random().toString(36).slice(2)}${inferredExt}`;
            try {
              const uploadResult = await storage.uploadFile(BUCKET_NAME, fileName, fileBuffer, {
                contentType: req.file.mimetype,
              });
              const entry = normalizeLibraryEntry({
                id: uploadResult.fileName,
                url: uploadResult.publicUrl,
                provider: uploadResult.provider || storage.provider || preferredProvider || STORAGE_PROVIDERS.SUPABASE,
                path: uploadResult.path || uploadResult.fileName,
                size: fileSize,
                originalName: req.file.originalname || '',
                uploadedAt: new Date().toISOString(),
                sha256: fileHash,
                fingerprint,
                mimeType: req.file.mimetype || '',
              });
              await upsertLibraryEntry(ns, entry);
              libraryItem = entry;
              patch.imageUrl = entry.url;
              patch.imageLibraryId = entry.id;
              patch.imageStorageProvider = entry.provider;
              patch.imageStoragePath = entry.path;
              patch.imageSha256 = entry.sha256;
              patch.imageFingerprint = entry.fingerprint;
              patch.imageOriginalName = entry.originalName;
            } catch (uploadError) {
              console.error('Announcement upload error:', uploadError);
              return res.status(500).json({ success: false, error: 'Failed to upload file' });
            }
          }
        }

        if (patch.imageUrl) {
          await removePreviousIfNeeded(patch.imageLibraryId, patch.imageStorageProvider, patch.imageStoragePath);
        }
      } else if (requestedLibraryId) {
        const entry = await findLibraryEntry(ns, requestedLibraryId);
        if (!entry) {
          return res.status(404).json({ success: false, error: 'library_item_not_found' });
        }
        await upsertLibraryEntry(ns, entry);
        libraryItem = entry;
        patch.imageUrl = entry.url;
        patch.imageLibraryId = entry.id;
        patch.imageStorageProvider = entry.provider;
        patch.imageStoragePath = entry.path;
        patch.imageSha256 = entry.sha256;
        patch.imageFingerprint = entry.fingerprint;
        patch.imageOriginalName = entry.originalName;
        await removePreviousIfNeeded(patch.imageLibraryId, patch.imageStorageProvider, patch.imageStoragePath);
      } else if (incomingMeta.url) {
        patch.imageUrl = incomingMeta.url;
        patch.imageLibraryId = incomingMeta.libraryId;
        patch.imageStorageProvider = incomingMeta.storageProvider;
        patch.imageStoragePath = incomingMeta.storagePath;
        patch.imageSha256 = incomingMeta.sha256;
        patch.imageFingerprint = incomingMeta.fingerprint;
        patch.imageOriginalName = incomingMeta.originalName;
        await removePreviousIfNeeded(patch.imageLibraryId, patch.imageStorageProvider, patch.imageStoragePath);
      }

      const updated = await announcementModule.updateMessage(req.params.id, patch, ns);
      res.json({ success: true, message: updated, duplicate: duplicateDetected, libraryItem: libraryItem || null });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/announcement/message/:id', getLimiter('message'), async (req, res) => {
    try {
  if (!isOpenTestMode() && shouldRequireSession) {
        const ns = await resolveNsFromReq(req);
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const ns = await resolveNsFromReq(req);
      const ok = await announcementModule.removeMessage(req.params.id, ns); res.json({ success: ok });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/announcement/messages', getLimiter('message'), async (req, res) => {
    try {
      if (shouldRequireSession) {
        const ns = await resolveNsFromReq(req);
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const ns = await resolveNsFromReq(req);
      const mode = req.query.mode === 'test' ? 'test' : 'all';
      const result = await announcementModule.clearMessages(mode, ns);
      res.json({ success: true, cleared: result, mode, config: await announcementModule.getPublicConfig(ns) });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/announcement/favicon', getLimiter('favicon'), async (req, res) => {
    try {
      const url = String(req.query.url || '').trim();
      if (!/^https?:\/\//i.test(url)) return res.status(400).json({ success: false, error: 'Invalid URL' });
      const u = new URL(url);
      const key = u.origin.toLowerCase();
      const now = Date.now();
      if (__faviconCache[key] && now - __faviconCache[key].ts < FAVICON_TTL_MS) {
        return res.json({ success: true, favicon: __faviconCache[key].dataUri });
      }

      const candidates = [
        `${u.origin}/favicon.ico`,
        `${u.origin}/favicon.png`
      ];
      let dataUri = null;
      for (const icoUrl of candidates) {
        const response = await axios.get(icoUrl, { responseType: 'arraybuffer', timeout: 5000 }).catch(() => null);
        if (response && response.status < 400 && response.data) {
          const mime = response.headers['content-type'] || (icoUrl.endsWith('.png') ? 'image/png' : 'image/x-icon');
          const b64 = Buffer.from(response.data).toString('base64');
            dataUri = `data:${mime};base64,${b64}`;
            break;
        }
      }
      __faviconCache[key] = { dataUri, ts: now };
      res.json({ success: true, favicon: dataUri });
      } catch {
        res.json({ success: true, favicon: null });
    }
  });
}

module.exports = registerAnnouncementRoutes;
