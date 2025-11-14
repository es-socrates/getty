const {
  getStorage,
  STORAGE_PROVIDERS,
  isSupabaseConfigured,
  isTurboConfigured,
} = require('../lib/storage');

function registerStorageRoutes(app) {
  app.get('/api/storage/providers', (_req, res) => {
    try {
      const supabaseAvailable = isSupabaseConfigured();
      const turboAvailable = isTurboConfigured();
      let activeProvider = null;
      try {
        const instance = getStorage();
        if (instance && typeof instance.provider === 'string') {
          activeProvider = instance.provider;
        }
      } catch (err) {
        try {
          console.warn('[storage] failed to resolve active provider:', err?.message || err);
        } catch {}
      }

      const rawPreferred =
        typeof process.env.STORAGE_PROVIDER === 'string'
          ? process.env.STORAGE_PROVIDER.trim().toLowerCase()
          : '';
      const envPreferred = rawPreferred === 'arweave' ? STORAGE_PROVIDERS.TURBO : rawPreferred;

      const providers = [
        {
          id: STORAGE_PROVIDERS.TURBO,
          label: 'Arweave',
          available: turboAvailable,
        },
        {
          id: STORAGE_PROVIDERS.SUPABASE,
          label: 'Supabase',
          available: supabaseAvailable,
        },
      ];

      res.json({
        providers,
        activeProvider,
        preferredProvider: envPreferred || null,
      });
    } catch (error) {
      try {
        console.error('[storage] provider status error:', error?.message || error);
      } catch {}
      res.status(500).json({ error: 'storage_status_failed' });
    }
  });
}

module.exports = registerStorageRoutes;
