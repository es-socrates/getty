const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function calculateFileHash(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  } catch (error) {
    console.error('Error calculating file hash:', error);
    return Date.now().toString();
  }
}

function registerGoalAudioRoutes(app, strictLimiter, GOAL_AUDIO_UPLOADS_DIR) {
  const { isOpenTestMode } = require('../lib/test-open-mode');
  const { loadTenantConfig, saveTenantConfig } = require('../lib/tenant-config');
  app.get('/api/goal-audio', (req, res) => {
    try {
      const baseDir = path.join(process.cwd(), 'public/uploads/goal-audio');
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      const hosted = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
      if (hosted && !ns) {
        return res.status(404).json({ error: 'No audio file found' });
      }
      const dir = (ns && typeof ns === 'string') ? path.join(baseDir, ns.replace(/[^a-zA-Z0-9_-]/g, '_')) : baseDir;
      const dirAlt = baseDir;
      let audioFile = null;
      let audioDir = dir;
      try {
        const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
        audioFile = files.find(file => file.startsWith('goal-audio')) || null;
      } catch {}
      if (!audioFile) {
        try {
          const files = fs.existsSync(dirAlt) ? fs.readdirSync(dirAlt) : [];
          audioFile = files.find(file => file.startsWith('goal-audio')) || null;
          audioDir = dirAlt;
        } catch {}
      }

      if (audioFile) {
        const filePath = path.join(audioDir, audioFile);
        const stats = fs.statSync(filePath);
        const fileHash = calculateFileHash(filePath);

        res.set({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'ETag': `"${fileHash}"`,
          'Last-Modified': stats.mtime.toUTCString()
        });

        const clientEtag = req.headers['if-none-match'];
        if (clientEtag && clientEtag === `"${fileHash}"`) {
          return res.status(304).end();
        }

        const ifModifiedSince = req.headers['if-modified-since'];
        if (ifModifiedSince && new Date(ifModifiedSince) >= new Date(stats.mtime)) {
          return res.status(304).end();
        }

        res.sendFile(filePath);
      } else {
        res.status(404).json({ error: 'No audio file found' });
      }
    } catch (error) {
      console.error('Error serving goal audio:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const SETTINGS_FILENAME = 'goal-audio-settings.json';
  const GLOBAL_SETTINGS_PATH = path.join(process.cwd(), 'config', SETTINGS_FILENAME);

  function normalizeSettings(raw) {
    const base = raw && typeof raw === 'object' ? raw : {};
    return {
      audioSource: base.audioSource || 'remote',
      hasCustomAudio: !!base.hasCustomAudio,
      audioFileName: base.audioFileName || null,
      audioFileSize: base.audioFileSize || 0
    };
  }

  app.get('/api/goal-audio-settings', (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
  if (!isOpenTestMode() && (requireSessionFlag || hosted) && !hasNs) {
        return res.json({ audioSource: 'remote', hasCustomAudio: false });
      }
      (async () => {
        try {
          const loaded = await loadTenantConfig(req, req.app?.get('store'), GLOBAL_SETTINGS_PATH, SETTINGS_FILENAME);
          const raw = loaded.data?.data ? loaded.data.data : loaded.data; // unwrap
          const meta = loaded.data && (loaded.data.__version || loaded.data.checksum) ? {
            __version: loaded.data.__version,
            checksum: loaded.data.checksum,
            updatedAt: loaded.data.updatedAt
          } : null;
          const flat = normalizeSettings(raw);
          return res.json(meta ? { meta, ...flat } : flat);
        } catch (e) {
          console.error('Error loading goal audio settings (tenant):', e);
          return res.json({ audioSource: 'remote', hasCustomAudio: false });
        }
      })();
    } catch (error) {
      console.error('Error loading goal audio settings:', error);
      res.status(500).json({ error: 'Error loading settings' });
    }
  });

  app.delete('/api/goal-audio-settings', strictLimiter, (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hostedWithRedis = !!process.env.REDIS_URL;
      const shouldRequireSession = requireSessionFlag || hostedWithRedis;
      const requireAdminWrites = (process.env.GETTY_REQUIRE_ADMIN_WRITE === '1') || hostedWithRedis;

  if (!isOpenTestMode() && shouldRequireSession) {
        const nsCheck = req?.ns?.admin || req?.ns?.pub || null;
        if (!nsCheck) return res.status(401).json({ error: 'session_required' });
      }
      if (requireAdminWrites) {
        const isAdmin = !!(req?.auth && req.auth.isAdmin);
        if (!isAdmin) return res.status(401).json({ error: 'admin_required' });
      }

      try {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        let target = GOAL_AUDIO_UPLOADS_DIR;
        if (ns) {
          const safe = ns.replace(/[^a-zA-Z0-9_-]/g, '_');
          target = path.join(GOAL_AUDIO_UPLOADS_DIR, safe);
        }
        const files = fs.existsSync(target) ? fs.readdirSync(target) : [];
        files.forEach(f => {
          if (f.startsWith('goal-audio')) {
            try { fs.unlinkSync(path.join(target, f)); } catch {}
          }
        });
      } catch {}

      (async () => {
        try {
          const next = {
            audioSource: 'remote',
            hasCustomAudio: false,
            audioFileName: null,
            audioFileSize: 0
          };
          const saveRes = await saveTenantConfig(req, req.app?.get('store'), GLOBAL_SETTINGS_PATH, SETTINGS_FILENAME, next);
          return res.json({ success: true, meta: saveRes.meta, ...next });
        } catch (e) {
          console.error('Error resetting goal audio settings (tenant):', e);
          return res.json({ success: true, audioSource: 'remote', hasCustomAudio: false });
        }
      })();
    } catch (error) {
      console.error('Error deleting goal audio:', error);
      res.status(500).json({ error: 'Error deleting audio' });
    }
  });

  app.get('/api/goal-custom-audio', (req, res) => {
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      const hosted = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
  if (!isOpenTestMode() && hosted && !ns) {
        return res.status(404).json({ error: 'Custom goal audio not found' });
      }
      const base = GOAL_AUDIO_UPLOADS_DIR;
      const dir = (ns && typeof ns === 'string') ? path.join(base, ns.replace(/[^a-zA-Z0-9_-]/g, '_')) : base;
      let audioFile = null;
      let audioDir = dir;
      try {
        const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
        audioFile = files.find(f => f.startsWith('goal-audio')) || null;
      } catch {}
      if (!audioFile) {
        const files = fs.existsSync(base) ? fs.readdirSync(base) : [];
        audioFile = files.find(f => f.startsWith('goal-audio')) || null;
        audioDir = base;
      }
      if (!audioFile) return res.status(404).json({ error: 'Custom goal audio not found' });

      const filePath = path.join(audioDir, audioFile);
      const stats = fs.statSync(filePath);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Last-Modified', stats.mtime.toUTCString());

      const etag = '"' + crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex') + '"';
      res.setHeader('ETag', etag);
      const inm = req.headers['if-none-match'];
      if (inm && inm === etag) return res.status(304).end();

      res.sendFile(path.resolve(filePath));
    } catch (error) {
      console.error('Error serving custom goal audio:', error);
      res.status(500).json({ error: 'Error serving custom goal audio' });
    }
  });
}

module.exports = registerGoalAudioRoutes;
