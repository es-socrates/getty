const multer = require('multer');
const WebSocket = require('ws');
const { z } = require('zod');

function registerRaffleRoutes(app, raffle, wss) {
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const hostedWithRedis = !!process.env.REDIS_URL;
  const shouldRequireSession = requireSessionFlag || hostedWithRedis;
  const raffleImageUpload = multer({ dest: './public/uploads/raffle/' });

  app.get('/api/raffle/settings', (req, res) => {
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      const hasNs = !!ns;
      const settings = raffle.getSettings();
      if (!hasNs) {
        const rest = { ...settings };
        delete rest.participants;
        delete rest.previousWinners;
        return res.json(rest);
      }
      res.json(settings);
    } catch (error) {
      console.error('Error in GET /api/raffle/settings:', error);
      res.status(500).json({ error: 'Error getting raffle settings', details: error.message });
    }
  });

  app.get('/api/raffle/state', (_req, res) => {
    try {
      const state = raffle.getPublicState();
      res.json(state);
    } catch (error) {
      console.error('Error in GET /api/raffle/state:', error);
      res.status(500).json({ error: 'Error getting raffle state', details: error.message });
    }
  });

  app.post('/api/raffle/settings', (req, res) => {
    try {
      if (shouldRequireSession) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
      const schema = z.object({
        command: z.string().trim().default('!giveaway'),
        prize: z.string().trim().min(1).max(15),
        duration: z.coerce.number().int().positive().default(5),
        maxWinners: z.coerce.number().int().positive().default(1),
        enabled: z
          .union([z.boolean(), z.string(), z.number()])
          .transform(v => v === true || v === 'true' || v === 1 || v === '1')
          .optional(),
        mode: z.enum(['manual', 'auto']).default('manual').optional(),
        interval: z.coerce.number().int().positive().default(5),
        imageUrl: z.string().optional().refine(v => {
          if (v === undefined || v === '') return true;
          if (typeof v !== 'string') return false;
          if (/^https?:\/\/.+/i.test(v)) return true;
          if (v.startsWith('/uploads/raffle/')) return true;
          return false;
        }, { message: 'Invalid URL' })
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        const first = parsed.error?.issues?.[0];
        const msg = first?.path?.length
          ? `${first.path.join('.')}: ${first.message}`
          : (first?.message || 'Invalid payload');
        return res.status(400).json({ success: false, error: msg });
      }
      const settings = parsed.data;
      raffle.saveSettings(settings);
      res.json({ success: true });
    } catch (error) {
      console.error('Error in POST /api/raffle/settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/start', (_req, res) => {
    try {
      raffle.start();
      broadcastRaffleState(wss, raffle);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/stop', (_req, res) => {
    try {
      raffle.stop();
      broadcastRaffleState(wss, raffle);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/pause', (_req, res) => {
    try {
      raffle.pause();
      broadcastRaffleState(wss, raffle);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/resume', (_req, res) => {
    try {
      raffle.resume();
      broadcastRaffleState(wss, raffle);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/draw', (_req, res) => {
    try {
      const winner = raffle.drawWinner();
      broadcastRaffleWinner(wss, winner);
      broadcastRaffleState(wss, raffle);
      res.json({ success: true, winner });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/reset', (_req, res) => {
    try {
      raffle.resetWinners();
      broadcastRaffleState(wss, raffle);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/upload-image', raffleImageUpload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const imageUrl = `/uploads/raffle/${req.file.filename}`;

    raffle.imageUrl = imageUrl;
    raffle.saveSettingsToFile();
    res.json({ imageUrl });
  });

  function broadcastRaffleState(wss, raffle) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'raffle_state', ...raffle.getPublicState() }));
      }
    });
  }
  function broadcastRaffleWinner(wss, winner) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'raffle_winner', winner }));
      }
    });
  }
}

module.exports = registerRaffleRoutes;
