const path = require('path');
const LIVEVIEWS_CONFIG_FILE = path.join(process.cwd(), 'config', 'liveviews-config.json');
const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');
const fs = require('fs');
const multer = require('multer');
const SETTINGS_FILE = path.join(process.cwd(), 'tts-settings.json');

const LastTipModule = require('./modules/last-tip');
const TipWidgetModule = require('./modules/tip-widget');
const TipGoalModule = require('./modules/tip-goal');
const ChatModule = require('./modules/chat');
const ExternalNotifications = require('./modules/external-notifications');
const LanguageConfig = require('./modules/language-config');
const GOAL_AUDIO_CONFIG_FILE = path.join(process.cwd(), 'config', 'goal-audio-settings.json');
const TIP_GOAL_CONFIG_FILE = path.join(process.cwd(), 'tip-goal-config.json');
const GOAL_AUDIO_UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'goal-audio');

const app = express();
app.post('/config/liveviews-config.json', express.json({ limit: '1mb' }), (req, res) => {
  try {
    const { bg, color, font, size, icon, claimid } = req.body;

    if (icon && icon.length > 1024 * 1024 * 1.4) {
      return res.status(400).json({ error: 'The icon is too big. Maximum size: 1MB' });
    }
    const config = { bg, color, font, size, icon, claimid };
    fs.writeFileSync(LIVEVIEWS_CONFIG_FILE, JSON.stringify(config, null, 2));
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ error: 'Error saving configuration', details: error.message });
  }
});

app.get('/config/liveviews-config.json', (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'config/liveviews-config.json'));
});

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "media-src 'self' blob: https://cdn.streamlabs.com; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "img-src 'self' data: blob: https://thumbs.odycdn.com https://thumbnails.odycdn.com https://odysee.com https://static.odycdn.com https://cdn.streamlabs.com https://twemoji.maxcdn.com; " + 
        "font-src 'self' data: blob: https://fonts.gstatic.com; " +
        "connect-src 'self' ws://" + req.get('host') + " wss://sockety.odysee.tv https://arweave.net https://api.coingecko.com https://api.telegram.org https://api.odysee.live; " +
        "frame-src 'self'"
    );

    next();
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Liftoff! Server running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ noServer: true });

const lastTip = new LastTipModule(wss);
const tipWidget = new TipWidgetModule(wss);
const chat = new ChatModule(wss);
const externalNotifications = new ExternalNotifications(wss);
const languageConfig = new LanguageConfig();

const tipGoal = new TipGoalModule(wss);

const RaffleModule = require('./modules/raffle');

const raffle = new RaffleModule(wss);

global.gettyRaffleInstance = raffle;

function setupWebSocketListeners() {
    wss.removeAllListeners('tip');
    
    wss.on('tip', (tipData) => {
        externalNotifications.handleIncomingTip(tipData).catch(error => {
            console.error('[Main] Error processing tip:', error);
        });
    });
}

setupWebSocketListeners();

function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            return {
                ttsEnabled: typeof settings.ttsEnabled === 'boolean' ? settings.ttsEnabled : true,
                ttsLanguage: settings.ttsLanguage || 'en'
            };
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
    return { ttsEnabled: true, ttsLanguage: 'en' }; // Default language
}

function saveSettings(newSettings) {
    let current = {};
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            current = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error reading settings for merge:', error);
    }
    const merged = { ...current, ...newSettings };
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

app.get('/api/tts-setting', (_req, res) => {
    const settings = loadSettings();
    res.json({ ttsEnabled: settings.ttsEnabled });
});

app.post('/api/tts-setting', express.json(), (req, res) => {
    const { ttsEnabled } = req.body;
    saveSettings({ ttsEnabled: Boolean(ttsEnabled) });
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'ttsSettingUpdate',
                data: { ttsEnabled: Boolean(ttsEnabled) }
            }));
        }
    });
    
    res.json({ 
        success: true, 
        ttsEnabled: Boolean(ttsEnabled),
        message: "TTS setting updated successfully"
    });
});

app.get('/api/tts-language', (_req, res) => {
    const settings = loadSettings();
    res.json({ ttsLanguage: settings.ttsLanguage || 'en' });
});

