const fs = require('fs');
const path = require('path');

function registerUserRoutes(app, _options = {}) {
  const { store } = _options;
  const USER_CONFIG_DIR = path.join(process.cwd(), 'config', 'user-configs');

  try {
    if (!fs.existsSync(USER_CONFIG_DIR)) {
      fs.mkdirSync(USER_CONFIG_DIR, { recursive: true });
    }
  } catch (e) {
    console.warn('[user-routes] Failed to create user config directory', e);
  }

  app.get('/api/user/config', async (req, res) => {
    try {
      const queryWidgetToken = typeof req.query?.widgetToken === 'string' && req.query.widgetToken.trim()
        ? req.query.widgetToken.trim()
        : null;
      if (queryWidgetToken && store) {
        try {
          const walletHash = await store.get(queryWidgetToken, 'walletHash');
          if (walletHash) {
            req.session = req.session || {};
            req.session.userToken = walletHash;
          }
        } catch (e) {
          console.warn('Failed to resolve widgetToken:', e.message);
        }
      }

      const userId = req.session?.userToken || req.query?.address;

      if (!userId) {
        return res.status(401).json({ error: 'No user session found' });
      }

      const configFile = path.join(USER_CONFIG_DIR, `${userId}.json`);
      let userConfig = {};

      try {
        if (fs.existsSync(configFile)) {
          const configData = fs.readFileSync(configFile, 'utf8');
          userConfig = JSON.parse(configData);
        }
      } catch (e) {
        console.warn('[user-routes] Failed to load user config', userId, e);
      }

      const defaultConfig = {
        lastTip: {
          title: 'Last Tip'
        },
        goal: {
          title: 'Monthly Goal'
        },
        colors: {
          primary: '#3b82f6',
          secondary: '#1f2937'
        }
      };

      const mergedConfig = { ...defaultConfig, ...userConfig };

      res.json(mergedConfig);
    } catch (e) {
      console.error('[user-routes] Error getting user config', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/user/config', async (req, res) => {
    try {
      const queryWidgetToken = typeof req.query?.widgetToken === 'string' && req.query.widgetToken.trim()
        ? req.query.widgetToken.trim()
        : null;
      if (queryWidgetToken && store) {
        try {
          const walletHash = await store.get(queryWidgetToken, 'walletHash');
          if (walletHash) {
            req.session = req.session || {};
            req.session.userToken = walletHash;
          }
        } catch (e) {
          console.warn('Failed to resolve widgetToken:', e.message);
        }
      }

      const userId = req.session?.userToken || req.body?.address;

      if (!userId) {
        return res.status(401).json({ error: 'No user session found' });
      }

      const allowedKeys = ['lastTip', 'goal', 'colors'];
      const config = {};

      for (const key of allowedKeys) {
        if (req.body[key] !== undefined) {
          config[key] = req.body[key];
        }
      }

      const configFile = path.join(USER_CONFIG_DIR, `${userId}.json`);

      try {
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
        res.json({ success: true, message: 'Configuration saved' });
      } catch (e) {
        console.error('[user-routes] Failed to save user config', e);
        res.status(500).json({ error: 'Failed to save configuration' });
      }
    } catch (e) {
      console.error('[user-routes] Error saving user config', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

module.exports = { registerUserRoutes };