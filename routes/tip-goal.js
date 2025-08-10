const fs = require('fs');
const WebSocket = require('ws');
const { z } = require('zod');

function registerTipGoalRoutes(app, strictLimiter, goalAudioUpload, tipGoal, wss, TIP_GOAL_CONFIG_FILE, GOAL_AUDIO_CONFIG_FILE) {
  app.post('/api/tip-goal', strictLimiter, goalAudioUpload.single('audioFile'), async (req, res) => {
    try {
      const schema = z.object({
        walletAddress: z.string().default(''),
        monthlyGoal: z.coerce.number().positive().optional(),
        goalAmount: z.coerce.number().positive().optional(),
        currentAmount: z.coerce.number().nonnegative().optional(),
        startingAmount: z.coerce.number().nonnegative().optional(),
        currentTips: z.coerce.number().nonnegative().optional(),
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
      const bgColor = data.bgColor;
      const fontColor = data.fontColor;
      const borderColor = data.borderColor;
      const progressColor = data.progressColor;
      const audioSource = data.audioSource || 'remote';
      const widgetTitle = (typeof data.title === 'string' && data.title.trim()) ? data.title.trim() : undefined;

      if (isNaN(monthlyGoal) || monthlyGoal <= 0) {
        return res.status(400).json({ error: 'Valid goal amount is required' });
      }

      tipGoal.updateWalletAddress(walletAddress);
      tipGoal.monthlyGoalAR = monthlyGoal;
      tipGoal.currentTipsAR = currentAmount;

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
      fs.writeFileSync(TIP_GOAL_CONFIG_FILE, JSON.stringify(config, null, 2));

      fs.writeFileSync(
        GOAL_AUDIO_CONFIG_FILE,
        JSON.stringify(
          {
            audioSource,
            hasCustomAudio,
            audioFileName,
            audioFileSize,
            ...(audioFile ? { customAudioUrl: audioFile } : {})
          },
          null,
          2
        )
      );

      tipGoal.sendGoalUpdate();

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: 'goalAudioSettingsUpdate',
              data: {
                audioSource,
                hasCustomAudio,
                audioFileName,
                audioFileSize,
                ...(audioFile ? { customAudioUrl: audioFile } : {})
              }
            })
          );
        }
      });

      res.json({
        success: true,
        active: true,
        ...config
      });
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
