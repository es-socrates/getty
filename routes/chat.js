const fs = require('fs');
const path = require('path');
const { z } = require('zod');

function registerChatRoutes(app, chat, limiter, chatConfigFilePath) {
  const CHAT_CONFIG_FILE = chatConfigFilePath || path.join(process.cwd(), 'config', 'chat-config.json');

  app.get('/api/chat-config', (_req, res) => {
    try {
      let config = {};
      if (fs.existsSync(CHAT_CONFIG_FILE)) {
        config = JSON.parse(fs.readFileSync(CHAT_CONFIG_FILE, 'utf8'));
      }
      config.themeCSS = config.themeCSS || '';
      res.json(config);
    } catch (e) {
      res.status(500).json({ error: 'Error loading chat config', details: e.message });
    }
  });

  app.post('/api/chat', limiter, (req, res) => {
    try {
      const schema = z.object({
        chatUrl: z.string().url(),
        odyseeWsUrl: z.string().url().optional(),
        bgColor: z.string().optional(),
        msgBgColor: z.string().optional(),
        msgBgAltColor: z.string().optional(),
        borderColor: z.string().optional(),
        textColor: z.string().optional(),
        usernameColor: z.string().optional(),
        usernameBgColor: z.string().optional(),
        donationColor: z.string().optional(),
        donationBgColor: z.string().optional(),
        themeCSS: z.string().max(20000).optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid chat config' });
      const { chatUrl, odyseeWsUrl, bgColor, msgBgColor, msgBgAltColor, borderColor, textColor, usernameColor, usernameBgColor, donationColor, donationBgColor } = parsed.data;
      let { themeCSS } = parsed.data;
      if (!chatUrl) {
        return res.status(400).json({ error: 'Chat URL is required' });
      }

      function sanitizeThemeCSS(input) {
        if (typeof input !== 'string') return '';
        let out = input.replace(/\0/g, '');
        out = out.replace(/@import[^;]*;?/gi, '').replace(/@charset[^;]*;?/gi, '');
        out = out.replace(/expression\s*\([^)]*\)/gi, '');
        out = out.replace(/url\(([^)]*?)javascript:[^)]+\)/gi, '');
        out = out.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        return out.trim();
      }
      if (typeof themeCSS === 'string') {
        themeCSS = sanitizeThemeCSS(themeCSS).slice(0, 20000);
      }

      let config = {};
      if (fs.existsSync(CHAT_CONFIG_FILE)) {
        config = JSON.parse(fs.readFileSync(CHAT_CONFIG_FILE, 'utf8'));
      }
      const newConfig = {
        ...config,
        chatUrl,
        odyseeWsUrl: odyseeWsUrl || config.odyseeWsUrl || '',
        bgColor: bgColor || config.bgColor || '#080c10',
        msgBgColor: msgBgColor || config.msgBgColor || '#0a0e12',
        msgBgAltColor: msgBgAltColor || config.msgBgAltColor || '#0d1114',
        borderColor: borderColor || config.borderColor || '#161b22',
        textColor: textColor || config.textColor || '#e6edf3',
        usernameColor: usernameColor || config.usernameColor || '#fff',
        usernameBgColor: usernameBgColor || config.usernameBgColor || '#11ff79',
        donationColor: donationColor || config.donationColor || '#1bdf5f',
        donationBgColor: donationBgColor || config.donationBgColor || '#ececec',
        themeCSS: typeof themeCSS === 'string' ? themeCSS : (config.themeCSS || '')
      };
      fs.writeFileSync(CHAT_CONFIG_FILE, JSON.stringify(newConfig, null, 2));
      const result = chat.updateChatUrl(chatUrl);
      res.json({ success: true, ...result, ...newConfig });
    } catch (error) {
      console.error('Error updating chat:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });
}

module.exports = registerChatRoutes;
