const { z } = require('zod');

function registerSocialMediaRoutes(app, socialMediaModule, strictLimiter) {
  app.get('/api/socialmedia-config', (_req, res) => {
    try {
      const config = socialMediaModule.loadConfig();
      res.json({ success: true, config });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/socialmedia-config', strictLimiter, (req, res) => {
    try {
  const env = process.env.NODE_ENV || 'development';
  const enforceHttpsOnly = (process.env.SOCIALMEDIA_HTTPS_ONLY === 'true') || env === 'production';
      const AdminItem = z.object({
        name: z.string(),
        icon: z.string(),
        link: z.string().url(),
        customIcon: z.string().optional()
      });
      const LegacyItem = z.object({
        platform: z.string(),
        enabled: z.boolean().optional(),
        url: z.string().url().optional(),
        handle: z.string().optional()
      });
      const schema = z.object({
        config: z.array(z.union([AdminItem, LegacyItem]))
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid config format' });
      const { config } = parsed.data;

      if (!Array.isArray(config) || config.length > 50) {
        return res.status(400).json({ success: false, error: 'Too many items (max 50)' });
      }

      const knownIcons = new Set(['x', 'instagram', 'youtube', 'telegram', 'discord', 'odysee', 'rumble']);
      const guessIcon = (platform) => {
        const key = String(platform || '').toLowerCase();
        if (knownIcons.has(key)) return key;
        if (key === 'twitter') return 'x';
        return 'custom';
      };
    const normalizedPreTrim = config.map(item => {
        if ('name' in item && 'icon' in item && 'link' in item) {
      const iconLc = String(item.icon || '').toLowerCase();
      const normalizedIcon = knownIcons.has(iconLc) || iconLc === 'custom' ? iconLc : 'custom';
      return { ...item, icon: normalizedIcon };
        }

        return {
          name: item.platform,
          icon: guessIcon(item.platform),
          link: item.url || '',
          customIcon: undefined
        };
      });

      const normalized = normalizedPreTrim.map(it => ({
        name: String(it.name || '').trim(),
        icon: String(it.icon || '').trim(),
        link: String(it.link || '').trim(),
        ...(it.customIcon ? { customIcon: String(it.customIcon).trim() } : {})
      }));

      const MAX_NAME = 50;
      const MAX_LINK = 2000;
      const MAX_CUSTOM_ICON_CHARS = 150_000;
      for (const [idx, item] of normalized.entries()) {
        if (!item.name) {
          console.warn('[socialmedia] reject:', { idx: idx + 1, reason: 'missing name' });
          return res.status(400).json({ success: false, error: `Item ${idx + 1}: name is required` });
        }
        if (item.name.length > MAX_NAME) {
          console.warn('[socialmedia] reject:', { idx: idx + 1, reason: 'name too long', len: item.name.length });
          return res.status(400).json({ success: false, error: `Item ${idx + 1}: name is too long (max ${MAX_NAME})` });
        }
        if (!item.link) {
          console.warn('[socialmedia] reject:', { idx: idx + 1, reason: 'missing link' });
          return res.status(400).json({ success: false, error: `Item ${idx + 1}: link is required` });
        }
        if (item.link.length > MAX_LINK) {
          console.warn('[socialmedia] reject:', { idx: idx + 1, reason: 'link too long', len: item.link.length });
          return res.status(400).json({ success: false, error: `Item ${idx + 1}: link is too long (max ${MAX_LINK})` });
        }
        try {
          const u = new URL(item.link);
          if (enforceHttpsOnly) {
            const isLocalhost = (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
            if (!(u.protocol === 'https:' || (u.protocol === 'http:' && isLocalhost))) {
              throw new Error('Non-HTTPS link rejected');
            }
          } else {
            if (!(u.protocol === 'http:' || u.protocol === 'https:')) {
              throw new Error('Unsupported protocol');
            }
          }
        } catch {
          const msg = enforceHttpsOnly ? 'link must be a valid HTTPS URL' : 'link must be a valid URL (http/https)';
          console.warn('[socialmedia] reject:', { idx: idx + 1, reason: msg, link: item.link });
          return res.status(400).json({ success: false, error: `Item ${idx + 1}: ${msg}` });
        }
        const iconLc = String(item.icon || '').toLowerCase();
        if (!(knownIcons.has(iconLc) || iconLc === 'custom')) {
          item.icon = 'custom';
        } else {
          item.icon = iconLc;
        }
        if (item.icon === 'custom') {
          if (!item.customIcon || !item.customIcon.startsWith('data:image/')) {
            console.warn('[socialmedia] reject:', { idx: idx + 1, reason: 'invalid customIcon (not data:image/*)' });
            return res.status(400).json({ success: false, error: `Item ${idx + 1}: customIcon must be a data:image/* base64 URL` });
          }
          if (item.customIcon.length > MAX_CUSTOM_ICON_CHARS) {
            console.warn('[socialmedia] reject:', { idx: idx + 1, reason: 'customIcon too large', len: item.customIcon.length });
            return res.status(400).json({ success: false, error: `Item ${idx + 1}: customIcon is too large` });
          }
        } else {
          delete item.customIcon;
        }
      }

      socialMediaModule.saveConfig(normalized);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

module.exports = registerSocialMediaRoutes;
