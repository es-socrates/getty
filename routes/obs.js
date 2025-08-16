const fs = require('fs');

function registerObsRoutes(app, strictLimiter, obsWsConfig, OBS_WS_CONFIG_FILE, connectOBS) {
  app.get('/api/obs-ws-config', (_req, res) => {
    res.json(obsWsConfig);
  });

  app.post('/api/obs-ws-config', strictLimiter, async (req, res) => {
    try {
      const body = req.body || {};

      Object.assign(obsWsConfig, body);
      fs.writeFileSync(OBS_WS_CONFIG_FILE, JSON.stringify(obsWsConfig, null, 2));
      await connectOBS();
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false, error: 'Could not save OBS WebSocket config.' });
    }
  });
}

module.exports = registerObsRoutes;
