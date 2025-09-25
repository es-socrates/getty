const multer = require('multer');
const axios = require('axios');
const { z } = require('zod');
const __faviconCache = Object.create(null);
const { isOpenTestMode } = require('../lib/test-open-mode');
const { getStorage } = require('../lib/supabase-storage');
const FAVICON_TTL_MS = 60 * 60 * 1000;

function registerAnnouncementRoutes(app, announcementModule, limiters) {
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const hostedWithRedis = !!process.env.REDIS_URL;
  const shouldRequireSession = (requireSessionFlag || hostedWithRedis);
  const isTestEnv = process.env.NODE_ENV === 'test';
  const allowRealSupabaseInTests = process.env.SUPABASE_TEST_USE_REAL === '1';
  const shouldMockStorage = isTestEnv && !allowRealSupabaseInTests;
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
      let imageUrl = null;
      if (req.file) {
        const ns = await resolveNsFromReq(req);
        const safeNs = ns ? ns.replace(/[^a-zA-Z0-9_-]/g, '_') : 'global';
        if (shouldMockStorage) {
          imageUrl = `https://mock.supabase.co/storage/v1/object/public/announcement-images/${safeNs}/announcement-${Date.now()}-${Math.random().toString(36).slice(2)}.${req.file.mimetype.split('/')[1]}`;
        } else {
          const storage = getStorage();
          if (!storage) {
            if (isTestEnv) {
              imageUrl = `https://mock.supabase.co/storage/v1/object/public/announcement-images/${safeNs}/announcement-${Date.now()}-${Math.random().toString(36).slice(2)}.${req.file.mimetype.split('/')[1]}`;
            } else {
              return res.status(500).json({ success: false, error: 'Storage service not configured' });
            }
          } else {
            const filePath = `${safeNs}/announcement-${Date.now()}-${Math.random().toString(36).slice(2)}.${req.file.mimetype.split('/')[1]}`;

            try {
              const uploadResult = await storage.uploadFile('announcement-images', filePath, req.file.buffer, {
                contentType: req.file.mimetype
              });
              imageUrl = uploadResult.publicUrl;
            } catch (uploadError) {
              console.error('Supabase upload error:', uploadError);
              return res.status(500).json({ success: false, error: 'Failed to upload file' });
            }
          }
        }
      }
      const ns = await resolveNsFromReq(req);
      const msg = await announcementModule.addMessage({
        text: (parsed.data.text ?? '').trim(),
        imageUrl,
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
        textSize: parsed.data.textSize
      }, ns);
      res.json({ success: true, message: msg });
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
        textSize: z.coerce.number().int().min(8).max(64).optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
      const ns = await resolveNsFromReq(req);
      const existing = await announcementModule.getMessage(req.params.id, ns);
      if (!existing) return res.status(404).json({ success: false, error: 'Not found' });
      const patch = { ...parsed.data };
      if (patch.linkUrl === '') patch.linkUrl = null;
      if (patch.removeImage) {
        if (!shouldMockStorage && existing.imageUrl && existing.imageUrl.includes('supabase')) {
          try {
            const storage = getStorage();
            if (storage) {

              const urlParts = existing.imageUrl.split('/storage/v1/object/public/');
              if (urlParts.length === 2) {
                const filePath = urlParts[1].split('/').slice(1).join('/'); // Remove bucket name
                await storage.deleteFile('announcement-images', filePath);
              }
            }
          } catch (deleteError) {
            console.warn('Failed to delete image from Supabase:', deleteError.message);
          }
        }
        patch.imageUrl = null;
        delete patch.removeImage;
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
      if (req.file) {
        if (!shouldMockStorage && existing.imageUrl && existing.imageUrl.includes('supabase')) {
          try {
            const storage = getStorage();
            if (storage) {

              const urlParts = existing.imageUrl.split('/storage/v1/object/public/');
              if (urlParts.length === 2) {
                const filePath = urlParts[1].split('/').slice(1).join('/');
                await storage.deleteFile('announcement-images', filePath);
              }
            }
          } catch (deleteError) {
            console.warn('Failed to delete old image from Supabase:', deleteError.message);
          }
        }

        const ns = await resolveNsFromReq(req);
        const safeNs = ns ? ns.replace(/[^a-zA-Z0-9_-]/g, '_') : 'global';
        if (shouldMockStorage) {
          patch.imageUrl = `https://mock.supabase.co/storage/v1/object/public/announcement-images/${safeNs}/announcement-${Date.now()}-${Math.random().toString(36).slice(2)}.${req.file.mimetype.split('/')[1]}`;
        } else {
          const storage = getStorage();
          if (!storage) {
            if (isTestEnv) {
              patch.imageUrl = `https://mock.supabase.co/storage/v1/object/public/announcement-images/${safeNs}/announcement-${Date.now()}-${Math.random().toString(36).slice(2)}.${req.file.mimetype.split('/')[1]}`;
            } else {
              return res.status(500).json({ success: false, error: 'Storage service not configured' });
            }
          } else {
            const filePath = `${safeNs}/announcement-${Date.now()}-${Math.random().toString(36).slice(2)}.${req.file.mimetype.split('/')[1]}`;

            try {
              const uploadResult = await storage.uploadFile('announcement-images', filePath, req.file.buffer, {
                contentType: req.file.mimetype
              });
              patch.imageUrl = uploadResult.publicUrl;
            } catch (uploadError) {
              console.error('Supabase upload error:', uploadError);
              return res.status(500).json({ success: false, error: 'Failed to upload file' });
            }
          }
        }
      }
      const updated = await announcementModule.updateMessage(req.params.id, patch, ns);
      res.json({ success: true, message: updated });
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