app.post('/api/tts-language', express.json(), (req, res) => {
    const { ttsLanguage } = req.body;
    if (!ttsLanguage || (ttsLanguage !== 'en' && ttsLanguage !== 'es')) {
        return res.status(400).json({ success: false, error: 'Invalid ttsLanguage value' });
    }
    saveSettings({ ttsLanguage });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'ttsLanguageUpdate',
                data: { ttsLanguage }
            }));
        }
    });
    res.json({ success: true, ttsLanguage, message: 'TTS language updated successfully' });
});

app.use(express.json());

app.post('/api/tts-setting', express.json(), (req, res) => {
    try {
        const { ttsEnabled } = req.body;
        
        res.json({ 
            success: true, 
            ttsEnabled: Boolean(ttsEnabled),
            message: "TTS setting updated successfully"
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: "Internal server error",
            details: error.message 
        });
    }
});

const LAST_TIP_CONFIG_FILE = path.join(process.cwd(), 'last-tip-config.json');
app.post('/api/last-tip', express.json(), (req, res) => {
  try {
    const { walletAddress, bgColor, fontColor, borderColor, amountColor, iconColor, fromColor } = req.body;
    let config = {};
    if (fs.existsSync(LAST_TIP_CONFIG_FILE)) {
      config = JSON.parse(fs.readFileSync(LAST_TIP_CONFIG_FILE, 'utf8'));
    }
    const newConfig = {
      ...config,
      bgColor: bgColor || config.bgColor || '#080c10',
      fontColor: fontColor || config.fontColor || '#ffffff',
      borderColor: borderColor || config.borderColor || '#00ff7f',
      amountColor: amountColor || config.amountColor || '#00ff7f',
      iconColor: iconColor || config.iconColor || '#ca004b',
      fromColor: fromColor || config.fromColor || '#e9e9e9',
      walletAddress: walletAddress || config.walletAddress || ''
    };
    fs.writeFileSync(LAST_TIP_CONFIG_FILE, JSON.stringify(newConfig, null, 2));
    const result = lastTip.updateWalletAddress(newConfig.walletAddress);
    res.json({
      success: true,
      ...result,
      ...newConfig
    });
  } catch (error) {
    console.error('Error updating last tip:', error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
});

const goalAudioDir = path.join(process.cwd(), 'public', 'uploads', 'goal-audio');
if (!fs.existsSync(goalAudioDir)) {
    fs.mkdirSync(goalAudioDir, { recursive: true });
}

const goalAudioStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    try {
      const files = fs.readdirSync(goalAudioDir);
      files.forEach(oldFile => {
        if (oldFile.startsWith('goal-audio')) {
          fs.unlinkSync(path.join(goalAudioDir, oldFile));
        }
      });
    } catch (error) {
      console.error('Error cleaning old audio files:', error);
    }
    
    cb(null, goalAudioDir);
  },
  filename: function (_req, file, cb) {
    const extension = path.extname(file.originalname);
    cb(null, `goal-audio${extension}`);
  }
});

