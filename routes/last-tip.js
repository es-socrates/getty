const fs = require('fs');
const path = require('path');
const { z } = require('zod');

function registerLastTipRoutes(app, lastTip, tipWidget, options = {}) {
  const store = options.store || null;
  const wss = options.wss || null;
  const LAST_TIP_CONFIG_FILE = path.join(process.cwd(), 'config', 'last-tip-config.json');

  app.get('/api/last-tip', async (req, res) => {
    try {
      let cfg = null;
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (store && ns) {
        cfg = await store.get(ns, 'last-tip-config', null);
      }
      if (!cfg) {
        if (!fs.existsSync(LAST_TIP_CONFIG_FILE)) {
          return res.status(404).json({ error: 'No last tip config' });
        }
        cfg = JSON.parse(fs.readFileSync(LAST_TIP_CONFIG_FILE, 'utf8'));
      }

      const out = { ...cfg };
      try {
        const hosted = !!store;
        const hasNs = !!ns;
        const hideInHosted = hosted && !hasNs;
        const remote = (req.socket && req.socket.remoteAddress) || (req.connection && req.connection.remoteAddress) || req.ip || '';
        const isLocalIp = /^::1$|^127\.0\.0\.1$|^::ffff:127\.0\.0\.1$/i.test(remote);
        const hostHeader = req.headers.host || '';
        const hostNameOnly = hostHeader.replace(/^\[/, '').replace(/\]$/, '').split(':')[0];
        const isLocalHostHeader = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)$/i.test(hostNameOnly);
        const isLocal = isLocalIp || isLocalHostHeader;
        const hideForRemoteLocalMode = (!hosted && !isLocal);
        if ((hideInHosted || hideForRemoteLocalMode) && out && typeof out === 'object' && out.walletAddress) {
          delete out.walletAddress;
        }
      } catch {}
      res.json({ success: true, ...out });
    } catch (e) {
      res.status(500).json({ error: 'Error loading last tip config', details: e.message });
    }
  });

  app.post('/api/last-tip', async (req, res) => {
    try {

  const requireSession = (store && store.redis) || process.env.GETTY_REQUIRE_SESSION === '1';
  if (requireSession && !(req?.ns?.admin || req?.ns?.pub)) {
        return res.status(401).json({ error: 'no_session' });
      }
      const schema = z.object({
        walletAddress: z.string().optional(),
        bgColor: z.string().optional(),
        fontColor: z.string().optional(),
        borderColor: z.string().optional(),
        amountColor: z.string().optional(),
        iconColor: z.string().optional(),
        iconBgColor: z.string().optional(),
        fromColor: z.string().optional(),
        title: z.string().max(120).optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
      const { walletAddress, bgColor, fontColor, borderColor, amountColor, iconColor, iconBgColor, fromColor, title } = parsed.data;
      let config = {};
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (store && ns) {
        const st = await store.get(ns, 'last-tip-config', null);
        if (st && typeof st === 'object') config = st;
      } else if (fs.existsSync(LAST_TIP_CONFIG_FILE)) {
        config = JSON.parse(fs.readFileSync(LAST_TIP_CONFIG_FILE, 'utf8'));
      }
      const walletProvided = Object.prototype.hasOwnProperty.call(req.body, 'walletAddress') && typeof walletAddress === 'string';
      const effectiveWallet = walletProvided ? (walletAddress || '').trim() : (config.walletAddress || '');
      const newConfig = {
        ...config,
        bgColor: bgColor || config.bgColor || '#080c10',
        fontColor: fontColor || config.fontColor || '#ffffff',
        borderColor: borderColor || config.borderColor || '#00ff7f',
        amountColor: amountColor || config.amountColor || '#00ff7f',
        iconColor: iconColor || config.iconColor || '#ffffff',
        iconBgColor: iconBgColor || config.iconBgColor || '#4f36ff',
        fromColor: fromColor || config.fromColor || '#e9e9e9',

      ...(walletProvided ? { walletAddress: effectiveWallet } : {}),
        title: (typeof title === 'string' && title.trim()) ? title.trim() : (config.title || 'Last tip received 👏')
      };
      if (store && ns) {
        await store.set(ns, 'last-tip-config', newConfig);
      if (walletProvided) {
          try {
            const tg = await store.get(ns, 'tip-goal-config', null);
            const newTg = { ...(tg && typeof tg === 'object' ? tg : {}), walletAddress: effectiveWallet };
            await store.set(ns, 'tip-goal-config', newTg);
          } catch {}
        }

        try {
          if (wss && typeof wss.broadcast === 'function') {
            wss.broadcast(ns, { type: 'lastTipConfig', data: newConfig });
          }
        } catch {}
        return res.json({ success: true, ...newConfig });
      } else {
        fs.writeFileSync(LAST_TIP_CONFIG_FILE, JSON.stringify(newConfig, null, 2));
        const result = lastTip.updateWalletAddress(newConfig.walletAddress);
        if (typeof lastTip.broadcastConfig === 'function') {
          lastTip.broadcastConfig(newConfig);
        }
        if (typeof tipWidget.updateWalletAddress === 'function') {
          tipWidget.updateWalletAddress(newConfig.walletAddress);
        }
        return res.json({ success: true, ...result, ...newConfig });
      }
    } catch (error) {
      console.error('Error updating last tip:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  });

  app.get('/last-donation', async (_req, res) => {
    try {
      if (!lastTip || !lastTip.walletAddress) {
        return res.status(400).json({ error: 'No wallet configured for last tip' });
      }

      const lastDonation = lastTip.getLastDonation();
      if (lastDonation) return res.json(lastDonation);

      if (typeof lastTip.updateLatestDonation === 'function') {
        setTimeout(() => { try { lastTip.updateLatestDonation(); } catch {} }, 0);
        res.set('X-Refresh-Triggered', '1');
      }

      return res.status(404).json({ error: 'No donation cached yet' });
  } catch {
      return res.status(500).json({ error: 'Internal error fetching last donation' });
    }
  });

}

module.exports = registerLastTipRoutes;
