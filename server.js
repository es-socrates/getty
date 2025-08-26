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
const registerAnnouncementRoutes = require('./routes/announcement');

const GOAL_AUDIO_CONFIG_FILE = path.join(process.cwd(), 'config', 'goal-audio-settings.json');
const TIP_GOAL_CONFIG_FILE = path.join(process.cwd(), 'config', 'tip-goal-config.json');
const LAST_TIP_CONFIG_FILE = path.join(process.cwd(), 'config', 'last-tip-config.json');
const GOAL_AUDIO_UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'goal-audio');
const CHAT_CONFIG_FILE = path.join(process.cwd(), 'config', 'chat-config.json');

const app = express();
const cookieParser = require('cookie-parser');
const { NamespacedStore } = require('./lib/store');

let redisClient = null;
try {
  if (process.env.REDIS_URL) {
    const Redis = require('ioredis');
    redisClient = new Redis(process.env.REDIS_URL);
  }
} catch {}
const store = new NamespacedStore({ redis: redisClient, ttlSeconds: parseInt(process.env.SESSION_TTL_SECONDS || '259200', 10) });

try { app.use(helmet({ contentSecurityPolicy: false })); } catch {}
try { if (process.env.NODE_ENV !== 'test') app.use(morgan('dev')); } catch {}

const limiter = rateLimit ? rateLimit({ windowMs: 60_000, max: 60 }) : ((_req,_res,next)=>next());
const strictLimiter = rateLimit ? rateLimit({ windowMs: 60_000, max: 10 }) : ((_req,_res,next)=>next());
const announcementLimiters = {
  config: rateLimit ? rateLimit({ windowMs: 60_000, max: 20 }) : ((_req,_res,next)=>next()),
  message: rateLimit ? rateLimit({ windowMs: 60_000, max: 30 }) : ((_req,_res,next)=>next()),
  favicon: rateLimit ? rateLimit({ windowMs: 60_000, max: 60 }) : ((_req,_res,next)=>next())
};

app.use(compression());

const __activityLog = [];
const __MAX_ACTIVITY = 500;
function __pushActivity(level, pieces) {
  try {
    const msg = pieces
      .map(p => {
        if (typeof p === 'string') return p;
        try { return JSON.stringify(p); } catch { return String(p); }
      })
      .join(' ');
    __activityLog.push({ ts: new Date().toISOString(), level, message: msg });
    if (__activityLog.length > __MAX_ACTIVITY) __activityLog.shift();
  } catch {}
}

try {
  if (process.env.NODE_ENV !== 'test') {
    const __orig = {
      log: console.log.bind(console),
      info: console.info ? console.info.bind(console) : console.log.bind(console),
      warn: console.warn ? console.warn.bind(console) : console.log.bind(console),
      error: console.error ? console.error.bind(console) : console.log.bind(console)
    };
    console.log = (...args) => { __pushActivity('info', args); __orig.log(...args); };
    console.info = (...args) => { __pushActivity('info', args); __orig.info(...args); };
    console.warn = (...args) => { __pushActivity('warn', args); __orig.warn(...args); };
    console.error = (...args) => { __pushActivity('error', args); __orig.error(...args); };
  }
} catch {}

let __requestTimestamps = [];
app.use((_req, _res, next) => {
  try {
    const now = Date.now();
    __requestTimestamps.push(now);

    const cutoff = now - 60 * 60 * 1000;
    if (__requestTimestamps.length > 10000) {
      __requestTimestamps = __requestTimestamps.filter(t => t >= cutoff);
    } else {

      while (__requestTimestamps.length && __requestTimestamps[0] < cutoff) __requestTimestamps.shift();
    }
  } catch {}
  next();
});

let __bytesEvents = [];
app.use((_req, res, next) => {
  try {
    let bytes = 0;
    const _write = res.write;
    const _end = res.end;
    res.write = function (chunk, encoding, cb) {
      try {
        if (chunk) bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
      } catch {}
      return _write.call(this, chunk, encoding, cb);
    };
    res.end = function (chunk, encoding, cb) {
      try {
        if (chunk) bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
        const now = Date.now();
        __bytesEvents.push({ ts: now, bytes });
        const cutoff = now - 60 * 60 * 1000;
        while (__bytesEvents.length && __bytesEvents[0].ts < cutoff) __bytesEvents.shift();
      } catch {}
      return _end.call(this, chunk, encoding, cb);
    };
  } catch {}
  next();
});

