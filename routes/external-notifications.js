const { z } = require('zod');

function registerExternalNotificationsRoutes(app, externalNotifications, limiter) {
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

      await externalNotifications.saveConfig({
        discordWebhook,
        telegramBotToken,
        telegramChatId,
        template: template || '🎉 New tip from {from}: {amount} AR (${usd}) - "{message}"'
      });

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

  app.get('/api/external-notifications', (_req, res) => {
    const status = externalNotifications.getStatus();
    res.json({
      active: !!status.active,
      lastTips: status.lastTips,
      config: {
        hasDiscord: !!status.config?.hasDiscord,
        hasTelegram: !!status.config?.hasTelegram,
        template: status.config?.template || '',
        // expose current configured values so the Admin UI can preload them
        discordWebhook: externalNotifications.discordWebhook || '',
        telegramBotToken: externalNotifications.telegramBotToken || '',
        telegramChatId: externalNotifications.telegramChatId || ''
      },
      lastUpdated: status.lastUpdated
    });
  });
}

module.exports = registerExternalNotificationsRoutes;