const goalAudioUpload = multer({ 
  storage: goalAudioStorage,
  limits: {
    fileSize: 1024 * 1024 * 1, // 1MB limit
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

app.post('/api/tip-goal', goalAudioUpload.single('audioFile'), async (req, res) => {
  try {
    const walletAddress = req.body.walletAddress || '';
    const monthlyGoal = parseFloat(req.body.monthlyGoal || req.body.goalAmount);
    const currentAmount = parseFloat(
      req.body.currentAmount || req.body.startingAmount || req.body.currentTips || '0'
    );
    const bgColor = req.body.bgColor;
    const fontColor = req.body.fontColor;
    const borderColor = req.body.borderColor;
    const progressColor = req.body.progressColor;
    const audioSource = req.body.audioSource || 'remote';

    if (isNaN(monthlyGoal) || monthlyGoal <= 0) {
      return res.status(400).json({ error: "Valid goal amount is required" });
    }

    tipGoal.updateWalletAddress(walletAddress);
    tipGoal.monthlyGoalAR = monthlyGoal;
    tipGoal.currentTipsAR = currentAmount;

    let audioFile = null;
    if (req.file) {
      audioFile = '/uploads/goal-audio/' + req.file.filename;
    }

    const config = {
      walletAddress,
      monthlyGoal,
      currentAmount,
      bgColor: bgColor || '#080c10',
      fontColor: fontColor || '#ffffff',
      borderColor: borderColor || '#00ff7f',
      progressColor: progressColor || '#00ff7f',
      audioSource,
      ...(audioFile ? { customAudioUrl: audioFile } : {})
    };
    fs.writeFileSync(TIP_GOAL_CONFIG_FILE, JSON.stringify(config, null, 2));

    const audioSettings = {
      audioSource,
      hasCustomAudio: audioSource === 'custom' && !!req.file,
      audioFileName: req.file ? req.file.originalname : null,
      audioFileSize: req.file ? req.file.size : 0
    };
    fs.writeFileSync(GOAL_AUDIO_CONFIG_FILE, JSON.stringify(audioSettings, null, 2));

    tipGoal.sendGoalUpdate();

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'goalAudioSettingsUpdate',
          data: audioSettings
        }));
      }
    });

    res.json({
      success: true,
      active: true,
      ...config,
      ...audioSettings
    });
  } catch (error) {
    console.error('Error in /api/tip-goal:', error);
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

const CHAT_CONFIG_FILE = path.join(process.cwd(), 'chat-config.json');

app.post('/api/chat', express.json(), (req, res) => {
  try {
    const { chatUrl, odyseeWsUrl, bgColor, msgBgColor, msgBgAltColor, borderColor, textColor, usernameColor, usernameBgColor, donationColor, donationBgColor } = req.body;
    if (!chatUrl) {
      return res.status(400).json({ error: "Chat URL is required" });
    }

    let config = {};
    if (fs.existsSync(CHAT_CONFIG_FILE)) {
      config = JSON.parse(fs.readFileSync(CHAT_CONFIG_FILE, 'utf8'));
    }
    const newConfig = {
      ...config,
      chatUrl,
      odyseeWsUrl: odyseeWsUrl || config.odyseeWsUrl || '',
      bgColor: bgColor || config.bgColor || '#080c10',
      msgBgColor: msgBgColor || config.msgBgColor || '#0a0e12',
      msgBgAltColor: msgBgAltColor || config.msgBgAltColor || '#0d1114',
      borderColor: borderColor || config.borderColor || '#161b22',
      textColor: textColor || config.textColor || '#e6edf3',
      usernameColor: usernameColor || config.usernameColor || '#fff',
      usernameBgColor: usernameBgColor || config.usernameBgColor || '#11ff79',
      donationColor: donationColor || config.donationColor || '#1bdf5f',
      donationBgColor: donationBgColor || config.donationBgColor || '#ececec'
    };
    fs.writeFileSync(CHAT_CONFIG_FILE, JSON.stringify(newConfig, null, 2));
    const result = chat.updateChatUrl(chatUrl);
    res.json({
      success: true,
      ...result,
      ...newConfig
    });
  } catch (error) {
    console.error('Error updating chat:', error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
});

app.post('/api/external-notifications', async (req, res) => {
  try {
    const { discordWebhook, telegramBotToken, telegramChatId, template } = req.body;
    
    if (!discordWebhook && !(telegramBotToken && telegramChatId)) {
      return res.status(400).json({ 
        error: "Either Discord webhook or Telegram credentials are required",
        success: false
      });
    }
    
    await externalNotifications.saveConfig({
      discordWebhook,
      telegramBotToken,
      telegramChatId,
      template: template || '🎉 New tip from {from}: {amount} AR (${usd}) - "{message}"'
    });
    
    res.json({ 
      success: true, 
      status: externalNotifications.getStatus(),
      message: "Settings saved successfully"
    });
  } catch (error) {
    console.error('Error saving external notifications config:', error);
    res.status(500).json({ 
      success: false,
      error: "Internal server error",
      details: error.message 
    });
  }
});

app.get('/api/external-notifications', (_req, res) => {
  res.json(externalNotifications.getStatus());
});

app.post('/api/test-tip', (req, res) => {
  try {
    const { amount, from, message } = req.body;
    if (typeof amount === 'undefined' || typeof from === 'undefined') {
      return res.status(400).json({ error: "Both amount and from are required" });
    }
    
    const donation = {
      amount: parseFloat(amount),
      from: String(from),
      message: message || '',
      timestamp: Math.floor(Date.now() / 1000)
    };
    
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'tip', data: donation }));
      }
    });
    
    externalNotifications.handleTip({
      ...donation,
      usd: (donation.amount * 5).toFixed(2)
    });
    
    res.json({ ok: true, sent: donation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/last-donation', (_req, res) => {
  const lastDonation = lastTip.getLastDonation();
  if (lastDonation) {
    res.json(lastDonation);
  } else {
    res.status(404).json({ error: "No donation found" });
  }
});

