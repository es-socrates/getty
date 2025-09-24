const multer = require('multer');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { z } = require('zod');
const { resolveAdminNamespace } = require('../lib/namespace');
const { getStorage } = require('../lib/supabase-storage');

function registerRaffleRoutes(app, raffle, wss, opts = {}) {
  const store = opts.store || null;
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const hostedWithRedis = !!process.env.REDIS_URL;
  const shouldRequireSession = requireSessionFlag || hostedWithRedis;
  const { isOpenTestMode } = require('../lib/test-open-mode');
  const BUCKET_NAME = 'raffle-images';
  const storage = getStorage();

  const raffleImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1024 * 1024 * 1 }, // 1MB limit
    fileFilter: (_req, file, cb) => {
      const allowedMimes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
      const isValidMime = allowedMimes.includes(file.mimetype);
      const isValidExt = allowedExtensions.some(ext => file.originalname.toLowerCase().endsWith(ext));
      
      if (isValidMime && isValidExt) {
        cb(null, true);
      } else {
        cb(new Error('Only PNG, JPEG, GIF, and WebP images are allowed'));
      }
    }
  });

  app.get('/api/raffle/settings', async (req, res) => {
    try {
      let adminNs = resolveAdminNamespace(req);
  if (!isOpenTestMode() && shouldRequireSession && !adminNs) {
        return res.json({});
      }
      const { settings, meta } = await raffle.getSettingsWithMeta(adminNs);
      const hosted = shouldRequireSession;
      try {
        const { canReadSensitive } = require('../lib/authz');
        const allowSensitive = canReadSensitive(req);
        if (hosted && !allowSensitive && settings && typeof settings === 'object') {
          const clone = { ...settings };
          if ('prize' in clone) clone.prize = '';
          if ('command' in clone) clone.command = '';
          return res.json({ data: clone, meta });
        }
      } catch {}
      res.json({ data: settings, meta });
    } catch (error) {
      console.error('Error in GET /api/raffle/settings:', error);
      res.status(500).json({ error: 'Error getting raffle settings', details: error.message });
    }
  });

  app.get('/api/raffle/state', async (req, res) => {
    try {
      let adminNs = resolveAdminNamespace(req);
  if (!isOpenTestMode() && shouldRequireSession && !adminNs) {
        return res.json({ active: false, paused: false, participants: [], totalWinners: 0 });
      }
      const state = await raffle.getPublicState(adminNs);
      const hosted = shouldRequireSession;
      try {
        const { canReadSensitive } = require('../lib/authz');
        const allowSensitive = canReadSensitive(req);
        if (hosted && !allowSensitive && state && typeof state === 'object') {
          const clone = { ...state };
          if ('prize' in clone) clone.prize = '';
          if ('command' in clone) clone.command = '';
          return res.json(clone);
        }
      } catch {}
      res.json(state);
    } catch (error) {
      console.error('Error in GET /api/raffle/state:', error);
      res.status(500).json({ error: 'Error getting raffle state', details: error.message });
    }
  });

  app.post('/api/raffle/settings', async (req, res) => {
    try {
      let adminNs = resolveAdminNamespace(req);
  if (!isOpenTestMode() && shouldRequireSession && !adminNs) return res.status(401).json({ success: false, error: 'session_required' });
      const { canWriteConfig } = require('../lib/authz');
  if (!isOpenTestMode() && shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ success: false, error: 'forbidden_untrusted_remote_write' });
        }
      }
      const schema = z.object({
        command: z.string().trim().default('!giveaway'),
        prize: z.string().trim().min(1).max(15),
        duration: z.coerce.number().int().positive().default(5),
        maxWinners: z.coerce.number().int().positive().default(1),
        enabled: z
          .union([z.boolean(), z.string(), z.number()])
          .transform(v => v === true || v === 'true' || v === 1 || v === '1')
          .optional(),
        mode: z.enum(['manual', 'auto']).default('manual').optional(),
        interval: z.coerce.number().int().positive().default(5),
        imageUrl: z.string().optional().refine(v => {
          if (v === undefined || v === '') return true;
          if (typeof v !== 'string') return false;
          if (/^https?:\/\/.+/i.test(v)) return true;
          if (v.startsWith('/uploads/raffle/')) return true;
          return false;
        }, { message: 'Invalid URL' })
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        const first = parsed.error?.issues?.[0];
        const msg = first?.path?.length
          ? `${first.path.join('.')}: ${first.message}`
          : (first?.message || 'Invalid payload');
        return res.status(400).json({ success: false, error: msg });
      }
      const settings = parsed.data;
      await raffle.saveSettings(adminNs, settings);
      const { meta } = await raffle.getSettingsWithMeta(adminNs);
      res.json({ success: true, meta: meta || null });
    } catch (error) {
      console.error('Error in POST /api/raffle/settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/start', async (req, res) => {
    try {
      let adminNs = resolveAdminNamespace(req);
  if (!isOpenTestMode() && shouldRequireSession && !adminNs) return res.status(401).json({ success: false, error: 'session_required' });
      const { canWriteConfig } = require('../lib/authz');
  if (!isOpenTestMode() && shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ success: false, error: 'forbidden_untrusted_remote_write' });
        }
      }
      await raffle.start(adminNs);
      broadcastRaffleState(wss, raffle, adminNs);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/stop', async (req, res) => {
    try {
      let adminNs = resolveAdminNamespace(req);
  if (!isOpenTestMode() && shouldRequireSession && !adminNs) return res.status(401).json({ success: false, error: 'session_required' });
      const { canWriteConfig } = require('../lib/authz');
  if (!isOpenTestMode() && shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ success: false, error: 'forbidden_untrusted_remote_write' });
        }
      }
      await raffle.stop(adminNs);
      broadcastRaffleState(wss, raffle, adminNs);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/pause', async (req, res) => {
    try {
      let adminNs = req?.ns?.admin || null;
      if (!adminNs && req.query && req.query.ns) adminNs = String(req.query.ns);
      if (!adminNs && process.env.GETTY_MULTI_TENANT_WALLET === '1' && req.walletSession && req.walletSession.walletHash) {
        adminNs = req.walletSession.walletHash;
      }
  if (!isOpenTestMode() && shouldRequireSession && !adminNs) return res.status(401).json({ success: false, error: 'session_required' });
      const { canWriteConfig } = require('../lib/authz');
  if (!isOpenTestMode() && shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ success: false, error: 'forbidden_untrusted_remote_write' });
        }
      }
      await raffle.pause(adminNs);
      broadcastRaffleState(wss, raffle, adminNs);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/resume', async (req, res) => {
    try {
      let adminNs = resolveAdminNamespace(req);
  if (!isOpenTestMode() && shouldRequireSession && !adminNs) return res.status(401).json({ success: false, error: 'session_required' });
      const { canWriteConfig } = require('../lib/authz');
  if (!isOpenTestMode() && shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ success: false, error: 'forbidden_untrusted_remote_write' });
        }
      }
      await raffle.resume(adminNs);
      broadcastRaffleState(wss, raffle, adminNs);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/draw', async (req, res) => {
    try {
      let adminNs = resolveAdminNamespace(req);
      if (shouldRequireSession && !adminNs) return res.status(401).json({ success: false, error: 'session_required' });
      const { canWriteConfig } = require('../lib/authz');
      if (shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ success: false, error: 'forbidden_untrusted_remote_write' });
        }
      }
      const winner = await raffle.drawWinner(adminNs);
      broadcastRaffleWinner(wss, winner, adminNs);
      broadcastRaffleState(wss, raffle, adminNs);
      res.json({ success: true, winner });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/reset', async (req, res) => {
    try {
      const adminNs = req?.ns?.admin || null;
      if (shouldRequireSession && !adminNs) return res.status(401).json({ success: false, error: 'session_required' });
      const { canWriteConfig } = require('../lib/authz');
      if (shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ success: false, error: 'forbidden_untrusted_remote_write' });
        }
      }
      await raffle.resetWinners(adminNs);
      broadcastRaffleState(wss, raffle, adminNs, { reset: true });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/raffle/upload-image', raffleImageUpload.single('image'), async (req, res) => {
    let adminNs = resolveAdminNamespace(req);
  if (!isOpenTestMode() && shouldRequireSession && !adminNs) return res.status(401).json({ error: 'session_required' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    try {
      const { canWriteConfig } = require('../lib/authz');
  if (!isOpenTestMode() && shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ error: 'forbidden_untrusted_remote_write' });
        }
      }

      const fileName = `${Date.now()}-${req.file.originalname}`;
      const publicUrl = await storage.uploadFile(BUCKET_NAME, req.file.buffer, fileName, req.file.mimetype);
      
      await raffle.setImage(adminNs, publicUrl);
      res.json({ imageUrl: publicUrl });
    } catch (error) {
      console.error('Error uploading raffle image:', error);
      res.status(500).json({ error: 'Failed to upload image', details: error.message });
    }
  });

  app.post('/api/raffle/clear-image', async (req, res) => {
    try {
      let adminNs = req?.ns?.admin || null;
      if (!adminNs && req.query && req.query.ns) adminNs = String(req.query.ns);
      if (!adminNs && process.env.GETTY_MULTI_TENANT_WALLET === '1' && req.walletSession && req.walletSession.walletHash) {
        adminNs = req.walletSession.walletHash;
      }
  if (!isOpenTestMode() && shouldRequireSession && !adminNs) return res.status(401).json({ success: false, error: 'session_required' });

      let currentUrl = '';
      try { currentUrl = (await raffle.getPublicState(adminNs))?.imageUrl || ''; } catch {}
      const { canWriteConfig } = require('../lib/authz');
      if (shouldRequireSession) {
        const allowRemoteWrites = process.env.GETTY_ALLOW_REMOTE_WRITES === '1';
        if (!allowRemoteWrites && !canWriteConfig(req)) {
          return res.status(403).json({ success: false, error: 'forbidden_untrusted_remote_write' });
        }
      }
      await raffle.setImage(adminNs, '');

      if (typeof currentUrl === 'string' && currentUrl.includes('supabase') && currentUrl.includes('/storage/v1/object/public/')) {
        try {
          const urlParts = currentUrl.split('/storage/v1/object/public/');
          if (urlParts.length === 2) {
            const pathParts = urlParts[1].split('/');
            if (pathParts.length >= 2) {
              const fileName = pathParts.slice(1).join('/');
              await storage.deleteFile(BUCKET_NAME, fileName);
            }
          }
        } catch (deleteError) {
          console.error('Error deleting raffle image from Supabase:', deleteError);
        }
      } else if (typeof currentUrl === 'string' && currentUrl.startsWith('/uploads/raffle/')) {
        const uploadsDir = path.resolve('./public/uploads/raffle');
        const rel = currentUrl.replace(/^\/+/, '');
        const abs = path.resolve(path.join('./public', rel));

        if (abs.startsWith(uploadsDir + path.sep) || abs === uploadsDir) {
          fs.promises.unlink(abs).catch(() => {});
        }
      }
      broadcastRaffleState(wss, raffle, adminNs);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  async function __broadcastToNsAndPublic(sendFn, adminNs, opts = {}) {
    try {
      if (!adminNs) return;
      await sendFn(adminNs);
      const { kind } = opts;
      const multiTenant = process.env.GETTY_MULTI_TENANT_WALLET === '1';
      const allowPublicWinner = process.env.GETTY_RAFFLE_BROADCAST_PUBLIC === '1';
      const shouldSendPublic = !multiTenant || kind !== 'winner' || allowPublicWinner;
      if (shouldSendPublic && store && typeof store.get === 'function') {
        try {
          const pubToken = await store.get(adminNs, 'publicToken', null);
          if (typeof pubToken === 'string' && pubToken) await sendFn(pubToken);
        } catch {}
      }
    } catch {}
  }

  function broadcastRaffleState(wss, raffle, ns, extra = {}) {
    const doSend = async (token) => {
      try {
        if (typeof wss.broadcast === 'function' && token) {
          const st = await raffle.getPublicState(token);
          wss.broadcast(token, { type: 'raffle_state', ...st, ...extra });
        } else {
          const st = await raffle.getPublicState(token);
          const payload = JSON.stringify({ type: 'raffle_state', ...st, ...extra });
          wss.clients.forEach(client => {
            try {
              if (client.readyState !== WebSocket.OPEN) return;
              if (token && client.nsToken && client.nsToken !== token) return;
              if (token && !client.nsToken) return;
              client.send(payload);
            } catch {}
          });
        }
      } catch {}
    };
    if (ns) {
      __broadcastToNsAndPublic(doSend, ns, { kind: 'state' });
    } else {
      doSend(null);
    }
  }

  function broadcastRaffleWinner(wss, winner, ns) {
    if (!ns) {
      return;
    }
    const doSend = async (token) => {
      try {
        const pub = await (async () => { try { return await raffle.getPublicState(token); } catch { return {}; } })();
        const payloadObj = {
          type: 'raffle_winner',
          ...(typeof winner === 'object' ? winner : { winner }),
          command: pub.command,
          prize: pub.prize,
          imageUrl: pub.imageUrl
        };

        if (typeof wss.broadcast === 'function' && token) {
          wss.broadcast(token, payloadObj);
        } else {
          const payload = JSON.stringify(payloadObj);
          wss.clients.forEach(client => {
            try {
              if (client.readyState !== WebSocket.OPEN) return;
              if (token && client.nsToken && client.nsToken !== token) return;
              if (token && !client.nsToken) return;
              client.send(payload);
            } catch {}
          });
        }
      } catch {}
    };
    if (ns) {
      __broadcastToNsAndPublic(doSend, ns, { kind: 'winner' });
    } else {
      doSend(null);
    }
  }
}

module.exports = registerRaffleRoutes;
