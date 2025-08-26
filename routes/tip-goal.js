const fs = require('fs');
const WebSocket = require('ws');
const { z } = require('zod');

function registerTipGoalRoutes(app, strictLimiter, goalAudioUpload, tipGoal, wss, TIP_GOAL_CONFIG_FILE, GOAL_AUDIO_CONFIG_FILE, options = {}) {
  const store = (options && options.store) || null;

  function readConfig() {
    try {
      if (fs.existsSync(TIP_GOAL_CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(TIP_GOAL_CONFIG_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('Error reading tip goal config:', e);
    }
    return null;
  }

  app.get('/api/tip-goal', async (req, res) => {
    try {
      let cfg = null;
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (store && ns) {
        cfg = await store.get(ns, 'tip-goal-config', null);
      }
      if (!cfg) cfg = readConfig();
      if (!cfg) return res.status(404).json({ error: 'No tip goal configured' });
      res.json({ success: true, ...cfg });
    } catch (e) {
      res.status(500).json({ error: 'Error loading tip goal config', details: e.message });
    }
  });
  app.post('/api/tip-goal', strictLimiter, goalAudioUpload.single('audioFile'), async (req, res) => {
    try {
      const schema = z.object({
        walletAddress: z.string().default(''),
        monthlyGoal: z.coerce.number().positive().optional(),
        goalAmount: z.coerce.number().positive().optional(),
        currentAmount: z.coerce.number().nonnegative().optional(),
        startingAmount: z.coerce.number().nonnegative().optional(),
        currentTips: z.coerce.number().nonnegative().optional(),
        theme: z.enum(['classic','modern-list']).default('classic').optional(),
        bgColor: z.string().optional(),
        fontColor: z.string().optional(),
        borderColor: z.string().optional(),
        progressColor: z.string().optional(),
        audioSource: z.enum(['remote', 'custom']).default('remote'),
        title: z.string().max(120).optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
      const data = parsed.data;
      const walletAddress = data.walletAddress || '';
      const monthlyGoal = typeof data.monthlyGoal === 'number' ? data.monthlyGoal : data.goalAmount;
      const currentAmount = data.currentAmount ?? data.startingAmount ?? data.currentTips ?? 0;
      const theme = data.theme || 'classic';
      const bgColor = data.bgColor;
      const fontColor = data.fontColor;
      const borderColor = data.borderColor;
      const progressColor = data.progressColor;
      const audioSource = data.audioSource || 'remote';
      const widgetTitle = (typeof data.title === 'string' && data.title.trim()) ? data.title.trim() : undefined;

      if (isNaN(monthlyGoal) || monthlyGoal <= 0) {
        return res.status(400).json({ error: 'Valid goal amount is required' });
      }

      const ns = req?.ns?.admin || req?.ns?.pub || null;
  if (!(store && ns)) {
        tipGoal.updateWalletAddress(walletAddress);
        tipGoal.monthlyGoalAR = monthlyGoal;
        tipGoal.currentTipsAR = currentAmount;
        tipGoal.theme = theme;
      }

      let audioFile = null;
      let hasCustomAudio = false;
      let audioFileName = null;
      let audioFileSize = 0;

      if (audioSource === 'custom' && req.file) {
        audioFile = '/uploads/goal-audio/' + req.file.filename;
        hasCustomAudio = true;
        audioFileName = req.file.originalname;
        audioFileSize = req.file.size;
      }

  const config = {
        walletAddress,
        monthlyGoal,
        currentAmount,
        theme,
        bgColor: bgColor || '#080c10',
        fontColor: fontColor || '#ffffff',
        borderColor: borderColor || '#00ff7f',
        progressColor: progressColor || '#00ff7f',
        audioSource,
        hasCustomAudio,
        audioFileName,
        audioFileSize,
        ...(widgetTitle ? { title: widgetTitle } : {}),
        ...(audioFile ? { customAudioUrl: audioFile } : {})
      };
      if (store && ns) {
        await store.set(ns, 'tip-goal-config', config);
      } else {
        fs.writeFileSync(TIP_GOAL_CONFIG_FILE, JSON.stringify(config, null, 2));
      }

      try {
        if (!(store && ns) && typeof tipGoal === 'object' && tipGoal) {
          if (bgColor) tipGoal.bgColor = bgColor;
          if (fontColor) tipGoal.fontColor = fontColor;
          if (borderColor) tipGoal.borderColor = borderColor;
          if (progressColor) tipGoal.progressColor = progressColor;
          if (widgetTitle) tipGoal.title = widgetTitle;
          if (theme) tipGoal.theme = theme;
        }
      } catch {}

      try {
        const audioCfg = {
          audioSource,
          hasCustomAudio,
          audioFileName,
          audioFileSize,
          ...(audioFile ? { customAudioUrl: audioFile } : {})
        };
        if (store && ns) {
          await store.set(ns, 'goal-audio-settings', audioCfg);
        } else {
          fs.writeFileSync(GOAL_AUDIO_CONFIG_FILE, JSON.stringify(audioCfg, null, 2));
        }
      } catch {}

      if (store && ns) {
        try { if (typeof wss?.broadcast === 'function') wss.broadcast(ns, { type: 'tipGoalUpdate', data: { ...config } }); } catch {}
      } else {
        tipGoal.sendGoalUpdate();
      }

      try {
        if (store && ns && typeof wss?.broadcast === 'function') {
          wss.broadcast(ns, {
            type: 'goalAudioSettingsUpdate',
            data: { audioSource, hasCustomAudio, audioFileName, audioFileSize, ...(audioFile ? { customAudioUrl: audioFile } : {}) }
          });
        } else {
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'goalAudioSettingsUpdate', data: { audioSource, hasCustomAudio, audioFileName, audioFileSize, ...(audioFile ? { customAudioUrl: audioFile } : {}) } }));
            }
          });
        }
      } catch {}

  res.json({ success: true, active: true, ...config });
    } catch (error) {
      console.error('Error in /api/tip-goal:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  });
}

module.exports = registerTipGoalRoutes;
