const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
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

  function loadGoalAudioSettings(GOAL_AUDIO_CONFIG_FILE) {
    try {
      if (fs.existsSync(GOAL_AUDIO_CONFIG_FILE)) {
        const settings = JSON.parse(fs.readFileSync(GOAL_AUDIO_CONFIG_FILE, 'utf8'));
        return {
          audioSource: settings.audioSource || 'remote',
          hasCustomAudio: settings.hasCustomAudio || false,
          audioFileName: settings.audioFileName || null,
          audioFileSize: settings.audioFileSize || 0
        };
      }
    } catch (error) {
      console.error('Error loading goal audio settings:', error);
    }
    return { audioSource: 'remote', hasCustomAudio: false, audioFileName: null, audioFileSize: 0 };
  }

  function saveGoalAudioSettings(GOAL_AUDIO_CONFIG_FILE, newSettings) {
    try {
      const current = loadGoalAudioSettings(GOAL_AUDIO_CONFIG_FILE);
      const merged = { ...current, ...newSettings };
      fs.writeFileSync(GOAL_AUDIO_CONFIG_FILE, JSON.stringify(merged, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving goal audio settings:', error);
      return false;
    }
  }

  app.get('/api/goal-audio-settings', (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const hosted = !!process.env.REDIS_URL;
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
      if ((requireSessionFlag || hosted) && !hasNs) {
        return res.json({ audioSource: 'remote', hasCustomAudio: false });
      }
      const file = path.join(process.cwd(), 'config', 'goal-audio-settings.json');
      if (fs.existsSync(file)) {
        const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
        res.json(settings);
      } else {
        res.json({ audioSource: 'remote', hasCustomAudio: false });
      }
    } catch (error) {
      console.error('Error loading goal audio settings:', error);
      res.status(500).json({ error: 'Error loading settings' });
    }
  });

  app.delete('/api/goal-audio-settings', strictLimiter, (req, res) => {
    try {
      const hosted = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
      if (hosted) {
        const nsCheck = req?.ns?.admin || req?.ns?.pub || null;
        if (!nsCheck) return res.status(401).json({ error: 'session_required' });
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

      const file = path.join(process.cwd(), 'config', 'goal-audio-settings.json');
      saveGoalAudioSettings(file, {
        audioSource: 'remote',
        hasCustomAudio: false,
        audioFileName: null,
        audioFileSize: 0
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting goal audio:', error);
      res.status(500).json({ error: 'Error deleting audio' });
    }
  });

  app.get('/api/goal-custom-audio', (req, res) => {
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      const hosted = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
      if (hosted && !ns) {
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
