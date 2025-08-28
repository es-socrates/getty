const fs = require('fs');
const path = require('path');
const multer = require('multer');
const axios = require('axios');
const { z } = require('zod');
const { UPLOAD_DIR } = require('../modules/announcement');
const __faviconCache = Object.create(null);
const FAVICON_TTL_MS = 60 * 60 * 1000;

function registerAnnouncementRoutes(app, announcementModule, limiters) {
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const hostedWithRedis = !!process.env.REDIS_URL;
  const shouldRequireSession = requireSessionFlag || hostedWithRedis;
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
  const getLimiter = (key) => {
    if (typeof limiters === 'function') return limiters;
    if (limiters && typeof limiters[key] === 'function') return limiters[key];
    return (_req,_res,next)=>next();
  };
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, 'ann-' + Date.now() + '-' + Math.random().toString(36).slice(2) + ext);
    }
  });
  const upload = multer({
    storage,
    limits: { fileSize: 512 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = ['image/png', 'image/jpeg', 'image/gif'].includes(file.mimetype);
      cb(ok ? null : new Error('Invalid image type (png,jpg,gif only)'), ok);
    }
  });

  app.get('/api/announcement', getLimiter('config'), async (req, res) => {
    try {
      const ns = await resolveNsFromReq(req);
      const hasNs = !!ns;
      const cfg = announcementModule.getPublicConfig();
      if ((hostedWithRedis || requireSessionFlag) && !hasNs) {
        const masked = { ...cfg, messages: [] };
        return res.json({ success: true, config: masked });
      }
      res.json({ success: true, config: cfg });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  app.post('/api/announcement', getLimiter('config'), async (req, res) => {
    try {
      if (shouldRequireSession) {
        const ns = await resolveNsFromReq(req);
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const colorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
      const schema = z.object({
        cooldownSeconds: z.coerce.number().int().positive().max(86400).optional(),
        theme: z.enum(['vertical', 'horizontal']).optional(),
        bgColor: z.string().regex(colorRegex).optional(),
        textColor: z.string().regex(colorRegex).optional(),
        animationMode: z.enum(['fade','slide-up','slide-left','scale','random']).optional(),
        defaultDurationSeconds: z.coerce.number().int().min(1).max(60).optional(),
        applyAllDurations: z.union([z.boolean(), z.string()]).transform(v => v === true || v === 'true' || v === '1').optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
      const updated = announcementModule.setSettings(parsed.data);
      res.json({ success: true, config: updated });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/announcement/message', getLimiter('message'), upload.single('image'), async (req, res) => {
    try {
      if (shouldRequireSession) {
        const ns = await resolveNsFromReq(req);
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const schema = z.object({ text: z.string().trim().min(1).max(120), linkUrl: z.string().url().optional(), durationSeconds: z.coerce.number().int().min(1).max(60).optional() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
      let imageUrl = null;
      if (req.file) {
        imageUrl = '/uploads/announcement/' + req.file.filename;
      }
  const msg = announcementModule.addMessage({ text: parsed.data.text, imageUrl, linkUrl: parsed.data.linkUrl, durationSeconds: parsed.data.durationSeconds });
      res.json({ success: true, message: msg });
    } catch {
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  app.put('/api/announcement/message/:id', getLimiter('message'), async (req, res) => {
    try {
      if (shouldRequireSession) {
        const ns = await resolveNsFromReq(req);
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const schema = z.object({
        text: z.string().trim().min(1).max(120).optional(),
        enabled: z.union([z.boolean(), z.string()]).transform(v => v === true || v === 'true' || v === '1').optional(),
        linkUrl: z.string().url().optional().or(z.literal('')),
        removeImage: z.union([z.boolean(), z.string()]).transform(v => v === true || v === 'true' || v === '1').optional(),
        durationSeconds: z.coerce.number().int().min(1).max(60).optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
      const existing = announcementModule.getMessage(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Not found' });
      const patch = { ...parsed.data };
      if (patch.linkUrl === '') patch.linkUrl = null;
      if (patch.removeImage) {
        if (existing.imageUrl && existing.imageUrl.startsWith('/uploads/announcement/')) {
          try { fs.unlinkSync(path.join(process.cwd(), 'public', existing.imageUrl)); } catch {}
        }
        patch.imageUrl = null;
        delete patch.removeImage;
      }
      const updated = announcementModule.updateMessage(req.params.id, patch);
      res.json({ success: true, message: updated });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.put('/api/announcement/message/:id/image', getLimiter('message'), upload.single('image'), async (req, res) => {
    try {
      if (shouldRequireSession) {
        const ns = await resolveNsFromReq(req);
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const existing = announcementModule.getMessage(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Not found' });
      const schema = z.object({ text: z.string().trim().min(1).max(120).optional(), linkUrl: z.string().url().optional(), enabled: z.union([z.boolean(), z.string()]).transform(v => v === true || v === 'true' || v === '1').optional(), durationSeconds: z.coerce.number().int().min(1).max(60).optional() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
      const patch = { ...parsed.data };
      if (req.file) {
        if (existing.imageUrl && existing.imageUrl.startsWith('/uploads/announcement/')) {
          try { fs.unlinkSync(path.join(process.cwd(), 'public', existing.imageUrl)); } catch {}
        }
        patch.imageUrl = '/uploads/announcement/' + req.file.filename;
      }
      const updated = announcementModule.updateMessage(req.params.id, patch);
      res.json({ success: true, message: updated });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/announcement/message/:id', getLimiter('message'), async (req, res) => {
    try {
      if (shouldRequireSession) {
        const ns = await resolveNsFromReq(req);
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const ok = announcementModule.removeMessage(req.params.id); res.json({ success: ok });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/announcement/messages', getLimiter('message'), async (req, res) => {
    try {
      if (shouldRequireSession) {
        const ns = await resolveNsFromReq(req);
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const mode = req.query.mode === 'test' ? 'test' : 'all';
      const result = announcementModule.clearMessages(mode);
      res.json({ success: true, cleared: result, mode, config: announcementModule.getPublicConfig() });
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
