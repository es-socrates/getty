const { z } = require('zod');

function registerExternalNotificationsRoutes(app, externalNotifications, limiter, options = {}) {
  const store = options.store || null;

  app.post('/api/external-notifications', limiter, async (req, res) => {
    try {
      const schema = z.object({
        discordWebhook: z.string().url().optional(),
        telegramBotToken: z.string().optional(),
        telegramChatId: z.string().optional(),
        template: z.string().optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid payload' });
      const { discordWebhook, telegramBotToken, telegramChatId, template } = parsed.data;

      if (!discordWebhook && !(telegramBotToken && telegramChatId)) {
        return res.status(400).json({
          error: 'Either Discord webhook or Telegram credentials are required',
          success: false
        });
      }

      const payload = {
        discordWebhook,
        telegramBotToken,
        telegramChatId,
        template: template || '🎉 New tip from {from}: {amount} AR (${usd}) - "{message}"'
      };

      const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (store && ns) {
        await store.set(ns, 'external-notifications-config', payload);
      } else {
        await externalNotifications.saveConfig(payload);
      }

      res.json({
        success: true,
        status: externalNotifications.getStatus(),
        message: 'Settings saved successfully'
      });
    } catch (error) {
      console.error('Error saving external notifications config:', error);
      res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
    }
  });

  app.get('/api/external-notifications', async (req, res) => {
    const ns = req?.ns?.admin || req?.ns?.pub || null;
    if (store && ns) {
      try {
        const cfg = (await store.get(ns, 'external-notifications-config', null)) || {};
        return res.json({
          active: !!(cfg.discordWebhook || (cfg.telegramBotToken && cfg.telegramChatId)),
          lastTips: [],
          config: {
            hasDiscord: !!cfg.discordWebhook,
            hasTelegram: !!(cfg.telegramBotToken && cfg.telegramChatId),
            template: cfg.template || '',
            discordWebhook: '',
            telegramBotToken: '',
            telegramChatId: ''
          },
          lastUpdated: new Date().toISOString()
        });
      } catch {}
    }

    const status = externalNotifications.getStatus();
    res.json({
      active: !!status.active,
      lastTips: status.lastTips,
      config: {
        hasDiscord: !!status.config?.hasDiscord,
        hasTelegram: !!status.config?.hasTelegram,
        template: status.config?.template || '',
        discordWebhook: externalNotifications.discordWebhook || '',
        telegramBotToken: externalNotifications.telegramBotToken || '',
        telegramChatId: externalNotifications.telegramChatId || ''
      },
      lastUpdated: status.lastUpdated
    });
  });
}

module.exports = registerExternalNotificationsRoutes;
