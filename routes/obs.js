const fs = require('fs');

function registerObsRoutes(app, strictLimiter, obsWsConfig, OBS_WS_CONFIG_FILE, connectOBS) {
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const hostedWithRedis = !!process.env.REDIS_URL;
  const shouldRequireSession = requireSessionFlag || hostedWithRedis;
  app.get('/api/obs-ws-config', (req, res) => {
    const ns = req?.ns?.admin || req?.ns?.pub || null;
    const hasNs = !!ns;
    const cfg = { ...obsWsConfig };
    if (!hasNs) {
      delete cfg.password;
    }
    res.json(cfg);
  });

  app.post('/api/obs-ws-config', strictLimiter, async (req, res) => {
    try {
      if (shouldRequireSession) {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
      }
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
