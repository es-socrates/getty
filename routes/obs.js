const fs = require('fs');

const STORE_KEY = 'obs-ws-config.json';

function sanitizeConfig(raw) {
  const out = {};
  try {
    if (raw && typeof raw === 'object') {
      if (typeof raw.ip === 'string') out.ip = raw.ip;
      if (typeof raw.port === 'string' || typeof raw.port === 'number') out.port = String(raw.port);
      if (typeof raw.password === 'string') out.password = raw.password;
    }
  } catch {}
  return { ip: out.ip || '', port: out.port || '', password: out.password || '' };
}

function registerObsRoutes(app, strictLimiter, obsWsConfig, OBS_WS_CONFIG_FILE, connectOBS, store) {
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const hostedWithRedis = !!process.env.REDIS_URL;
  const shouldRequireSession = requireSessionFlag || hostedWithRedis;
  const multiTenant = process.env.GETTY_MULTI_TENANT_WALLET === '1';

  app.get('/api/obs-ws-config', async (req, res) => {
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (multiTenant) {
        if (ns && store) {
          try {
            const stored = await store.getConfig(ns, STORE_KEY, null);
            if (stored) return res.json(sanitizeConfig(stored));
          } catch {}
        }

        return res.json({ ip: '', port: '', password: '' });
      }

      const cfg = { ...sanitizeConfig(obsWsConfig) };

      if (!ns) delete cfg.password;
      return res.json(cfg);
    } catch {
      return res.status(500).json({ error: 'obs_config_read_failed' });
    }
  });

  app.post('/api/obs-ws-config', strictLimiter, async (req, res) => {
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (shouldRequireSession && !ns) {
        return res.status(401).json({ success: false, error: 'session_required' });
      }
      const body = req.body || {};
      const ip = typeof body.ip === 'string' && body.ip.length <= 100 ? body.ip : '';
      const port =
        typeof body.port === 'string' && /^\d{1,5}$/.test(body.port)
          ? body.port
          : typeof body.port === 'number'
            ? String(body.port)
            : '';
      const password =
        typeof body.password === 'string' && body.password.length <= 256 ? body.password : '';
      const newCfg = { ip, port, password };

      if (multiTenant) {
        if (!ns) return res.status(401).json({ success: false, error: 'session_required' });
        if (store) {
          try {
            await store.setConfig(ns, STORE_KEY, newCfg);
          } catch {}
        }

        return res.json({ success: true });
      }

      Object.assign(obsWsConfig, newCfg);
      try {
        fs.writeFileSync(OBS_WS_CONFIG_FILE, JSON.stringify(obsWsConfig, null, 2));
      } catch {}
      try {
        await connectOBS();
      } catch {}
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ success: false, error: 'obs_config_write_failed' });
    }
  });
}

module.exports = registerObsRoutes;
