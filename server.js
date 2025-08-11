const path = require('path');
require('dotenv').config();
const LIVEVIEWS_CONFIG_FILE = path.join(process.cwd(), 'config', 'liveviews-config.json');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const axios = require('axios');
const fs = require('fs');
const multer = require('multer');
const { z } = require('zod');
const SETTINGS_FILE = path.join(process.cwd(), 'tts-settings.json');
const OBS_WS_CONFIG_FILE = path.join(__dirname, 'config', 'obs-ws-config.json');

const LastTipModule = require('./modules/last-tip');
const TipWidgetModule = require('./modules/tip-widget');
const { TipGoalModule } = require('./modules/tip-goal');
const ChatModule = require('./modules/chat');
const ExternalNotifications = require('./modules/external-notifications');
const LanguageConfig = require('./modules/language-config');
const registerTtsRoutes = require('./routes/tts');
const registerLanguageRoutes = require('./routes/language');
const SocialMediaModule = require('./modules/socialmedia');
const socialMediaModule = new SocialMediaModule();
const registerChatRoutes = require('./routes/chat');
const registerExternalNotificationsRoutes = require('./routes/external-notifications');
const registerAudioSettingsRoutes = require('./routes/audio-settings');
const registerGoalAudioRoutes = require('./routes/goal-audio');
const registerTipGoalRoutes = require('./routes/tip-goal');
const registerRaffleRoutes = require('./routes/raffle');
const registerSocialMediaRoutes = require('./routes/socialmedia');
const registerLastTipRoutes = require('./routes/last-tip');
const registerObsRoutes = require('./routes/obs');
const registerLiveviewsRoutes = require('./routes/liveviews');
const registerTipNotificationGifRoutes = require('./routes/tip-notification-gif');

const GOAL_AUDIO_CONFIG_FILE = path.join(process.cwd(), 'config', 'goal-audio-settings.json');
const TIP_GOAL_CONFIG_FILE = path.join(process.cwd(), 'config', 'tip-goal-config.json');
const LAST_TIP_CONFIG_FILE = path.join(process.cwd(), 'last-tip-config.json');
const GOAL_AUDIO_UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'goal-audio');
const CHAT_CONFIG_FILE = path.join(process.cwd(), 'config', 'chat-config.json');

const app = express();

try { app.use(helmet({ contentSecurityPolicy: false })); } catch {}
try { if (process.env.NODE_ENV !== 'test') app.use(morgan('dev')); } catch {}

const limiter = rateLimit ? rateLimit({ windowMs: 60_000, max: 60 }) : ((req,res,next)=>next());
const strictLimiter = rateLimit ? rateLimit({ windowMs: 60_000, max: 10 }) : ((req,res,next)=>next());

app.use(compression());

function getLiveviewsConfigWithDefaults(partial) {
  return {
    bg: typeof partial.bg === 'string' && partial.bg.trim() ? partial.bg : '#fff',
    color: typeof partial.color === 'string' && partial.color.trim() ? partial.color : '#222',
    font: typeof partial.font === 'string' && partial.font.trim() ? partial.font : 'Arial',
    size: typeof partial.size === 'string' && partial.size.trim() ? partial.size : '32',
    icon: typeof partial.icon === 'string' ? partial.icon : '',
    claimid: typeof partial.claimid === 'string' ? partial.claimid : '',
    viewersLabel: typeof partial.viewersLabel === 'string' && partial.viewersLabel.trim() ? partial.viewersLabel : 'viewers'
  };
}

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "media-src 'self' blob: https://cdn.streamlabs.com; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "img-src 'self' data: blob: https://thumbs.odycdn.com https://thumbnails.odycdn.com https://odysee.com https://static.odycdn.com https://cdn.streamlabs.com https://twemoji.maxcdn.com https://spee.ch; " + 
        "font-src 'self' data: blob: https://fonts.gstatic.com; " +
        "connect-src 'self' ws://" + req.get('host') + " wss://sockety.odysee.tv https://arweave.net https://api.coingecko.com https://api.telegram.org https://api.odysee.live; " +
        "frame-src 'self'"
    );

    next();
});

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.sendStatus(204);
  }
  next();
});