let __arPriceCache = { usd: 0, ts: 0, source: 'none' };
const __AR_PRICE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchArUsdFromProviders() {

  try {
    const bz = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=ARUSDT', { timeout: 5000 });
    if (bz.data?.price) return { usd: Number(bz.data.price), source: 'binance' };
  } catch {}

  try {
    const okx = await axios.get('https://www.okx.com/api/v5/market/ticker?instId=AR-USDT', { timeout: 5000 });
    const last = okx.data?.data?.[0]?.last;
    if (last) return { usd: Number(last), source: 'okx' };
  } catch {}

  try {
    const kc = await axios.get('https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=AR-USDT', { timeout: 5000 });
    const price = kc.data?.data?.price;
    if (price) return { usd: Number(price), source: 'kucoin' };
  } catch {}

  try {
    const gt = await axios.get('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=AR_USDT', { timeout: 5000 });
    const last = Array.isArray(gt.data) && gt.data[0]?.last;
    if (last) return { usd: Number(last), source: 'gateio' };
  } catch {}

  try {
    const cc = await axios.get('https://api.coincap.io/v2/assets/arweave', { timeout: 5000 });
    const usd = cc.data?.data?.priceUsd;
    if (usd) return { usd: Number(usd), source: 'coincap' };
  } catch {}

  try {
    const cp = await axios.get('https://api.coinpaprika.com/v1/tickers/ar-arweave', { timeout: 5000 });
    const usd = cp.data?.quotes?.USD?.price;
    if (usd) return { usd: Number(usd), source: 'coinpaprika' };
  } catch {}

  try {
    const cg = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd', { timeout: 5000 });
    if (cg.data?.arweave?.usd) return { usd: Number(cg.data.arweave.usd), source: 'coingecko' };
  } catch {}
  return null;
}

async function getArUsdCached(force = false) {
  const now = Date.now();
  if (!force && __arPriceCache.usd > 0 && (now - __arPriceCache.ts) < __AR_PRICE_TTL_MS) {
    return __arPriceCache;
  }
  const result = await fetchArUsdFromProviders();
  if (result && isFinite(result.usd) && result.usd > 0) {
    __arPriceCache = { usd: result.usd, ts: now, source: result.source };
  } else if (__arPriceCache.usd === 0) {
    __arPriceCache = { usd: 5, ts: now, source: 'fallback' };
  }
  return __arPriceCache;
}

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
app.use(cookieParser());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const host = req.get('host');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "media-src 'self' blob: https://cdn.streamlabs.com https://arweave.net https://*.arweave.net; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "img-src 'self' data: blob: https://thumbs.odycdn.com https://thumbnails.odycdn.com https://odysee.com https://static.odycdn.com https://cdn.streamlabs.com https://twemoji.maxcdn.com https://spee.ch; " + 
      "font-src 'self' data: blob: https://fonts.gstatic.com; " +
      `connect-src 'self' ws://${host} wss://${host} wss://sockety.odysee.tv https://arweave.net https://*.arweave.net https://ar-io.net https://arweave.live https://arweave-search.goldsky.com https://permagate.io https://zerosettle.online https://zigza.xyz https://ario-gateway.nethermind.dev https://api.binance.com https://www.okx.com https://api.kucoin.com https://api.gateio.ws https://api.coincap.io https://api.coinpaprika.com https://api.coingecko.com https://api.viewblock.io https://api.telegram.org https://api.odysee.live; ` +
      "frame-src 'self'"
    );
  } catch {
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' ws: wss:;");
  }

    next();
});

