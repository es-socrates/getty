const express = require('express');

module.exports = function registerAchievementsRoutes(app, achievements, limiter, _opts = {}) {
  const router = express.Router();

  async function getNs(req) {
    try {
      let ns = req?.ns?.admin || req?.ns?.pub || null;
      if (!ns && req.query && req.query.ns) ns = String(req.query.ns);
      return ns;
    } catch { return null; }
  }

  router.get('/config', async (req, res) => {
    try {
      const ns = await getNs(req);
      const { config: cfg, meta } = await achievements.getConfigWithMeta(ns);

      try {
        const hosted = (!!process.env.REDIS_URL) || (process.env.GETTY_REQUIRE_SESSION === '1');
        if (hosted) {
          const { canReadSensitive } = require('../lib/authz');
          const allowSensitive = canReadSensitive(req);
          if (!allowSensitive && cfg && typeof cfg === 'object' && 'claimid' in cfg) {
            cfg.claimid = '';
          }
        }
      } catch {}

      res.json({ data: cfg, meta });
    } catch (e) {
      res.status(500).json({ error: 'failed_to_read_config', details: e?.message });
    }
  });

  router.post('/config', limiter, express.json(), async (req, res) => {
    try {
      const ns = await getNs(req);
      const cfgIn = req.body || {};
      const save = await achievements.saveConfig(ns, cfgIn);
      const { config: cfg, meta } = await achievements.getConfigWithMeta(ns);

      try {
        const hosted = (!!process.env.REDIS_URL) || (process.env.GETTY_REQUIRE_SESSION === '1');
        if (hosted) {
          const { canReadSensitive } = require('../lib/authz');
          const allowSensitive = canReadSensitive(req);
          if (!allowSensitive && cfg && typeof cfg === 'object' && 'claimid' in cfg) {
            cfg.claimid = '';
          }
        }
      } catch {}

      res.json({ ok: !!save.ok, data: cfg, meta: meta || save.meta || null });
    } catch (e) {
      res.status(500).json({ error: 'failed_to_save_config', details: e?.message });
    }
  });

  router.get('/status', async (req, res) => {
    try {
      const ns = await getNs(req);
      const status = await achievements.getStatus(ns);
      res.json(status);
    } catch (e) {
      res.status(500).json({ error: 'failed_to_get_status', details: e?.message });
    }
  });

  router.post('/reset/:id', limiter, async (req, res) => {
    try {
      const ns = await getNs(req);
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const shouldRequireSession = requireSessionFlag || !!process.env.REDIS_URL;
      if (shouldRequireSession && !ns) return res.status(401).json({ error: 'session_required' });
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'missing_id' });

  if (/^v_/i.test(String(id))) return res.status(400).json({ error: 'reset_not_allowed_for_viewers' });
  if (String(id) === 't_first') return res.status(400).json({ error: 'reset_not_allowed_for_t_first' });
      achievements.resetAchievement(ns, id);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'failed_to_reset', details: e?.message });
    }
  });

  router.post('/poll-viewers', limiter, async (req, res) => {
    try {
      const ns = await getNs(req);
      await achievements.pollViewersOnce(ns);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'failed_to_poll', details: e?.message });
    }
  });

  router.post('/test-notification', limiter, async (req, res) => {
    try {
      const ns = await getNs(req);
      const defs = achievements.getDefinitions();
      const pick = defs[Math.floor(Math.random() * defs.length)];
      const now = Date.now();

      const data = {
        id: pick.id,
        titleKey: pick.titleKey,
        descKey: pick.descKey,
        title: achievements._t('en', pick.titleKey, pick.title || ''),
        desc: achievements._t('en', pick.descKey, pick.desc || ''),
        category: pick.category,
        ts: now,
        test: true
      };
      const payload = { type: 'achievement', data };

      achievements._broadcast(ns, payload);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'failed_to_test_notification', details: e?.message });
    }
  });

  router.get('/test-notification', limiter, async (req, res) => {
    try {
      const ns = await getNs(req);
      const defs = achievements.getDefinitions();
      const pick = defs[Math.floor(Math.random() * defs.length)];
      const now = Date.now();

      const data = {
        id: pick.id,
        titleKey: pick.titleKey,
        descKey: pick.descKey,
        title: achievements._t('en', pick.titleKey, pick.title || ''),
        desc: achievements._t('en', pick.descKey, pick.desc || ''),
        category: pick.category,
        ts: now,
        test: true
      };
      const payload = { type: 'achievement', data };

      achievements._broadcast(ns, payload);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'failed_to_test_notification', details: e?.message });
    }
  });

  app.use('/api/achievements', router);
};
