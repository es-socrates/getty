const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

function loadAudioSettings(AUDIO_CONFIG_FILE) {
  try {
    if (fs.existsSync(AUDIO_CONFIG_FILE)) {
      const settings = JSON.parse(fs.readFileSync(AUDIO_CONFIG_FILE, 'utf8'));
      return {
        audioSource: settings.audioSource || 'remote',
        hasCustomAudio: settings.hasCustomAudio || false,
        audioFileName: settings.audioFileName || null,
        audioFileSize: settings.audioFileSize || 0
      };
    }
  } catch (error) {
    console.error('Error loading audio settings:', error);
  }
  return { audioSource: 'remote', hasCustomAudio: false, audioFileName: null, audioFileSize: 0 };
}

function saveAudioSettings(AUDIO_CONFIG_FILE, newSettings) {
  try {
    const current = loadAudioSettings(AUDIO_CONFIG_FILE);
    const merged = { ...current, ...newSettings };
    fs.writeFileSync(AUDIO_CONFIG_FILE, JSON.stringify(merged, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving audio settings:', error);
    return false;
  }
}

function registerAudioSettingsRoutes(app, wss, audioUpload, AUDIO_UPLOADS_DIR, AUDIO_CONFIG_FILE = './audio-settings.json') {
  app.get('/api/audio-settings', (_req, res) => {
    try {
      const settings = loadAudioSettings(AUDIO_CONFIG_FILE);
      res.json(settings);
    } catch (error) {
      console.error('Error getting audio settings:', error);
      res.status(500).json({ error: 'Error al cargar configuración de audio' });
    }
  });

  app.post('/api/audio-settings', audioUpload.single('audioFile'), (req, res) => {
    try {
      const { audioSource } = req.body;
      if (!audioSource || (audioSource !== 'remote' && audioSource !== 'custom')) {
        return res.status(400).json({ error: 'Invalid audio source' });
      }

      const settings = { audioSource };
      if (audioSource === 'custom' && req.file) {
        settings.hasCustomAudio = true;
        settings.audioFileName = req.file.originalname;
        settings.audioFileSize = req.file.size;
      } else if (audioSource === 'remote') {
        settings.hasCustomAudio = false;
        settings.audioFileName = null;
        settings.audioFileSize = 0;
        const customAudioPath = path.join(AUDIO_UPLOADS_DIR, 'custom-notification-audio.mp3');
        if (fs.existsSync(customAudioPath)) {
          fs.unlinkSync(customAudioPath);
        }
      }

      const success = saveAudioSettings(AUDIO_CONFIG_FILE, settings);
      if (success) {
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'audioSettingsUpdate', data: settings }));
          }
        });
        res.json({ success: true, message: 'Audio configuration successfully saved', settings });
      } else {
        res.status(500).json({ error: 'Error saving audio configuration' });
      }
    } catch (error) {
      console.error('Error saving audio settings:', error);
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'The file is too large. Maximum 1MB.' });
      }
      if (error.message === 'Only MP3 files are allowed') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/custom-audio', (_req, res) => {
    try {
      const customAudioPath = path.join(AUDIO_UPLOADS_DIR, 'custom-notification-audio.mp3');
      if (fs.existsSync(customAudioPath)) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.resolve(customAudioPath));
      } else {
        res.status(404).json({ error: 'Custom audio not found' });
      }
    } catch (error) {
      console.error('Error serving custom audio:', error);
      res.status(500).json({ error: 'Error serving custom audio' });
    }
  });
}

module.exports = registerAudioSettingsRoutes;