app.get('/favicon.ico', (_req, res) => {
  const iconPath = path.join(__dirname, 'public', 'favicon.ico');
  try {
    if (fs.existsSync(iconPath)) {
      try { res.set('Cache-Control', 'public, max-age=86400, immutable'); } catch {}
      return res.sendFile(iconPath);
    }
  } catch {}
  try { res.set('Cache-Control', 'public, max-age=86400, immutable'); } catch {}
  return res.status(204).end();
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

app.use((req, res, next) => {
  try {
    const p = req.path || '';
    if (!p) return next();
    const cleaned = p.replace(/\/+$/, '');
    const looksEncodedAbsolute = cleaned.startsWith('/https%3A') || cleaned.startsWith('/http%3A') || /%3A%2F%2F/i.test(cleaned) || /^\/https?:\/\//i.test(cleaned);
    if (looksEncodedAbsolute) {
      let decoded = '';
      try { decoded = decodeURIComponent(cleaned.slice(1)); } catch {}
      console.warn('Malformed absolute URL path received', {
        originalUrl: req.originalUrl,
        decoded,
        referer: req.get('referer') || req.get('referrer') || '',
        ua: req.get('user-agent') || ''
      });
      return res.status(400).json({ error: 'absolute_url_misrouted', decoded: decoded || null, referer: req.get('referer') || req.get('referrer') || null });
    }
  } catch {}
  next();
});

const wss = new WebSocket.Server({ noServer: true });

const lastTip = new LastTipModule(wss);
const tipWidget = new TipWidgetModule(wss);
const chat = new ChatModule(wss);
const { AnnouncementModule } = require('./modules/announcement');
const announcementModule = new AnnouncementModule(wss);
const externalNotifications = new ExternalNotifications(wss);
const languageConfig = new LanguageConfig();

const tipGoal = new TipGoalModule(wss);

const RaffleModule = require('./modules/raffle');

const raffle = new RaffleModule(wss);

global.gettyRaffleInstance = raffle;

const ADMIN_COOKIE = 'getty_admin_token';
const PUBLIC_COOKIE = 'getty_public_token';
const SECURE_COOKIE = () => (process.env.NODE_ENV === 'production');

function attachNamespace(req, _res, next) {
  const adminToken = req.headers['x-getty-admin-token'] || req.cookies[ADMIN_COOKIE] || req.query.admin_token;
  const publicToken = req.headers['x-getty-public-token'] || req.cookies[PUBLIC_COOKIE] || req.query.token;
  req.ns = {
    admin: typeof adminToken === 'string' ? adminToken : null,
    pub: typeof publicToken === 'string' ? publicToken : null
  };

  if (!req.ns.pub && req.ns.admin) req.ns.pub = req.ns.admin;
  next();
}
app.use(attachNamespace);

app.get('/new-session', async (_req, res) => {
  try {
    const adminToken = NamespacedStore.genToken(24);
    const publicToken = NamespacedStore.genToken(18);
    await store.set(adminToken, 'meta', { createdAt: Date.now(), role: 'admin' });
    await store.set(publicToken, 'meta', { createdAt: Date.now(), role: 'public', parent: adminToken });

    await store.set(adminToken, 'publicToken', publicToken);
    await store.set(publicToken, 'adminToken', adminToken);

    const cookieOpts = {
      httpOnly: true,
      sameSite: 'Strict',
      secure: SECURE_COOKIE(),
      path: '/',
      maxAge: parseInt(process.env.SESSION_TTL_SECONDS || '259200', 10) * 1000
    };
    res.cookie(ADMIN_COOKIE, adminToken, cookieOpts);
    res.cookie(PUBLIC_COOKIE, publicToken, cookieOpts);

    const target = '/admin/';

    return res.status(200).send(`<!doctype html><meta http-equiv="refresh" content="0; url=${target}">`);
  } catch {
    return res.status(500).json({ error: 'failed_to_create_session' });
  }
});

app.get('/api/ar-price', async (_req, res) => {
  try {
    const data = await getArUsdCached(false);
    res.json({ arweave: { usd: data.usd }, source: data.source, ts: data.ts });
  } catch {
    res.status(500).json({ error: 'failed_to_fetch_price' });
  }
});

async function resolveAdminNsFromReq(req) {
  try {
    if (!store) return null;
    if (req.ns?.admin) return req.ns.admin;
    if (req.ns?.pub) {
      const admin = await store.get(req.ns.pub, 'adminToken', null);
      return typeof admin === 'string' && admin ? admin : null;
    }
  } catch {}
  return null;
}

app.post('/api/session/regenerate-public', async (req, res) => {
  try {
    const adminNs = await resolveAdminNsFromReq(req);
    if (!store || !adminNs) return res.status(400).json({ error: 'no_admin_session' });
    const newPub = NamespacedStore.genToken(18);
    await store.set(adminNs, 'publicToken', newPub);
    await store.set(newPub, 'adminToken', adminNs);
    await store.set(newPub, 'meta', { createdAt: Date.now(), role: 'public', parent: adminNs });

    const cookieOpts = {
      httpOnly: true,
      sameSite: 'Strict',
      secure: SECURE_COOKIE(),
      path: '/',
      maxAge: parseInt(process.env.SESSION_TTL_SECONDS || '259200', 10) * 1000
    };
    res.cookie(PUBLIC_COOKIE, newPub, cookieOpts);
    res.json({ ok: true, publicToken: newPub });
  } catch (e) {
    res.status(500).json({ error: 'failed_to_regenerate', details: e?.message });
  }
});

app.get('/api/session/status', async (req, res) => {
  try {
    const supported = !!process.env.REDIS_URL;
    const adminNs = await resolveAdminNsFromReq(req);
    const active = !!adminNs;
    res.json({ supported, active });
  } catch (e) {
    res.status(500).json({ error: 'failed_to_check_session', details: e?.message });
  }
});

app.get('/api/session/export', async (req, res) => {
  try {
    const adminNs = await resolveAdminNsFromReq(req);
    const useStore = !!(store && adminNs);
    const exportObj = {};

    if (useStore) {
      exportObj.ttsSettings = await store.get(adminNs, 'tts-settings', null);
      exportObj.chatConfig = await store.get(adminNs, 'chat-config', null);
    } else {
      try { exportObj.ttsSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch { exportObj.ttsSettings = null; }
      try { exportObj.chatConfig = JSON.parse(fs.readFileSync(CHAT_CONFIG_FILE, 'utf8')); } catch { exportObj.chatConfig = null; }
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="getty-config-${new Date().toISOString().replace(/[:.]/g,'-')}.json"`);
    res.end(JSON.stringify(exportObj, null, 2));
  } catch (e) {
    res.status(500).json({ error: 'failed_to_export', details: e?.message });
  }
});

registerChatRoutes(app, chat, limiter, CHAT_CONFIG_FILE, { store });

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

registerTtsRoutes(app, wss, limiter, { store });
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
registerAnnouncementRoutes(app, announcementModule, announcementLimiters);

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
  try { __recordTip({ amount: donation.amount, usd: (donation.amount * 5).toFixed(2), timestamp: Date.now(), source: 'test' }); } catch {}
    
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
    },
    announcement: {
      name: "Announcements",
      url: `${baseUrl}/widgets/announcement`,
      params: { position: "top-center", width: 600, height: 200, duration: 10 }
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
app.get('/widgets/announcement', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/widgets/announcement.html'));
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

const __serverStartTime = Date.now();

const __tipEvents = [];
function __recordTip(evt) {
  try {
    if (!evt) return;
    const ts = evt.timestamp ? (typeof evt.timestamp === 'number' ? evt.timestamp : Date.parse(evt.timestamp)) : Date.now();
    const amount = typeof evt.amount === 'number' ? evt.amount : parseFloat(evt.amount);
    const usd = evt.usd ? (typeof evt.usd === 'number' ? evt.usd : parseFloat(evt.usd)) : undefined;
    if (isNaN(amount)) return;
    __tipEvents.push({ ts: ts || Date.now(), ar: amount, usd: isNaN(usd) ? undefined : usd });

    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    while (__tipEvents.length && __tipEvents[0].ts < cutoff) __tipEvents.shift();
  } catch {}
}

try {
  const __origEmit = wss.emit.bind(wss);
  wss.emit = (eventName, ...args) => {
    try { if (eventName === 'tip' && args[0]) __recordTip(args[0]); } catch {}
    return __origEmit(eventName, ...args);
  };
} catch {}

app.get('/api/activity', (req, res) => {
  try {
    const level = typeof req.query.level === 'string' ? req.query.level : '';
    const order = req.query.order === 'asc' ? 'asc' : 'desc';
    const all = String(req.query.limit || '').toLowerCase() === 'all';
    const totalItems = level ? __activityLog.filter(i => i.level === level).length : __activityLog.length;
    const max = __MAX_ACTIVITY;
    const rawLimit = all ? totalItems : Math.min(parseInt(req.query.limit, 10) || 100, max);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    let items = level ? __activityLog.filter(i => i.level === level) : __activityLog.slice();
    const total = items.length;
    let out = [];
    if (order === 'asc') {
      out = items.slice(offset, offset + rawLimit);
    } else {
      const start = Math.max(total - offset - rawLimit, 0);
      const end = Math.max(total - offset, 0);
      out = items.slice(start, end).reverse();
    }
    res.json({ items: out, total });
  } catch {
    res.status(500).json({ error: 'Failed to read activity log' });
  }
});

app.post('/api/activity/clear', strictLimiter, (_req, res) => {
  try {
    __activityLog.length = 0;
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to clear activity log' });
  }
});

app.get('/api/activity/export', (req, res) => {
  try {
    const level = typeof req.query.level === 'string' ? req.query.level : '';
    const items = level ? __activityLog.filter(i => i.level === level) : __activityLog;
    const filename = `activity-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(JSON.stringify(items, null, 2));
  } catch {
    res.status(500).json({ error: 'Failed to export activity log' });
  }
});

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

  const uptimeSeconds = Math.floor((Date.now() - __serverStartTime) / 1000);
  const wsClients = (() => {
    try { return Array.from(wss.clients).filter(c=>c && c.readyState === 1).length; } catch { return 0; }
  })();

  res.json({
    lastTip: { ...lastTip.getStatus(), ...lastTipColors },
    tipWidget: tipWidget.getStatus(),
    tipGoal: { ...tipGoal.getStatus(), ...tipGoalColors },
    chat: { ...chat.getStatus(), ...chatColors },
    announcement: (() => {
      try {
        const mod = announcementModule;
        const cfg = mod.getPublicConfig();
        const enabledMessages = cfg.messages.filter(m=>m.enabled).length;
        return {
          active: enabledMessages > 0,
          totalMessages: cfg.messages.length,
          enabledMessages,
          cooldownSeconds: cfg.cooldownSeconds
        };
      } catch { return { active: false, totalMessages: 0, enabledMessages: 0 }; }
    })(),
    socialmedia: (() => {
      try {
        const cfg = socialMediaModule.loadConfig();
        const count = Array.isArray(cfg) ? cfg.length : (cfg && typeof cfg === 'object' ? Object.keys(cfg).length : 0);
        return { configured: count > 0, entries: count };
      } catch { return { configured: false, entries: 0 }; }
    })(),
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
    })(),
    liveviews: (() => {
      try {
        if (fs.existsSync(LIVEVIEWS_CONFIG_FILE)) {
          const raw = JSON.parse(fs.readFileSync(LIVEVIEWS_CONFIG_FILE, 'utf8'));
          const full = getLiveviewsConfigWithDefaults(raw || {});
          const active = !!(full.claimid || full.icon || full.viewersLabel);
          return {
            active,
            claimid: full.claimid,
            viewersLabel: full.viewersLabel
          };
        }
        return { active: false };
      } catch { return { active: false }; }
    })(),
    raffle: (() => {
      try {
        const st = raffle.getPublicState();
        return {
          active: !!st.active,
            paused: !!st.paused,
            participants: st.participants || [],
            totalWinners: st.totalWinners || 0
        };
      } catch { return { active: false, participants: [] }; }
    })(),
    system: {
      uptimeSeconds,
      wsClients,
      env: process.env.NODE_ENV || 'development'
    }
  });
});

