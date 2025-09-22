const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { loadTenantConfig, saveTenantConfig } = require('../lib/tenant-config');
const { readHybridConfig, writeHybridConfig } = require('../lib/hybrid-config');
const { isOpenTestMode } = require('../lib/test-open-mode');

const ARWEAVE_RX = /^[A-Za-z0-9_-]{43}$/;
function isValidArweaveAddress(addr) {
  try {
    if (typeof addr !== 'string') return false;
    const s = addr.trim();
    if (!ARWEAVE_RX.test(s)) return false;
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 2 ? '==' : (b64.length % 4 === 3 ? '=' : '');
    const decoded = Buffer.from(b64 + pad, 'base64');
    if (decoded.length !== 32) return false;
    const roundtrip = decoded.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
    return roundtrip === s;
  } catch { return false; }
}

function registerLastTipRoutes(app, lastTip, tipWidget, options = {}) {
  const store = options.store || null;
  const wss = options.wss || null;
  const LAST_TIP_CONFIG_FILE = path.join(process.cwd(), 'config', 'last-tip-config.json');
  const tenant = (() => { try { return require('../lib/tenant'); } catch { return null; } })();

  function __hasRedisStore() { return !!(store && store.redis); }
  function __requireSessionFlag() { return process.env.GETTY_REQUIRE_SESSION === '1'; }
  function __requireAdminWriteFlag() { return process.env.GETTY_REQUIRE_ADMIN_WRITE === '1'; }
  function __hasRedisUrl() { return !!process.env.REDIS_URL; }
  function __hosted() { return __hasRedisStore() || __requireSessionFlag(); }
  function __shouldRequireSession() { return __hosted() && !isOpenTestMode(); }
  function __shouldRequireAdminWrites() { return (__requireAdminWriteFlag() || __hasRedisUrl()) && !isOpenTestMode(); }
  function __shouldEnforceTrustedWrite() { return __hosted() && !isOpenTestMode(); }

  app.get('/api/last-tip', async (req, res) => {
    try {
      let cfg = null;
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      let meta = null;

      if (tenant && tenant.tenantEnabled(req)) {
        try {
          const storeInst = (req.app && req.app.get) ? req.app.get('store') : store;
          const lt = await loadTenantConfig(req, storeInst, LAST_TIP_CONFIG_FILE, 'last-tip-config.json');
          const data = lt.data?.data ? lt.data.data : lt.data;
          if (data && Object.keys(data).length) cfg = data;

          if (lt.tenantPath && fs.existsSync(lt.tenantPath)) {
            try {
              const raw = JSON.parse(fs.readFileSync(lt.tenantPath, 'utf8'));
              meta = { __version: raw.__version, checksum: raw.checksum, updatedAt: raw.updatedAt, source: lt.source };
            } catch {}
          }
        } catch {}
      } else if (store && ns) {
        let wrapped = null;
        if (typeof store.getConfig === 'function') {
          try { wrapped = await store.getConfig(ns, 'last-tip-config.json', null); } catch {}
        }
        if (!wrapped) {
          try { wrapped = await store.get(ns, 'last-tip-config', null); } catch {}
        }
        if (wrapped) cfg = wrapped.data ? wrapped.data : wrapped;
      }
      if (!cfg) {
        if (!fs.existsSync(LAST_TIP_CONFIG_FILE)) return res.status(404).json({ error: 'No last tip config' });
        try {
          const hybrid = readHybridConfig(LAST_TIP_CONFIG_FILE);
          cfg = hybrid.data || {};
          if (hybrid.meta && hybrid.meta.wrapped) {
            meta = { __version: hybrid.meta.__version, checksum: hybrid.meta.checksum, updatedAt: hybrid.meta.updatedAt, source: 'global-file' };
          } else if (!hybrid.meta?.error) {
            const rawTxt = fs.readFileSync(LAST_TIP_CONFIG_FILE, 'utf8');
            try { const legacy = JSON.parse(rawTxt); if (legacy.__version) meta = { __version: legacy.__version, checksum: legacy.checksum, updatedAt: legacy.updatedAt, source: 'global-file' }; } catch {}
          }
        } catch { cfg = {}; }
      }

  const out = { ...cfg };
  try { if (out && typeof out === 'object' && 'iconColor' in out) delete out.iconColor; } catch {}
      try {
        const hosted = (!!(store && store.redis)) || (process.env.GETTY_REQUIRE_SESSION === '1');
        const { canReadSensitive } = require('../lib/authz');
        const allowSensitive = canReadSensitive(req);
        if (hosted) {
          if (!allowSensitive && out && typeof out === 'object' && out.walletAddress) delete out.walletAddress;
        } else {
          const remote = (req.socket && req.socket.remoteAddress) || (req.connection && req.connection.remoteAddress) || req.ip || '';
          const isLocalIp = /^::1$|^127\.0\.0\.1$|^::ffff:127\.0\.0\.1$/i.test(remote);
          const hostHeader = req.headers.host || '';
            const hostNameOnly = hostHeader.replace(/^\[/, '').replace(/\]$/, '').split(':')[0];
            const isLocalHostHeader = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)$/i.test(hostNameOnly);
            const isLocal = isLocalIp || isLocalHostHeader;
            if (!isLocal && out && typeof out === 'object' && out.walletAddress) delete out.walletAddress;
        }
      } catch {}
      res.json({ success: true, ...(meta ? { meta } : {}), ...out });
    } catch (e) {
      res.status(500).json({ error: 'Error loading last tip config', details: e.message });
    }
  });

  app.get('/api/last-tip/earnings', async (req, res) => {
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
  if (__shouldRequireSession() && !(req?.ns?.admin || req?.ns?.pub)) {
        return res.status(401).json({ error: 'no_session' });
      }
  if (!__hosted()) {

        try {
          const remote = (req.socket && req.socket.remoteAddress) || (req.connection && req.connection.remoteAddress) || req.ip || '';
          const isLocalIp = /^::1$|^127\.0\.0\.1$|^::ffff:127\.0\.0\.1$/i.test(remote);
          const hostHeader = req.headers.host || '';
          const hostNameOnly = hostHeader.replace(/^\[/, '').replace(/\]$/, '').split(':')[0];
          const isLocalHostHeader = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)$/i.test(hostNameOnly);
          const isLocal = isLocalIp || isLocalHostHeader;
          if (!isLocal) return res.status(401).json({ error: 'no_session' });
        } catch {}
      }

      let wallet = '';
      try {
        const tenantLib = (() => { try { return require('../lib/tenant'); } catch { return null; } })();
        const tenantEnabled = tenantLib && typeof tenantLib.tenantEnabled === 'function' ? tenantLib.tenantEnabled(req) : false;
        if (tenantEnabled) {
          try {
            const { loadTenantConfig } = require('../lib/tenant-config');
            const globalPath = path.join(process.cwd(), 'config', 'last-tip-config.json');
            const wrapped = await loadTenantConfig(req, store, globalPath, 'last-tip-config.json');
            const data = wrapped?.data?.data ? wrapped.data.data : wrapped?.data;
            if (data && typeof data.walletAddress === 'string' && data.walletAddress.trim()) {
              wallet = data.walletAddress.trim();
            }
          } catch {}
        }
      } catch {}

      if (!wallet && store && ns) {
        try {
          if (typeof store.getConfig === 'function') {
            const wrapped = await store.getConfig(ns, 'last-tip-config.json', null);
            if (wrapped && wrapped.data && typeof wrapped.data.walletAddress === 'string' && wrapped.data.walletAddress.trim()) {
              wallet = wrapped.data.walletAddress.trim();
            }
          }
        } catch {}
        if (!wallet) {
          try {
            const cfg = await store.get(ns, 'last-tip-config', null);
            if (cfg && typeof cfg.walletAddress === 'string' && cfg.walletAddress.trim()) wallet = cfg.walletAddress.trim();
          } catch {}
        }
      }
      if (!wallet) {
        try {
          const cfgPath = path.join(process.cwd(), 'config', 'last-tip-config.json');
          if (fs.existsSync(cfgPath)) {
            try {
              const rawTxt = fs.readFileSync(cfgPath, 'utf8');
              const parsed = JSON.parse(rawTxt);
              const data = parsed && parsed.data ? parsed.data : parsed; // wrapper or legacy
              if (data && typeof data.walletAddress === 'string' && data.walletAddress.trim()) {
                wallet = data.walletAddress.trim();
              }
            } catch {}
          }
        } catch {}
      }
      if (!wallet && lastTip && lastTip.walletAddress) {
        wallet = String(lastTip.walletAddress).trim();
      }
      if (!wallet) {
        return res.json({ totalAR: 0, txCount: 0, ns: !!ns, configured: false, warning: 'no_wallet_configured' });
      }

      if (!lastTip || typeof lastTip.getEnhancedTransactions !== 'function') {
        return res.status(500).json({ error: 'module_unavailable' });
      }

      let txs = [];
      try { txs = await lastTip.getEnhancedTransactions(wallet); } catch {}
      if (!Array.isArray(txs)) txs = [];
      let totalAR = 0;
      let count = 0;
      for (const tx of txs) {
        const n = parseFloat(tx?.amount);
        if (!isNaN(n) && n > 0) { totalAR += n; count++; }
      }

  totalAR = Number(totalAR.toFixed(6));

  return res.json({ totalAR, txCount: count, ns: !!ns });
    } catch (e) {
      return res.status(500).json({ error: 'internal_error', details: e?.message || String(e) });
    }
  });

  app.get('/api/last-tip/status', async (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL || requireSessionFlag;
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
      const st = lastTip && typeof lastTip.getStatus === 'function' ? lastTip.getStatus() : { active: false };
      const clone = { ...st };
      if ((requireSessionFlag || hosted) && !hasNs) {
        if (clone.walletAddress) clone.walletAddress = null;
      }

      try {
        if (clone.diagnostics && clone.diagnostics.lastFetchTs) {
          clone.diagnostics.lastFetchAgeSeconds = Math.round((Date.now() - clone.diagnostics.lastFetchTs) / 1000);
        }
      } catch {}
      res.json({ ok: true, ...clone });
    } catch (e) {
      res.status(500).json({ error: 'last_tip_status_failed', details: e?.message });
    }
  });

  app.post('/api/last-tip', async (req, res) => {
    try {

  if (__shouldRequireSession() && !(req?.ns?.admin || req?.ns?.pub)) {
        return res.status(401).json({ error: 'no_session' });
      }
  if (__shouldRequireAdminWrites()) {
        const isAdmin = !!(req?.auth && req.auth.isAdmin);
        if (!isAdmin) return res.status(401).json({ error: 'admin_required' });
      }
      const { canWriteConfig } = require('../lib/authz');
  if (__shouldEnforceTrustedWrite() && !canWriteConfig(req)) {
        return res.status(403).json({ error: 'forbidden_untrusted_remote_write' });
      }
      const schema = z.object({
        walletAddress: z.string().optional(),
        bgColor: z.string().optional(),
        fontColor: z.string().optional(),
        borderColor: z.string().optional(),
        amountColor: z.string().optional(),
        iconBgColor: z.string().optional(),
        fromColor: z.string().optional(),
        title: z.string().max(120).optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
      const { walletAddress, bgColor, fontColor, borderColor, amountColor, iconBgColor, fromColor, title } = parsed.data;
      let config = {};
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (tenant && tenant.tenantEnabled(req)) {
        try {
          const storeInst = (req.app && req.app.get) ? req.app.get('store') : store;
          const lt = await loadTenantConfig(req, storeInst, LAST_TIP_CONFIG_FILE, 'last-tip-config.json');
          const data = lt.data?.data ? lt.data.data : lt.data;
          if (data && Object.keys(data).length) config = data;
        } catch {}
      } else if (store && ns) {
        try {
          let wrapped = null;
          if (typeof store.getConfig === 'function') {
            try { wrapped = await store.getConfig(ns, 'last-tip-config.json', null); } catch {}
          }
            if (!wrapped) {
              try { wrapped = await store.get(ns, 'last-tip-config', null); } catch {}
            }
          if (wrapped) config = wrapped.data ? wrapped.data : wrapped;
        } catch {}
      } else if (fs.existsSync(LAST_TIP_CONFIG_FILE)) {
        try {
          const hybrid = readHybridConfig(LAST_TIP_CONFIG_FILE);
          config = hybrid.data || {};
        } catch {}
      }
      const walletProvided = Object.prototype.hasOwnProperty.call(req.body, 'walletAddress') && typeof walletAddress === 'string';
      let effectiveWallet = walletProvided ? (walletAddress || '').trim() : (config.walletAddress || '');

      if (walletProvided && !effectiveWallet && config.walletAddress) {
        effectiveWallet = config.walletAddress;
      }
  if (walletProvided && effectiveWallet && !isValidArweaveAddress(effectiveWallet)) {
        return res.status(400).json({ error: 'invalid_wallet_address' });
      }
      const newConfig = {
        ...config,
        bgColor: bgColor || config.bgColor || '#080c10',
        fontColor: fontColor || config.fontColor || '#ffffff',
        borderColor: borderColor || config.borderColor || '#00ff7f',
        amountColor: amountColor || config.amountColor || '#00ff7f',
        iconBgColor: iconBgColor || config.iconBgColor || '#4f36ff',
        fromColor: fromColor || config.fromColor || '#e9e9e9',

      ...(walletProvided ? { walletAddress: effectiveWallet } : {}),
        title: (typeof title === 'string' && title.trim()) ? title.trim() : (config.title || 'Last tip received 👏')
      };
      let meta = null;
      if (tenant && tenant.tenantEnabled(req)) {
        try {
          const storeInst = (req.app && req.app.get) ? req.app.get('store') : store;
          const saveRes = await saveTenantConfig(req, storeInst, LAST_TIP_CONFIG_FILE, 'last-tip-config.json', newConfig);
          meta = saveRes.meta;
          if (walletProvided) {
            try {
              const tgGlobal = path.join(process.cwd(), 'config', 'tip-goal-config.json');
              let existingTg = {};
              try {
                const tgLoaded = await loadTenantConfig(req, storeInst, tgGlobal, 'tip-goal-config.json');
                const data = tgLoaded.data?.data ? tgLoaded.data.data : tgLoaded.data;
                if (data && typeof data === 'object') existingTg = data;
              } catch {}
              const mergedTg = { ...existingTg, walletAddress: effectiveWallet };
              await saveTenantConfig(req, storeInst, tgGlobal, 'tip-goal-config.json', mergedTg);
            } catch {}
          }
          if (wss && typeof wss.broadcast === 'function' && req.walletSession && req.walletSession.walletHash) {
            try { wss.broadcast(req.walletSession.walletHash, { type: 'lastTipConfig', data: newConfig }); } catch {}
          }
          try { if (lastTip) { lastTip._lastReqForSave = req; lastTip.scheduleWriteThrough(newConfig); } } catch {}
          return res.json({ success: true, tenant: true, ...(meta ? { meta } : {}), ...newConfig });
        } catch (e) { return res.status(500).json({ error: 'tenant_save_failed', details: e.message }); }
      } else if (store && ns) {
        if (typeof store.setConfig === 'function') {
          try { await store.setConfig(ns, 'last-tip-config.json', newConfig); } catch {}
        } else {
          try { await store.set(ns, 'last-tip-config', newConfig); } catch {}
        }
        if (walletProvided) {
          try {
            let existingTg = {};
            if (typeof store.getConfig === 'function') {
              try { existingTg = await store.getConfig(ns, 'tip-goal-config.json', null) || {}; } catch {}
            }
            if (!existingTg || Object.keys(existingTg).length === 0) {
              try { existingTg = await store.get(ns, 'tip-goal-config', null) || {}; } catch {}
            }
            const existingData = existingTg.data ? existingTg.data : existingTg;
            const mergedTg = { ...(existingData && typeof existingData === 'object' ? existingData : {}), walletAddress: effectiveWallet };
            if (typeof store.setConfig === 'function') {
              try { await store.setConfig(ns, 'tip-goal-config.json', mergedTg); } catch {}
            } else {
              try { await store.set(ns, 'tip-goal-config', mergedTg); } catch {}
            }
          } catch {}
        }
        if (wss && typeof wss.broadcast === 'function') {
            try { wss.broadcast(ns, { type: 'lastTipConfig', data: newConfig }); } catch {}
        }
        try { if (lastTip) { lastTip._lastReqForSave = req; lastTip.scheduleWriteThrough(newConfig); } } catch {}
        return res.json({ success: true, ...(meta ? { meta } : {}), ...newConfig });
      } else {
        try { writeHybridConfig(LAST_TIP_CONFIG_FILE, newConfig); } catch { try { fs.writeFileSync(LAST_TIP_CONFIG_FILE, JSON.stringify(newConfig, null, 2)); } catch {} }
        const result = (lastTip && typeof lastTip.updateWalletAddress === 'function') ? lastTip.updateWalletAddress(newConfig.walletAddress) : {};
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
