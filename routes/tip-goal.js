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
      const out = { ...cfg };
      try {
        const hosted = !!store;
        const hasNs = !!ns;
        const remote = (req.socket && req.socket.remoteAddress) || (req.connection && req.connection.remoteAddress) || req.ip || '';
        const isLocalIp = /^::1$|^127\.0\.0\.1$|^::ffff:127\.0\.0\.1$/i.test(remote);
        const hostHeader = req.headers.host || '';
        const hostNameOnly = hostHeader.replace(/^\[/, '').replace(/\]$/, '').split(':')[0];
        const isLocalHostHeader = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)$/i.test(hostNameOnly);
        const isLocal = isLocalIp || isLocalHostHeader;
        const hideForRemoteLocalMode = (!hosted && !isLocal);
        const hideInHosted = (hosted && !hasNs && !isLocal);
        if ((hideInHosted || hideForRemoteLocalMode) && out && typeof out === 'object' && out.walletAddress) {
          delete out.walletAddress;
        }
      } catch {}
      res.json({ success: true, ...out });
    } catch (e) {
      res.status(500).json({ error: 'Error loading tip goal config', details: e.message });
    }
  });
  app.post('/api/tip-goal', strictLimiter, goalAudioUpload.single('audioFile'), async (req, res) => {
    try {

  if (store && store.redis && !(req?.ns?.admin || req?.ns?.pub)) {
        return res.status(401).json({ error: 'no_session' });
      }
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
      const ns = req?.ns?.admin || req?.ns?.pub || null;

      let prevCfg = null;
      if (store && ns) {
        try { prevCfg = await store.get(ns, 'tip-goal-config', null); } catch {}
      } else {
        prevCfg = readConfig();
      }
      prevCfg = (prevCfg && typeof prevCfg === 'object') ? prevCfg : {};

      const walletProvided = Object.prototype.hasOwnProperty.call(req.body, 'walletAddress') && typeof data.walletAddress === 'string';
      let walletAddress = (prevCfg && typeof prevCfg.walletAddress === 'string') ? prevCfg.walletAddress : '';
      if (walletProvided) {
        walletAddress = (data.walletAddress || '').trim();
      }

      const monthlyGoalProvided = Object.prototype.hasOwnProperty.call(req.body, 'monthlyGoal') || Object.prototype.hasOwnProperty.call(req.body, 'goalAmount');
      if (!monthlyGoalProvided) {
        return res.status(400).json({ error: 'Valid goal amount is required' });
      }
      const monthlyGoal = (typeof data.monthlyGoal === 'number' ? data.monthlyGoal : data.goalAmount);

      const currentAmountProvided = ['currentAmount','startingAmount','currentTips'].some(k => Object.prototype.hasOwnProperty.call(req.body, k));
      const currentAmount = currentAmountProvided ? (data.currentAmount ?? data.startingAmount ?? data.currentTips ?? 0)
        : (typeof prevCfg.currentAmount === 'number' ? prevCfg.currentAmount : (prevCfg.currentTips || 0));

      const theme = Object.prototype.hasOwnProperty.call(req.body, 'theme') ? (data.theme || 'classic') : (prevCfg.theme || 'classic');
      const bgColor = Object.prototype.hasOwnProperty.call(req.body, 'bgColor') ? data.bgColor : (prevCfg.bgColor);
      const fontColor = Object.prototype.hasOwnProperty.call(req.body, 'fontColor') ? data.fontColor : (prevCfg.fontColor);
      const borderColor = Object.prototype.hasOwnProperty.call(req.body, 'borderColor') ? data.borderColor : (prevCfg.borderColor);
      const progressColor = Object.prototype.hasOwnProperty.call(req.body, 'progressColor') ? data.progressColor : (prevCfg.progressColor);
      const audioSource = Object.prototype.hasOwnProperty.call(req.body, 'audioSource') ? (data.audioSource || 'remote') : (prevCfg.audioSource || 'remote');
      const widgetTitle = (typeof data.title === 'string' && data.title.trim()) ? data.title.trim() : (prevCfg.title || undefined);

      if (isNaN(monthlyGoal) || monthlyGoal <= 0) {
        return res.status(400).json({ error: 'Valid goal amount is required' });
      }

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
        // Always include walletAddress to allow explicit clearing when empty
        walletAddress,
        monthlyGoal,
        currentAmount,
        theme,
        bgColor: bgColor || prevCfg.bgColor || '#080c10',
        fontColor: fontColor || prevCfg.fontColor || '#ffffff',
        borderColor: borderColor || prevCfg.borderColor || '#00ff7f',
        progressColor: progressColor || prevCfg.progressColor || '#00ff7f',
        audioSource,
        hasCustomAudio,
        audioFileName,
        audioFileSize,
        ...(widgetTitle ? { title: widgetTitle } : (prevCfg.title ? { title: prevCfg.title } : {})),
        ...(audioFile ? { customAudioUrl: audioFile } : (prevCfg.customAudioUrl ? { customAudioUrl: prevCfg.customAudioUrl } : {}))
      };
      if (store && ns) {
        await store.set(ns, 'tip-goal-config', config);

        if (walletProvided) {
          try {
            const prevLast = await store.get(ns, 'last-tip-config', null);
            const newLast = { ...(prevLast && typeof prevLast === 'object' ? prevLast : {}), walletAddress };
            await store.set(ns, 'last-tip-config', newLast);
          } catch {}
        }
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
