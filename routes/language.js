const { z } = require('zod');

function registerLanguageRoutes(app, languageConfig) {
  app.get('/api/language', (_req, res) => {
    try {
      const currentLanguage = languageConfig.getLanguage();
      const availableLanguages = languageConfig.getAvailableLanguages();
      return res.json({ currentLanguage, availableLanguages });
    } catch (error) {
      return res.status(500).json({ error: 'internal_error', details: error.message });
    }
  });

  app.post('/api/language', async (req, res) => {
    try {
      const available = languageConfig.getAvailableLanguages();
      const schema = z.object({ language: z.enum(available) });

      const hosted = !!process.env.REDIS_URL;
      const requireSession = process.env.GETTY_REQUIRE_SESSION === '1' || hosted;
      if (requireSession) {
        try {
          const ns = req?.ns?.admin || req?.ns?.pub || null;
          if (!ns) return res.status(401).json({ error: 'session_required' });
        } catch {
          return res.status(401).json({ error: 'session_required' });
        }
      }

      try {
        const hdrName = (process.env.VITE_GETTY_CSRF_HEADER || process.env.GETTY_CSRF_HEADER || 'x-csrf-token').toLowerCase();
        const token = (req.headers && req.headers[hdrName]) || '';
        if (!token || typeof token !== 'string' || token.trim() === '') {
          return res.status(403).json({ error: 'missing_csrf' });
        }

      } catch {
        return res.status(403).json({ error: 'missing_csrf' });
      }

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'invalid_language' });
      }
      const { language } = parsed.data;
      const success = languageConfig.setLanguage(language);
      if (!success) {
        return res.status(500).json({ error: 'save_failed' });
      }
      return res.json({ success: true, language });
    } catch (error) {
      return res.status(500).json({ error: 'internal_error', details: error.message });
    }
  });
}

module.exports = registerLanguageRoutes;