app.get('/widgets/persistent-notifications', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/widgets/persistent-notifications.html'));
});

app.get('/obs/widgets', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  const widgets = {
    lastTip: {
      name: "Last Tip",
      url: `${baseUrl}/widgets/last-tip`,
      params: {
        position: "bottom-right",
        width: 380,
        height: 120
      }
    },
    tipGoal: {
      name: "Donation Goal",
      url: `${baseUrl}/widgets/tip-goal`,
      params: {
        position: "bottom-right",
        width: 280,
        height: 120
      }
    },
    tipNotification: {
      name: "Donation Notification",
      url: `${baseUrl}/widgets/tip-notification`,
      params: {
        position: "center",
        width: 380,
        height: 120,
        duration: 15
      }
    },
    chat: {
      name: "Live Chat",
      url: `${baseUrl}/widgets/chat`,
      params: {
        position: "top-right",
        width: 350,
        height: 500
      }
    },
    persistentNotifications: {
      name: "Persistent Notifications",
      url: `${baseUrl}/widgets/persistent-notifications`,
      params: {
        position: "top-left",
        width: 380,
        height: 500
      }
    }
  };
  
  res.json(widgets);
});

app.get('/widgets/last-tip', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/widgets/last-tip.html'));
});

app.get('/widgets/tip-goal', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/widgets/tip-goal.html'));
});

app.get('/widgets/tip-notification', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/widgets/tip-notification.html'));
});

app.get('/widgets/chat', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/widgets/chat.html'));
});

app.get('/obs-help', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/obs-integration.html'));
});

const AUDIO_CONFIG_FILE = './audio-settings.json';
const AUDIO_UPLOADS_DIR = './public/uploads/audio';

if (!fs.existsSync('./public/uploads')) {
  fs.mkdirSync('./public/uploads', { recursive: true });
}
if (!fs.existsSync(AUDIO_UPLOADS_DIR)) {
  fs.mkdirSync(AUDIO_UPLOADS_DIR, { recursive: true });
}

const audioStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, AUDIO_UPLOADS_DIR);
  },
  filename: function (_req, _file, cb) {
    const uniqueName = 'custom-notification-audio.mp3';
    cb(null, uniqueName);
  }
});

const audioUpload = multer({
  storage: audioStorage,
  limits: {
    fileSize: 1024 * 1024
  },
  fileFilter: function (_req, file, cb) {
    if (file.mimetype === 'audio/mpeg' || file.originalname.toLowerCase().endsWith('.mp3')) {
      cb(null, true);
    } else {
      cb(new Error('Only MP3 files are allowed'));
    }
  }
});