app.get('/api/metrics', async (_req, res) => {
  try {
    const now = Date.now();
    const mem = process.memoryUsage();
    const wsClients = (() => {
      try { return Array.from(wss.clients).filter(c=>c && c.readyState === 1).length; } catch { return 0; }
    })();

    const oneMin = now - 60 * 1000;
    const fiveMin = now - 5 * 60 * 1000;
    const hour = now - 60 * 60 * 1000;
    const rpm = __requestTimestamps.filter(t => t >= oneMin).length;
    const r5m = __requestTimestamps.filter(t => t >= fiveMin).length;
    const r1h = __requestTimestamps.filter(t => t >= hour).length;

  const bytes1m = __bytesEvents.filter(e => e.ts >= oneMin).reduce((a,b)=>a+b.bytes,0);
  const bytes5m = __bytesEvents.filter(e => e.ts >= fiveMin).reduce((a,b)=>a+b.bytes,0);
  const bytes1h = __bytesEvents.filter(e => e.ts >= hour).reduce((a,b)=>a+b.bytes,0);

  const history = (typeof chat.getHistory === 'function') ? chat.getHistory() : [];
  const toTs = m => {
    try {
      let ts = typeof m.timestamp === 'number' ? m.timestamp : new Date(m.timestamp).getTime();

      if (ts && ts < 1e12) ts = ts * 1000;
      return ts || 0;
    } catch { return 0; }
  };
  const chat1m = history.filter(m => toTs(m) >= oneMin).length;
  const chat5m = history.filter(m => toTs(m) >= fiveMin).length;
  const chat1h = history.filter(m => toTs(m) >= hour).length;

  const tips = externalNotifications.getStatus().lastTips || [];
  const parseNum = v => (typeof v === 'number' ? v : parseFloat(v)) || 0;
  const tipsSessionAR = tips.reduce((acc, t) => acc + parseNum(t.amount), 0);
  const tipsSessionUSD = tips.reduce((acc, t) => acc + parseNum(t.usd), 0);
  const tipGoalStatus = tipGoal.getStatus();

  const tip1m = __tipEvents.filter(e => e.ts >= oneMin);
  const tip5m = __tipEvents.filter(e => e.ts >= fiveMin);
  const tip1h = __tipEvents.filter(e => e.ts >= hour);
  const day = now - 24 * 60 * 60 * 1000;
  const week = now - 7 * 24 * 60 * 60 * 1000;
  const month = now - 30 * 24 * 60 * 60 * 1000;
  const year = now - 365 * 24 * 60 * 60 * 1000;
  const tip1d = __tipEvents.filter(e => e.ts >= day);
  const tip1w = __tipEvents.filter(e => e.ts >= week);
  const tip1mo = __tipEvents.filter(e => e.ts >= month);
  const tip1y = __tipEvents.filter(e => e.ts >= year);
  const sumAr = arr => arr.reduce((a,b)=>a+(b.ar||0),0);
  const sumUsd = arr => arr.reduce((a,b)=>a+(b.usd||0),0);

    let liveviews = { live: false, viewerCount: 0 };
    try {
      if (fs.existsSync(LIVEVIEWS_CONFIG_FILE)) {
        const raw = JSON.parse(fs.readFileSync(LIVEVIEWS_CONFIG_FILE, 'utf8'));
        const cfg = getLiveviewsConfigWithDefaults(raw || {});
        if (cfg.claimid) {
          const url = `https://api.odysee.live/livestream/is_live?channel_claim_id=${encodeURIComponent(cfg.claimid)}`;
          const resp = await axios.get(url, { timeout: 3000 });
          const data = resp.data && resp.data.data ? resp.data.data : {};
          liveviews.live = !!data.Live;
          liveviews.viewerCount = typeof data.ViewerCount === 'number' ? data.ViewerCount : 0;
        }
      }
    } catch {}

    res.json({
      system: {
        uptimeSeconds: Math.floor((now - __serverStartTime) / 1000),
        wsClients,
        memory: {
          rssMB: +(mem.rss / (1024*1024)).toFixed(1),
          heapUsedMB: +(mem.heapUsed / (1024*1024)).toFixed(1),
          heapTotalMB: +(mem.heapTotal / (1024*1024)).toFixed(1)
        },
        requests: { perMin: rpm, last5m: r5m, lastHour: r1h }
      },
      bandwidth: {
        bytes: {
          perMin: bytes1m,
          last5m: bytes5m,
          lastHour: bytes1h
        },
        human: {
          perMin: `${(bytes1m/1024).toFixed(1)} KB`,
          last5m: `${(bytes5m/1024).toFixed(1)} KB`,
          lastHour: `${(bytes1h/1024/1024).toFixed(2)} MB`
        }
      },
      chat: {
        connected: !!chat.getStatus?.().connected,
        historySize: history.length,
        perMin: chat1m,
        last5m: chat5m,
        lastHour: chat1h
      },
      tips: {
        session: { ar: +tipsSessionAR.toFixed(2), usd: +tipsSessionUSD.toFixed(2), count: tips.length },
        monthly: {
          goalAR: tipGoalStatus.monthlyGoal || tipGoalStatus.monthlyGoalAR || 0,
          currentAR: tipGoalStatus.currentTips || tipGoalStatus.currentTipsAR || 0,
          progress: tipGoalStatus.progress || 0,
          usdValue: tipGoalStatus.usdValue ? parseFloat(tipGoalStatus.usdValue) : undefined
        },
        rate: {
          perMin: { count: tip1m.length, ar: +sumAr(tip1m).toFixed(2), usd: +sumUsd(tip1m).toFixed(2) },
          last5m: { count: tip5m.length, ar: +sumAr(tip5m).toFixed(2), usd: +sumUsd(tip5m).toFixed(2) },
          lastHour:{ count: tip1h.length, ar: +sumAr(tip1h).toFixed(2), usd: +sumUsd(tip1h).toFixed(2) }
        },
        window: {
          last24h: { count: tip1d.length, ar: +sumAr(tip1d).toFixed(2), usd: +sumUsd(tip1d).toFixed(2) },
          last7d:  { count: tip1w.length, ar: +sumAr(tip1w).toFixed(2), usd: +sumUsd(tip1w).toFixed(2) },
          last30d: { count: tip1mo.length, ar: +sumAr(tip1mo).toFixed(2), usd: +sumUsd(tip1mo).toFixed(2) },
          last365d:{ count: tip1y.length, ar: +sumAr(tip1y).toFixed(2), usd: +sumUsd(tip1y).toFixed(2) }
        }
      },
      liveviews
    });
  } catch {
    res.status(500).json({ error: 'Failed to compute metrics' });
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
  } catch {
        
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

try {
  const adminDist = path.join(__dirname, 'public', 'admin-dist');
  if (fs.existsSync(adminDist)) {
    app.use('/admin', express.static(adminDist, { index: 'index.html' }));
    app.get('/admin/*', (_req, res, next) => {
      const indexPath = path.join(adminDist, 'index.html');
      if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
      next();
    });
  } else {
    app.get(['/admin','/admin/*'], (_req, res) => {
      res.status(503).send('Admin UI not built. Run "npm run admin:build" to generate the SPA.');
    });
  }
} catch {}

app.get(['/admin.html','/admin.html/'], (_req, res) => {
  res.redirect(301, '/admin/');
});

app.get(/^\/admin(?:\/.*)?$/, (req, res, next) => {
  try {
    const adminDist = path.join(__dirname, 'public', 'admin-dist');
    const indexPath = path.join(adminDist, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }

    return res.status(503).send('Admin UI not built. Run "npm run admin:build".');
  } catch (e) {
    return next(e);
  }
});

app.use((req, res) => {
  console.warn('404 Not Found:', { method: req.method, url: req.originalUrl });
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Liftoff! Server running on port ${PORT}`);
  });

  function parseCookieHeader(cookieHeader) {
    const out = {};
    if (typeof cookieHeader !== 'string' || !cookieHeader) return out;
    cookieHeader.split(';').forEach(p => {
      const idx = p.indexOf('=');
      if (idx > -1) {
        const k = p.slice(0, idx).trim();
        const v = p.slice(idx + 1).trim();
        if (k) out[k] = decodeURIComponent(v);
      }
    });
    return out;
  }

  // Broadcast helper with optional namespace filter
  wss.broadcast = function(nsToken, payload) {
    try {
      const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
      wss.clients.forEach(client => {
        if (client && client.readyState === 1) {
          if (nsToken && client.nsToken && client.nsToken !== nsToken) return;
          client.send(data);
        }
      });
    } catch (e) { console.error('broadcast error', e); }
  };

  server.on('upgrade', (req, socket, head) => {
    try {
      const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0] || 'http';
      const url = new URL(req.url || '/', `${proto}://${req.headers.host}`);
      let nsToken = url.searchParams.get('token') || '';
      if (!nsToken && req.headers.cookie) {
        const cookies = parseCookieHeader(req.headers.cookie);
        nsToken = cookies['getty_public_token'] || cookies['getty_admin_token'] || '';
      }
      wss.handleUpgrade(req, socket, head, ws => {
        ws.nsToken = nsToken || null;
        wss.emit('connection', ws, req);
      });
  } catch {
      try { socket.destroy(); } catch {}
    }
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
  app.getAnnouncementModule = () => announcementModule;
  app.disposeGetty = () => {
    try { if (lastTip.dispose) lastTip.dispose(); } catch {}
    try { if (tipWidget.dispose) tipWidget.dispose(); } catch {}
    try { if (chat.dispose) chat.dispose(); } catch {}
    try { if (announcementModule.dispose) announcementModule.dispose(); } catch {}
    try { if (externalNotifications.dispose) externalNotifications.dispose(); } catch {}
    try { if (tipGoal.dispose) tipGoal.dispose(); } catch {}
    try { if (raffle.dispose) raffle.dispose(); } catch {}
    try { wss.clients.forEach(c=>{ try { c.terminate(); } catch {} }); } catch {}
    try { wss.close(); } catch {}
  };
}
