const { z } = require('zod');

function registerLanguageRoutes(app, languageConfig) {
  app.get('/api/language', (_req, res) => {
    try {
      const currentLanguage = languageConfig.getLanguage();
      const availableLanguages = languageConfig.getAvailableLanguages();
      res.json({ currentLanguage, availableLanguages });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/language', (req, res) => {
    try {
      const schema = z.object({ language: z.enum(languageConfig.getAvailableLanguages()) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid language' });
      }
      const { language } = parsed.data;
      const success = languageConfig.setLanguage(language);
      if (success) {
        res.json({ success: true, language });
      } else {
        res.status(500).json({ error: 'Failed to save language setting' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = registerLanguageRoutes;