app.use((req, _res, next) => {
  try {
    const isApi = req.path && req.path.startsWith('/api/');
    const isSafeMethod = req.method === 'GET' || req.method === 'HEAD';
    if (isApi && isSafeMethod && req.path.length > 5 && req.path.endsWith('/')) {
      const trimmedPath = req.path.replace(/\/+$/, '');
      const query = req.url.slice(req.path.length);
      req.url = trimmedPath + query;
    }
  } catch {}
  next();
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

registerChatRoutes(app, chat, limiter, CHAT_CONFIG_FILE);

if (process.env.NODE_ENV !== 'test') {
  try {
    if (fs.existsSync(CHAT_CONFIG_FILE)) {
      const chatConfig = JSON.parse(fs.readFileSync(CHAT_CONFIG_FILE, 'utf8'));
      if (chatConfig.chatUrl && typeof chatConfig.chatUrl === 'string' && chatConfig.chatUrl.startsWith('wss://')) {
        chat.updateChatUrl(chatConfig.chatUrl);
      }
    }
  } catch (e) {
    console.error('Error loading chat config for auto-activation:', e);
  }
}

registerTtsRoutes(app, wss, limiter);
registerLiveviewsRoutes(app, strictLimiter);
registerSocialMediaRoutes(app, socialMediaModule, strictLimiter);

registerLastTipRoutes(app, lastTip, tipWidget);
if (!fs.existsSync(GOAL_AUDIO_UPLOADS_DIR)) {
    fs.mkdirSync(GOAL_AUDIO_UPLOADS_DIR, { recursive: true });
}

const goalAudioStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {

    try {
      const files = fs.readdirSync(GOAL_AUDIO_UPLOADS_DIR);
      files.forEach(oldFile => {
        if (oldFile.startsWith('goal-audio')) {
          fs.unlinkSync(path.join(GOAL_AUDIO_UPLOADS_DIR, oldFile));
        }
      });
    } catch (error) {
      console.error('Error cleaning old audio files:', error);
    }
    cb(null, GOAL_AUDIO_UPLOADS_DIR);
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

registerTipGoalRoutes(app, strictLimiter, goalAudioUpload, tipGoal, wss, TIP_GOAL_CONFIG_FILE, GOAL_AUDIO_CONFIG_FILE);

registerExternalNotificationsRoutes(app, externalNotifications, strictLimiter);
registerTipNotificationGifRoutes(app, strictLimiter);

app.post('/api/test-tip', limiter, (req, res) => {
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

app.get('/widgets/socialmedia', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/widgets/socialmedia.html'));
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

registerAudioSettingsRoutes(app, wss, audioUpload, AUDIO_UPLOADS_DIR, AUDIO_CONFIG_FILE);


app.use(express.static('public', {
  etag: true,
  lastModified: true,
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

registerRaffleRoutes(app, raffle, wss);

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

  res.json({
    lastTip: { ...lastTip.getStatus(), ...lastTipColors },
    tipWidget: tipWidget.getStatus(),
    tipGoal: { ...tipGoal.getStatus(), ...tipGoalColors },
    chat: { ...chat.getStatus(), ...chatColors },
    externalNotifications: (() => {
      const st = externalNotifications.getStatus();

      return {
        active: !!st.active,
        lastTips: st.lastTips,
        config: {
          hasDiscord: !!st.config?.hasDiscord,
          hasTelegram: !!st.config?.hasTelegram,
          template: st.config?.template || ''
        },
        lastUpdated: st.lastUpdated
      };
    })()
  });
});

let __lastArPrice = null; let __lastArPriceAt = 0;
app.get('/api/ar-price', async (_req, res) => {
  try {
    const now = Date.now();
    if (__lastArPrice && now - __lastArPriceAt < 60_000) {
      return res.json({ arweave: { usd: __lastArPrice } });
    }
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd');
    if (response.status !== 200 || !response.data?.arweave?.usd) throw new Error('Failed to fetch from CoinGecko');
    __lastArPrice = response.data.arweave.usd; __lastArPriceAt = now;
    res.json({ arweave: { usd: __lastArPrice } });
  } catch (error) {
    console.error('Error fetching AR price:', error.message);
    if (__lastArPrice) return res.json({ arweave: { usd: __lastArPrice } });
    res.status(500).json({ error: 'Failed to fetch AR price' });
  }
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/readyz', (_req, res) => res.json({ ok: true }));

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
    if (process.env.NODE_ENV !== 'test') {
      console.log('WebSocket connection closed');
    }
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

registerLanguageRoutes(app, languageConfig);

app.post('/api/test-donation', express.json(), (req, res) => {
    try {
        const { amount = 5.00, from = 'TestUser', message = 'Test donation!' } = req.body;

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

registerGoalAudioRoutes(app, strictLimiter, GOAL_AUDIO_UPLOADS_DIR);

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

app.post('/api/save-liveviews-label', strictLimiter, express.json(), (req, res) => {
  const { viewersLabel } = req.body;
  if (typeof viewersLabel !== 'string' || !viewersLabel.trim()) {
    return res.status(400).json({ error: 'Invalid label' });
  }
  const configPath = path.join(__dirname, 'config', 'liveviews-config.json');
  fs.readFile(configPath, 'utf8', (err, data) => {
    let config;
    if (err) {

      config = {
        bg: '#fff',
        color: '#222',
        font: 'Arial',
        size: 32,
        icon: '',
        claimid: '',
        viewersLabel
      };
    } else {
      try {
        config = JSON.parse(data);
        if (typeof config !== 'object' || config === null) config = {};
      } catch (e) {
        
        config = {
          bg: '#fff',
          color: '#222',
          font: 'Arial',
          size: 32,
          icon: '',
          claimid: '',
          viewersLabel
        };
      }
      config.viewersLabel = viewersLabel;
    }
    fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8', (err) => {
      if (err) return res.status(500).json({ error: 'The label could not be saved.' });
      res.json({ success: true });
    });
  });
});

let obsWsConfig = { ip: '', port: '', password: '' };
if (fs.existsSync(OBS_WS_CONFIG_FILE)) {
  try {
    obsWsConfig = JSON.parse(fs.readFileSync(OBS_WS_CONFIG_FILE, 'utf8'));
  } catch (e) {
    console.error('Error loading OBS WebSocket config:', e);
  }
}

const { OBSWebSocket } = require('obs-websocket-js');
const obs = new OBSWebSocket();

async function connectOBS() {
  try {
    if (obsWsConfig.ip && obsWsConfig.port) {
      await obs.connect(`ws://${obsWsConfig.ip}:${obsWsConfig.port}`, obsWsConfig.password);
      console.log('Connected to OBS WebSocket');
    }
  } catch (error) {
    console.error('Error connecting to OBS:', error);
  }
}

if (process.env.NODE_ENV !== 'test') {
  connectOBS();
}

registerObsRoutes(app, strictLimiter, obsWsConfig, OBS_WS_CONFIG_FILE, connectOBS);

app.use((req, res) => {
  console.warn('404 Not Found:', { method: req.method, url: req.originalUrl });
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`🚀 Liftoff! Server running on http://localhost:${PORT}`);
  });

  server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req);
    });
  });
}

module.exports = app;

if (process.env.NODE_ENV === 'test') {
  const http = require('http');
  app.startTestServer = function startTestServer(port = 0) {
    return new Promise(resolve => {
      const server = http.createServer(app);
      server.on('upgrade', (req, socket, head) => {
        wss.handleUpgrade(req, socket, head, ws => {
          wss.emit('connection', ws, req);
        });
      });
      server.listen(port, () => resolve(server));
    });
  };
  app.getWss = () => wss;
}
