const fs = require('fs');
const path = require('path');
const { z } = require('zod');

function registerLastTipRoutes(app, lastTip, tipWidget) {
  const LAST_TIP_CONFIG_FILE = path.join(process.cwd(), 'last-tip-config.json');

  app.post('/api/last-tip', (req, res) => {
    try {
      const schema = z.object({
        walletAddress: z.string().optional(),
        bgColor: z.string().optional(),
        fontColor: z.string().optional(),
        borderColor: z.string().optional(),
        amountColor: z.string().optional(),
        iconColor: z.string().optional(),
        iconBgColor: z.string().optional(),
        fromColor: z.string().optional(),
        title: z.string().max(120).optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
      const { walletAddress, bgColor, fontColor, borderColor, amountColor, iconColor, iconBgColor, fromColor, title } = parsed.data;
      let config = {};
      if (fs.existsSync(LAST_TIP_CONFIG_FILE)) {
        config = JSON.parse(fs.readFileSync(LAST_TIP_CONFIG_FILE, 'utf8'));
      }
      const newConfig = {
        ...config,
        bgColor: bgColor || config.bgColor || '#080c10',
        fontColor: fontColor || config.fontColor || '#ffffff',
        borderColor: borderColor || config.borderColor || '#00ff7f',
        amountColor: amountColor || config.amountColor || '#00ff7f',
        iconColor: iconColor || config.iconColor || '#ffffff',
        iconBgColor: iconBgColor || config.iconBgColor || '#4f36ff',
        fromColor: fromColor || config.fromColor || '#e9e9e9',
        walletAddress: walletAddress || config.walletAddress || '',
        title: (typeof title === 'string' && title.trim()) ? title.trim() : (config.title || 'Last tip received 👏')
      };
      fs.writeFileSync(LAST_TIP_CONFIG_FILE, JSON.stringify(newConfig, null, 2));
      const result = lastTip.updateWalletAddress(newConfig.walletAddress);

      if (typeof tipWidget.updateWalletAddress === 'function') {
        tipWidget.updateWalletAddress(newConfig.walletAddress);
      }
      res.json({
        success: true,
        ...result,
        ...newConfig
      });
    } catch (error) {
      console.error('Error updating last tip:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  });

  app.get('/last-donation', (_req, res) => {
    const lastDonation = lastTip.getLastDonation();
    if (lastDonation) {
      res.json(lastDonation);
    } else {
      res.status(404).json({ error: 'No donation found' });
    }
  });
}

module.exports = registerLastTipRoutes;
