const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { z } = require('zod');
const { loadTenantConfig, saveTenantConfig } = require('../lib/tenant-config');
const { writeHybridConfig, readHybridConfig } = require('../lib/hybrid-config');
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

function registerTipGoalRoutes(app, strictLimiter, goalAudioUpload, tipGoal, wss, TIP_GOAL_CONFIG_FILE, GOAL_AUDIO_CONFIG_FILE, options = {}) {
  const store = (options && options.store) || null;
  const tenant = (() => { try { return require('../lib/tenant'); } catch { return null; } })();
  const __VERBOSE_BROADCAST = process.env.GETTY_VERBOSE_BROADCAST === '1';

  function __hostedRedis() { return !!(store && store.redis); }
  function __requireSessionFlag() { return process.env.GETTY_REQUIRE_SESSION === '1'; }
  function __requireAdminWriteFlag() { return process.env.GETTY_REQUIRE_ADMIN_WRITE === '1'; }
  function __hasRedisUrl() { return !!process.env.REDIS_URL; }
  function __hosted() { return __hostedRedis() || __requireSessionFlag(); }
  function __shouldRequireSession() { return __hosted() && !isOpenTestMode(); }
  function __shouldRequireAdminWrites() { return (__requireAdminWriteFlag() || __hasRedisUrl()) && !isOpenTestMode(); }
  function __shouldEnforceTrustedWrite() { return __hosted() && !isOpenTestMode(); }

  function readConfigRaw() {
    try {
      if (fs.existsSync(TIP_GOAL_CONFIG_FILE)) {
        try {
          const hybrid = readHybridConfig(TIP_GOAL_CONFIG_FILE);
          if (hybrid && hybrid.data && Object.keys(hybrid.data).length) return hybrid.data;
        } catch {}
        try { return JSON.parse(fs.readFileSync(TIP_GOAL_CONFIG_FILE, 'utf8')); } catch {}
      }
    } catch {}
    return null;
  }

  app.get('/api/tip-goal', async (req, res) => {
    try {
      let cfg = null;
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      try { const { ensureWalletSession } = require('../lib/wallet-session'); ensureWalletSession(req); } catch {}
      if (process.env.GETTY_DISABLE_GLOBAL_FALLBACK === '1' && req.walletSession && !(tenant && tenant.tenantEnabled(req))) {
        try {
          const walletHash = req.walletSession.walletHash || require('../lib/wallet-auth').deriveWalletHash(req.walletSession.addr);
          const tenantPath = require('path').join(process.cwd(),'tenant', walletHash, 'config', 'tip-goal-config.json');
          const exists = require('fs').existsSync(tenantPath);
          if (!exists) return res.status(404).json({ error: 'No tip goal configured', tenant: true, strict: true });
        } catch {}
      }
      let meta = null;
      if (tenant && tenant.tenantEnabled(req)) {
        try {
          const storeInst = (req.app && req.app.get) ? req.app.get('store') : store;
          const lt = await loadTenantConfig(req, storeInst, TIP_GOAL_CONFIG_FILE, 'tip-goal-config.json');
          const data = lt.data?.data ? lt.data.data : lt.data;
          if (data && Object.keys(data).length) {
            cfg = data;
            meta = { source: lt.source, tenantPath: lt.tenantPath, checksum: lt.data.checksum, __version: lt.data.__version };
          }
        } catch (e) { if (process.env.GETTY_TENANT_DEBUG === '1') console.warn('[tip-goal][tenant_load_error]', e.message); }
      } else if (store && ns) {
        const wrapped = await store.getConfig(ns, 'tip-goal-config.json', null) || await store.get(ns, 'tip-goal-config', null);
        if (wrapped) {
          cfg = wrapped.data ? wrapped.data : wrapped;
          meta = wrapped.data ? { __version: wrapped.__version, checksum: wrapped.checksum } : null;
        }
      }
      if (!cfg) cfg = readConfigRaw();
      if (!cfg) return res.status(404).json({ error: 'No tip goal configured' });
      const out = { ...cfg };
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

      try {
        const monthlyGoalVal = Number(out.monthlyGoal || out.goalAmount || 0) || 0;
        const currentAmountVal = (typeof out.currentAmount === 'number') ? out.currentAmount
          : (typeof out.currentTips === 'number') ? out.currentTips : 0;
        const rateCandidate = (() => {
          try {
            if (tipGoal && typeof tipGoal.AR_TO_USD === 'number' && tipGoal.AR_TO_USD > 0) return tipGoal.AR_TO_USD;
            if (global.__arPriceCache && global.__arPriceCache.usd > 0) return Number(global.__arPriceCache.usd) || 0;
          } catch {}
          return 0;
        })();
        const progress = (monthlyGoalVal > 0) ? Math.min((currentAmountVal / monthlyGoalVal) * 100, 100) : 0;
        const enrich = {
          currentTips: currentAmountVal,
          progress,
          ...(rateCandidate > 0 ? {
            exchangeRate: rateCandidate,
            usdValue: (currentAmountVal * rateCandidate).toFixed(2),
            goalUsd: (monthlyGoalVal * rateCandidate).toFixed(2)
          } : {})
        };
        return res.json({ success: true, ...(meta ? { meta } : {}), ...out, ...enrich });
      } catch {
        return res.json({ success: true, ...(meta ? { meta } : {}), ...out });
      }
    } catch (e) {
      res.status(500).json({ error: 'Error loading tip goal config', details: e.message });
    }
  });
  app.post('/api/tip-goal', strictLimiter, goalAudioUpload.single('audioFile'), async (req, res) => {
    try {
      try { require('../lib/wallet-session').ensureWalletSession(req); } catch {}

  if (__shouldRequireSession() && !(req?.ns?.admin || req?.ns?.pub || (req.walletSession && req.walletSession.walletHash))) {
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
      if (tenant && tenant.tenantEnabled(req)) {
        try {
          const storeInst = (req.app && req.app.get) ? req.app.get('store') : store;
          const lt = await loadTenantConfig(req, storeInst, TIP_GOAL_CONFIG_FILE, 'tip-goal-config.json');
          const data = lt.data?.data ? lt.data.data : lt.data;
          if (data && Object.keys(data).length) prevCfg = data;
        } catch {}
      } else if (store && ns) {
        try {
          let wrapped = null;
          if (typeof store.getConfig === 'function') {
            try { wrapped = await store.getConfig(ns, 'tip-goal-config.json', null); } catch {}
          }
          if (!wrapped) {
            try { wrapped = await store.get(ns, 'tip-goal-config', null); } catch {}
          }
          prevCfg = wrapped ? (wrapped.data ? wrapped.data : wrapped) : null;
        } catch {}
      } else {
        prevCfg = readConfigRaw();
      }
      prevCfg = (prevCfg && typeof prevCfg === 'object') ? prevCfg : {};

      const walletProvided = Object.prototype.hasOwnProperty.call(req.body, 'walletAddress') && typeof data.walletAddress === 'string';
      let walletAddress = (prevCfg && typeof prevCfg.walletAddress === 'string') ? prevCfg.walletAddress : '';
      if (walletProvided) {
        walletAddress = (data.walletAddress || '').trim();

      if (walletAddress && !isValidArweaveAddress(walletAddress)) {
          return res.status(400).json({ error: 'invalid_wallet_address' });
        }
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

      if (!(tenant && tenant.tenantEnabled(req)) && !(store && ns)) {
        try { if (tipGoal && typeof tipGoal.updateWalletAddress === 'function') tipGoal.updateWalletAddress(walletAddress); } catch {}
        try { if (tipGoal) tipGoal.monthlyGoalAR = monthlyGoal; } catch {}
        try { if (tipGoal) tipGoal.currentTipsAR = currentAmount; } catch {}
        try { if (tipGoal) tipGoal.theme = theme; } catch {}
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
      let meta = null;
      if (tenant && tenant.tenantEnabled(req)) {
        try {
          const storeInst = (req.app && req.app.get) ? req.app.get('store') : store;
          const saveRes = await saveTenantConfig(req, storeInst, TIP_GOAL_CONFIG_FILE, 'tip-goal-config.json', config);
          meta = saveRes.meta;
          if (walletProvided) {
            try {
              const lastTipGlobal = path.join(process.cwd(), 'config', 'last-tip-config.json');

              let existingLast = {};
              try {
                const ltLoaded = await loadTenantConfig(req, storeInst, lastTipGlobal, 'last-tip-config.json');
                const data = ltLoaded.data?.data ? ltLoaded.data.data : ltLoaded.data;
                if (data && typeof data === 'object') existingLast = data;
              } catch {}
              const mergedLast = { ...existingLast, walletAddress };
              await saveTenantConfig(req, storeInst, lastTipGlobal, 'last-tip-config.json', mergedLast);
            } catch {}
          }
        } catch (e) { if (process.env.GETTY_TENANT_DEBUG === '1') console.warn('[tip-goal][tenant_save_error]', e.message); }
      } else if (store && ns) {
        if (typeof store.setConfig === 'function') {
          try { await store.setConfig(ns, 'tip-goal-config.json', config); } catch { /* fall through */ }
        }
        if (!(typeof store.setConfig === 'function')) {
          try { await store.set(ns, 'tip-goal-config', config); } catch {}
        }
        if (walletProvided) {
          try {
            let existingLast = {};
            if (typeof store.getConfig === 'function') {
              try { existingLast = await store.getConfig(ns, 'last-tip-config.json', null) || {}; } catch {}
            }
            if (!existingLast || Object.keys(existingLast).length === 0) {
              try { existingLast = await store.get(ns, 'last-tip-config', null) || {}; } catch {}
            }
            const existingData = existingLast.data ? existingLast.data : existingLast;
            const mergedLast = { ...(existingData && typeof existingData === 'object' ? existingData : {}), walletAddress };
            if (typeof store.setConfig === 'function') {
              try { await store.setConfig(ns, 'last-tip-config.json', mergedLast); } catch {}
            } else {
              try { await store.set(ns, 'last-tip-config', mergedLast); } catch {}
            }
          } catch {}
        }
      } else {
        try {
          const saveRes = writeHybridConfig(TIP_GOAL_CONFIG_FILE, config);
          meta = saveRes.meta || meta;
        } catch {
          try { fs.writeFileSync(TIP_GOAL_CONFIG_FILE, JSON.stringify(config, null, 2)); } catch {}
        }
      }

      try {
        if (!(tenant && tenant.tenantEnabled(req)) && !(store && ns) && typeof tipGoal === 'object' && tipGoal) {
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
        if (tenant && tenant.tenantEnabled(req)) {
          tenant.saveTenantAwareConfig(req, GOAL_AUDIO_CONFIG_FILE, 'goal-audio-settings.json', () => audioCfg);
        } else if (store && ns) {
          await store.set(ns, 'goal-audio-settings', audioCfg);
        } else {
          try { writeHybridConfig(GOAL_AUDIO_CONFIG_FILE, audioCfg); } catch { try { fs.writeFileSync(GOAL_AUDIO_CONFIG_FILE, JSON.stringify(audioCfg, null, 2)); } catch {} }
        }
      } catch {}

      if (tenant && tenant.tenantEnabled(req)) {
        const walletNs = (req.walletSession && req.walletSession.walletHash) ? req.walletSession.walletHash : null;
        try {
          if (walletNs && process.env.NODE_ENV === 'test' && __VERBOSE_BROADCAST) console.warn('[tip-goal][broadcast]', { path: 'tenant', walletNs, hasWs: !!wss, hasBroadcast: typeof wss?.broadcast === 'function' });
          if (walletNs && typeof wss?.broadcast === 'function') wss.broadcast(walletNs, { type: 'tipGoalUpdate', data: { ...config } });
        } catch {}
      } else if (store && ns) {
        try {
          if (process.env.NODE_ENV === 'test' && __VERBOSE_BROADCAST) console.warn('[tip-goal][broadcast]', { path: 'store-ns', ns });
          if (typeof wss?.broadcast === 'function') wss.broadcast(ns, { type: 'tipGoalUpdate', data: { ...config } });
        } catch {}
      } else if (req.walletSession && req.walletSession.walletHash && process.env.GETTY_MULTI_TENANT_WALLET === '1') {
        try {
          if (process.env.NODE_ENV === 'test' && __VERBOSE_BROADCAST) console.warn('[tip-goal][broadcast]', { path: 'wallet-fallback', walletNs: req.walletSession.walletHash });
          if (typeof wss?.broadcast === 'function') wss.broadcast(req.walletSession.walletHash, { type: 'tipGoalUpdate', data: { ...config } });
        } catch {}
      } else {
        try { if (tipGoal && typeof tipGoal.sendGoalUpdate === 'function') tipGoal.sendGoalUpdate(); } catch {}
      }

      try {
        if (req.walletSession && req.walletSession.walletHash && typeof wss?.broadcast === 'function') {
          wss.broadcast(req.walletSession.walletHash, { type: 'tipGoalUpdate', data: { ...config, _dup: true } });
        }
      } catch {}

      if (process.env.NODE_ENV === 'test') {
        try {
          const targetNs = (tenant && tenant.tenantEnabled(req)) ? req.walletSession.walletHash : (store && ns) ? ns : (req.walletSession && req.walletSession.walletHash) || null;
          if (targetNs && wss && wss.clients) {
            let anyDelivered = false;
            wss.clients.forEach(c => { if (c.readyState === 1 && c.nsToken === targetNs) anyDelivered = true; });
            if (anyDelivered) {
              let sawExisting = false;
              wss.clients.forEach(c => {
                if (c.readyState === 1 && c.nsToken === targetNs) {
                  try { c.send(JSON.stringify({ type: 'tipGoalUpdate', data: { ...config, _redundant: true } })); } catch {}
                }
              });
              if (!sawExisting) { /* no-op placeholder */ }
            }
          }
        } catch {}
      }

      try {

        const rateCandidate = (() => {
          try {
            if (tipGoal && typeof tipGoal.AR_TO_USD === 'number' && tipGoal.AR_TO_USD > 0) return tipGoal.AR_TO_USD;
            if (global.__arPriceCache && global.__arPriceCache.usd > 0) return Number(global.__arPriceCache.usd) || 0;
          } catch {}
          return 0;
        })();
        const progressDerived = (typeof monthlyGoal === 'number' && monthlyGoal > 0)
          ? Math.min((currentAmount / monthlyGoal) * 100, 100)
          : 0;
        const broadcastPayload = {
          ...config,
          currentTips: currentAmount,
          progress: progressDerived,
          ...(rateCandidate > 0 ? {
            exchangeRate: rateCandidate,
            usdValue: (currentAmount * rateCandidate).toFixed(2),
            goalUsd: (monthlyGoal * rateCandidate).toFixed(2)
          } : {})
        };
        if (tenant && tenant.tenantEnabled(req)) {
          if (req.walletSession && req.walletSession.walletHash && typeof wss?.broadcast === 'function') {
            try {
              wss.broadcast(req.walletSession.walletHash, { type: 'tipGoalUpdate', data: broadcastPayload });
            } catch {}
            wss.broadcast(req.walletSession.walletHash, { type: 'goalAudioSettingsUpdate', data: { audioSource, hasCustomAudio, audioFileName, audioFileSize, ...(audioFile ? { customAudioUrl: audioFile } : {}) } });
          }
        } else if (store && ns && typeof wss?.broadcast === 'function') {
          try { wss.broadcast(ns, { type: 'tipGoalUpdate', data: broadcastPayload }); } catch {}
          wss.broadcast(ns, { type: 'goalAudioSettingsUpdate', data: { audioSource, hasCustomAudio, audioFileName, audioFileSize, ...(audioFile ? { customAudioUrl: audioFile } : {}) } });
        } else if (req.walletSession && req.walletSession.walletHash && process.env.GETTY_MULTI_TENANT_WALLET === '1') {
          if (typeof wss?.broadcast === 'function') {
            try { wss.broadcast(req.walletSession.walletHash, { type: 'tipGoalUpdate', data: broadcastPayload }); } catch {}
            wss.broadcast(req.walletSession.walletHash, { type: 'goalAudioSettingsUpdate', data: { audioSource, hasCustomAudio, audioFileName, audioFileSize, ...(audioFile ? { customAudioUrl: audioFile } : {}) } });
          }
        } else if (wss && wss.clients) {

          try {
            wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'tipGoalUpdate', data: broadcastPayload }));
              }
            });
          } catch {}
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'goalAudioSettingsUpdate', data: { audioSource, hasCustomAudio, audioFileName, audioFileSize, ...(audioFile ? { customAudioUrl: audioFile } : {}) } }));
            }
          });
        }
      } catch {}

      try {
        const rateCandidate = (() => {
          try {
            if (tipGoal && typeof tipGoal.AR_TO_USD === 'number' && tipGoal.AR_TO_USD > 0) return tipGoal.AR_TO_USD;
            if (global.__arPriceCache && global.__arPriceCache.usd > 0) return Number(global.__arPriceCache.usd) || 0;
          } catch {}
          return 0;
        })();
        const progressDerived = (typeof monthlyGoal === 'number' && monthlyGoal > 0)
          ? Math.min((currentAmount / monthlyGoal) * 100, 100)
          : 0;
        const responsePayload = {
          ...config,
          currentTips: currentAmount,
          progress: progressDerived,
          ...(rateCandidate > 0 ? {
            exchangeRate: rateCandidate,
            usdValue: (currentAmount * rateCandidate).toFixed(2),
            goalUsd: (monthlyGoal * rateCandidate).toFixed(2)
          } : {})
        };
        return res.json({ success: true, active: true, ...(meta ? { meta } : {}), ...responsePayload });
      } catch {
        return res.json({ success: true, active: true, ...(meta ? { meta } : {}), ...config });
      }
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