function loadAudioSettings() {
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

function saveAudioSettings(newSettings) {
  try {
    const current = loadAudioSettings();
    const merged = { ...current, ...newSettings };
    fs.writeFileSync(AUDIO_CONFIG_FILE, JSON.stringify(merged, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving audio settings:', error);
    return false;
  }
}

app.get('/api/audio-settings', (_req, res) => {
  try {
    const settings = loadAudioSettings();
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

    let settings = {
      audioSource: audioSource
    };

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

    const success = saveAudioSettings(settings);
    
    if (success) {
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'audioSettingsUpdate',
            data: settings
          }));
        }
      });
      
      res.json({ 
        success: true, 
        message: 'Audio configuration successfully saved',
        settings: settings
      });
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


app.use(express.static('public'));

const raffleImageUpload = multer({ dest: './public/uploads/raffle/' });

app.get('/api/raffle/settings', (_req, res) => {
  try {
    const settings = raffle.getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error in GET /api/raffle/settings:', error);
    res.status(500).json({ error: 'Error getting raffle settings', details: error.message });
  }
});

app.get('/api/raffle/state', (_req, res) => {
  try {
    const state = raffle.getPublicState();
    res.json(state);
  } catch (error) {
    console.error('Error in GET /api/raffle/state:', error);
    res.status(500).json({ error: 'Error getting raffle state', details: error.message });
  }
});

app.post('/api/raffle/settings', express.json(), (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, error: 'No data provided' });
    }

    const settings = {
      command: req.body.command ? String(req.body.command).trim() : 'sorteo',
      prize: req.body.prize ? String(req.body.prize).trim() : '',
      duration: req.body.duration ? parseInt(req.body.duration) : 5,
      maxWinners: req.body.maxWinners ? parseInt(req.body.maxWinners) : 1,
      enabled: req.body.enabled === true || req.body.enabled === 'true' || req.body.enabled === 1 || req.body.enabled === '1',
      mode: req.body.mode || 'manual',
      interval: req.body.interval ? parseInt(req.body.interval) : 5,
      imageUrl: req.body.imageUrl || ''
    };

    if (!settings.command) {
      return res.status(400).json({ success: false, error: 'Command is required' });
    }
    if (!settings.prize) {
      return res.status(400).json({ success: false, error: 'Prize is required' });
    }
    if (isNaN(settings.duration) || settings.duration <= 0) {
      return res.status(400).json({ success: false, error: 'Duration must be a positive number' });
    }
    if (isNaN(settings.maxWinners) || settings.maxWinners <= 0) {
      return res.status(400).json({ success: false, error: 'Max winners must be a positive number' });
    }

    raffle.saveSettings(settings);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/raffle/settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/raffle/start', (_req, res) => {
  try {
    raffle.start();
    broadcastRaffleState();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/raffle/stop', (_req, res) => {
  try {
    raffle.stop();
    broadcastRaffleState();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/raffle/pause', (_req, res) => {
  try {
    raffle.pause();
    broadcastRaffleState();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/raffle/resume', (_req, res) => {
  try {
    raffle.resume();
    broadcastRaffleState();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/raffle/draw', (_req, res) => {
  try {
    const winner = raffle.drawWinner();
    broadcastRaffleWinner(winner);
    broadcastRaffleState();
    res.json({ success: true, winner });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/raffle/reset', (_req, res) => {
  try {
    raffle.resetWinners();
    broadcastRaffleState();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/raffle/upload-image', raffleImageUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const imageUrl = `/uploads/raffle/${req.file.filename}`;

  raffle.imageUrl = imageUrl;
  raffle.saveSettingsToFile();
  res.json({ imageUrl });
});

function broadcastRaffleState() {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'raffle_state', ...raffle.getPublicState() }));
    }
  });
}
function broadcastRaffleWinner(winner) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'raffle_winner', winner }));
    }
  });
}

app.get('/api/modules', (_req, res) => {
  let tipGoalColors = {};
  if (fs.existsSync(TIP_GOAL_CONFIG_FILE)) {
    tipGoalColors = JSON.parse(fs.readFileSync(TIP_GOAL_CONFIG_FILE, 'utf8'));
  }
  let lastTipColors = {};
  if (fs.existsSync(LAST_TIP_CONFIG_FILE)) {
    lastTipColors = JSON.parse(fs.readFileSync(LAST_TIP_CONFIG_FILE, 'utf8'));
  }
  let chatColors = {};
  if (fs.existsSync(CHAT_CONFIG_FILE)) {
    chatColors = JSON.parse(fs.readFileSync(CHAT_CONFIG_FILE, 'utf8'));
  }
  // Ensure odyseeWsUrl is included in chat config
  res.json({
    lastTip: { ...lastTip.getStatus(), ...lastTipColors },
    tipWidget: tipWidget.getStatus(),
    tipGoal: { ...tipGoal.getStatus(), ...tipGoalColors },
    chat: { ...chat.getStatus(), ...chatColors },
    externalNotifications: externalNotifications.getStatus()
  });
});

app.get('/api/ar-price', async (_req, res) => {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd');
    if (response.status !== 200) throw new Error('Failed to fetch from CoinGecko');
    res.json({ arweave: { usd: response.data.arweave.usd } });
  } catch (error) {
    console.error('Error fetching AR price:', error);
    res.status(500).json({ error: 'Failed to fetch AR price' });
  }
});

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, ws => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'init',
    data: {
      lastTip: lastTip.getLastDonation(),
      tipGoal: tipGoal.getGoalProgress(),
      persistentTips: externalNotifications.getStatus().lastTips,
      raffle: raffle.getPublicState()
    }
  }));

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'get_raffle_state') {
        ws.send(JSON.stringify({ type: 'raffle_state', ...raffle.getPublicState() }));
      }

    } catch (error) {
      console.error('Error parsing message from client:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

app.post('/api/test-discord', express.json(), async (req, res) => {
  try {
    const { from, amount } = req.body;
    const success = await externalNotifications.sendToDiscord({
      from: from || "test-user",
      amount: amount || 1,
      message: "Test notification",
      source: "test",
      timestamp: new Date().toISOString()
    });
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/language', (_req, res) => {
  try {
    const currentLanguage = languageConfig.getLanguage();
    const availableLanguages = languageConfig.getAvailableLanguages();
    res.json({ 
      currentLanguage, 
      availableLanguages 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/language', express.json(), (req, res) => {
  try {
    const { language } = req.body;
    if (!language || !languageConfig.getAvailableLanguages().includes(language)) {
      return res.status(400).json({ error: 'Invalid language' });
    }
    
    const success = languageConfig.setLanguage(language);
    if (success) {
      res.json({ success: true, language });
    } else {
      res.status(500).json({ error: 'Failed to save language setting' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/test-donation', express.json(), (req, res) => {
    try {
        const { amount = 5.00, from = 'TestUser', message = 'Test donation!' } = req.body;
        
        // console.log('🧪 Test donation received:', { amount, from, message });
        
        const donationData = {
            type: 'donation',
            amount: parseFloat(amount),
            from: from,
            message: message,
            timestamp: new Date().toISOString()
        };
        
        wss.clients.forEach(client => {
            if (client.readyState === client.OPEN) {
                client.send(JSON.stringify(donationData));
            }
        });
        
        res.json({
            success: true,
            message: 'Test donation sent successfully',
            data: donationData
        });
        
    } catch (error) {
        console.error('Error sending test donation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send test donation',
            details: error.message
        });
    }
});

if (!fs.existsSync(GOAL_AUDIO_UPLOADS_DIR)) {
    fs.mkdirSync(GOAL_AUDIO_UPLOADS_DIR, { recursive: true });
}

function loadGoalAudioSettings() {
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

function saveGoalAudioSettings(newSettings) {
    try {
        const current = loadGoalAudioSettings();
        const merged = { ...current, ...newSettings };
        fs.writeFileSync(GOAL_AUDIO_CONFIG_FILE, JSON.stringify(merged, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving goal audio settings:', error);
        return false;
    }
}

function calculateFileHash(filePath) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        return require('crypto').createHash('md5').update(fileBuffer).digest('hex');
    } catch (error) {
        console.error('Error calculating file hash:', error);
        return Date.now().toString();
    }
}

app.get('/api/goal-audio', (req, res) => {
    try {
        const audioDir = path.join(__dirname, 'public/uploads/goal-audio');
        const files = fs.readdirSync(audioDir);
        const audioFile = files.find(file => file.startsWith('goal-audio'));
        
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

app.get('/api/goal-audio-settings', (_req, res) => {
  try {
      if (fs.existsSync(GOAL_AUDIO_CONFIG_FILE)) {
          const settings = JSON.parse(fs.readFileSync(GOAL_AUDIO_CONFIG_FILE, 'utf8'));
          res.json(settings);
      } else {
          res.json({ audioSource: 'remote', hasCustomAudio: false });
      }
  } catch (error) {
      console.error('Error loading goal audio settings:', error);
      res.status(500).json({ error: 'Error loading settings' });
  }
});

app.delete('/api/goal-audio-settings', (_req, res) => {
  try {
      const audioPath = path.join(GOAL_AUDIO_UPLOADS_DIR, 'custom-goal-notification.mp3');
      if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
      }
      
      saveGoalAudioSettings({
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

app.post('/api/tip-goal', goalAudioUpload.single('audioFile'), async (req, res) => {
  try {
      const goalAmount = parseFloat(req.body.goalAmount);
      const startingAmount = parseFloat(req.body.startingAmount) || 0;
      const bgColor = req.body.bgColor;
      const fontColor = req.body.fontColor;
      const borderColor = req.body.borderColor;
      const progressColor = req.body.progressColor;
      const audioSource = req.body.audioSource || 'remote';

      if (isNaN(goalAmount)) {
          return res.status(400).json({ error: "Valid goal amount is required" });
      }

      const configPath = path.join(__dirname, TIP_GOAL_CONFIG_FILE);
      let config = {};
      
      if (fs.existsSync(configPath)) {
          config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
      
      const newConfig = {
          ...config,
          bgColor: bgColor || config.bgColor || '#080c10',
          fontColor: fontColor || config.fontColor || '#ffffff',
          borderColor: borderColor || config.borderColor || '#00ff7f',
          progressColor: progressColor || config.progressColor || '#00ff7f'
      };

      fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));

      const audioSettings = {
          audioSource: audioSource,
          hasCustomAudio: false,
          audioFileName: null,
          audioFileSize: 0
      };

      if (audioSource === 'custom' && req.file) {
          audioSettings.hasCustomAudio = true;
          audioSettings.audioFileName = req.file.originalname;
          audioSettings.audioFileSize = req.file.size;
      }

      const audioConfigPath = path.join(__dirname, GOAL_AUDIO_CONFIG_FILE);
      fs.writeFileSync(audioConfigPath, JSON.stringify(audioSettings, null, 2));

      const result = tipGoal.updateGoal(goalAmount, startingAmount);
      
      wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                  type: 'goalAudioSettingsUpdate',
                  data: audioSettings
              }));
          }
      });

      res.json({
          success: true,
          active: true,
          ...result,
          ...newConfig,
          ...audioSettings
      });

  } catch (error) {
      console.error('Error in /api/tip-goal:', error);
      res.status(500).json({ 
          error: "Internal server error",
          details: error.message 
      });
  }
});

app.get('/api/goal-custom-audio', (_req, res) => {
    try {
        const customAudioPath = path.join(GOAL_AUDIO_UPLOADS_DIR, 'custom-goal-notification.mp3');
        
        if (fs.existsSync(customAudioPath)) {
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Cache-Control', 'no-cache');
            res.sendFile(path.resolve(customAudioPath));
        } else {
            res.status(404).json({ error: 'Custom goal audio not found' });
        }
    } catch (error) {
        console.error('Error serving custom goal audio:', error);
        res.status(500).json({ error: 'Error serving custom goal audio' });
    }
});

app.get('/api/status', (_req, res) => {
  try {
    res.json({
      success: true,
      lastTip: 'OK',
      tipWidget: 'OK',
      tipGoal: 'OK',
      chat: 'OK'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/save-liveviews-label', express.json(), (req, res) => {
  const { viewersLabel } = req.body;
  if (typeof viewersLabel !== 'string' || !viewersLabel.trim()) {
    return res.status(400).json({ error: 'Invalid label' });
  }
  const configPath = path.join(__dirname, 'config', 'liveviews-config.json');
  fs.readFile(configPath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'The configuration file could not be read' });
    let config;
    try {
      config = JSON.parse(data);
    } catch (e) {
      return res.status(500).json({ error: 'Invalid JSON Config' });
    }
    config.viewersLabel = viewersLabel;
    fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8', (err) => {
      if (err) return res.status(500).json({ error: 'The label could not be saved.' });
      res.json({ success: true });
    });
  });
});
