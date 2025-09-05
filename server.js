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
const ChatNsManager = require('./modules/chat-ns');
const registerAudioSettingsRoutes = require('./routes/audio-settings');
const ExternalNotifications = require('./modules/external-notifications');
const LanguageConfig = require('./modules/language-config');
const registerTtsRoutes = require('./routes/tts');
const registerLanguageRoutes = require('./routes/language');
const SocialMediaModule = require('./modules/socialmedia');
const socialMediaModule = new SocialMediaModule();
const registerChatRoutes = require('./routes/chat');
const registerExternalNotificationsRoutes = require('./routes/external-notifications');
const registerGoalAudioRoutes = require('./routes/goal-audio');
const registerTipGoalRoutes = require('./routes/tip-goal');
const registerRaffleRoutes = require('./routes/raffle');
const registerSocialMediaRoutes = require('./routes/socialmedia');
const registerLastTipRoutes = require('./routes/last-tip');
const registerObsRoutes = require('./routes/obs');
const registerLiveviewsRoutes = require('./routes/liveviews');
const registerStreamHistoryRoutes = require('./routes/stream-history');
const registerTipNotificationGifRoutes = require('./routes/tip-notification-gif');
const registerAnnouncementRoutes = require('./routes/announcement');
const { AnnouncementModule } = require('./modules/announcement');
const RaffleModule = require('./modules/raffle');

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
try { app.set('store', store); } catch {}

try { app.use(helmet({ contentSecurityPolicy: false })); } catch {}

try {
  const isProd = process.env.NODE_ENV === 'production';
  const cspFlag = process.env.GETTY_ENABLE_CSP;
  const enableCsp = (cspFlag === '1') || (typeof cspFlag === 'undefined' && isProd);
  if (enableCsp) {
    const self = "'self'";
    const unsafeEval = isProd ? [] : ["'unsafe-eval'"];
    const splitEnv = (k) => (process.env[k] || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const connectExtra = splitEnv('GETTY_CSP_CONNECT_EXTRA');
    const scriptExtra = splitEnv('GETTY_CSP_SCRIPT_EXTRA');
    const imgExtra = splitEnv('GETTY_CSP_IMG_EXTRA');
    const mediaExtra = splitEnv('GETTY_CSP_MEDIA_EXTRA');
    const scriptHashes = splitEnv('GETTY_CSP_SCRIPT_HASHES');
    const allowUnsafeHashes = process.env.GETTY_CSP_UNSAFE_HASHES === '1';
    const scriptAttr = (process.env.GETTY_CSP_SCRIPT_ATTR || '').trim();

    const cspDirectives = {
      defaultSrc: [self],
      scriptSrc: [
        self,
        "'unsafe-inline'",
        ...(allowUnsafeHashes ? ["'unsafe-hashes'"] : []),
        ...unsafeEval,
        ...scriptExtra,
        ...scriptHashes
      ],
      styleSrc: [self, "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: [
        self, 'data:', 'blob:',
        'https://thumbs.odycdn.com', 'https://thumbnails.odycdn.com',
        'https://odysee.com', 'https://static.odycdn.com',
        'https://twemoji.maxcdn.com', 'https://spee.ch',
        'https://arweave.net', 'https://*.arweave.net',
        ...imgExtra
      ],
      fontSrc: [self, 'data:', 'blob:', 'https://fonts.gstatic.com'],
      mediaSrc: [self, 'blob:', 'https://arweave.net', 'https://*.arweave.net', ...mediaExtra],
      connectSrc: [self, 'ws:', 'wss:', ...connectExtra],
      frameSrc: [self]
    };

    if (scriptAttr) {
      const parts = scriptAttr.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length) cspDirectives.scriptSrcAttr = parts;
    }

    app.use(helmet.contentSecurityPolicy({ useDefaults: true, directives: cspDirectives }));
  }
} catch {}
try { app.set('trust proxy', 1); } catch {}
try { app.use(express.json({ limit: '1mb' })); } catch {}
try { app.use(express.urlencoded({ extended: true, limit: '1mb' })); } catch {}
try { app.use(cookieParser()); } catch {}
try { app.use(compression()); } catch {}
try { if (process.env.NODE_ENV !== 'test') app.use(morgan('dev')); } catch {}

try {
  app.use((req, res, next) => {
    try {
      if (req.path && req.path.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
      }
    } catch {}
    next();
  });
} catch {}

const ADMIN_COOKIE = 'getty_admin_token';
const PUBLIC_COOKIE = 'getty_public_token';
const SECURE_COOKIE = () => (process.env.COOKIE_SECURE === '1' || process.env.NODE_ENV === 'production');

app.use(async (req, res, next) => {
  try {
    let nsAdmin = req.cookies?.[ADMIN_COOKIE] || null;
    let nsPub = req.cookies?.[PUBLIC_COOKIE] || null;

    const auth = typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
    let bearerToken = '';
    try {
      if (auth) {
        const [scheme, value] = auth.split(' ');
        if (scheme && /^Bearer$/i.test(scheme) && value) bearerToken = value.trim();
      }
    } catch {}

    const qToken = (typeof req.query?.token === 'string' && req.query.token.trim()) ? req.query.token.trim() : '';
    const incomingToken = qToken || bearerToken;

    if (incomingToken) {
      nsPub = incomingToken;
      try {
        if (store) {
          const adm = await store.get(incomingToken, 'adminToken', null);
          if (adm) nsAdmin = adm;
        }
      } catch {}
    } else if (!nsAdmin && nsPub && store) {

      try {
        const adm = await store.get(nsPub, 'adminToken', null);
        if (adm) nsAdmin = adm;
      } catch {}
    }

    req.ns = { admin: nsAdmin || null, pub: nsPub || null };

    try {
      if (incomingToken) {
        const cookieOpts = {
          httpOnly: true,
          sameSite: 'Lax',
          secure: SECURE_COOKIE(),
          path: '/',
          maxAge: parseInt(process.env.SESSION_TTL_SECONDS || '259200', 10) * 1000
        };
        res.cookie(PUBLIC_COOKIE, incomingToken, cookieOpts);
        if (nsAdmin) res.cookie(ADMIN_COOKIE, nsAdmin, cookieOpts);
      }
    } catch {}
  } catch { req.ns = { admin: null, pub: null }; }
  next();
});

const __requestTimestamps = [];
const __bytesEvents = [];
const __activityLog = [];
const __moduleUptime = {};
const __MAX_ACTIVITY = 2000;
app.use((req, res, next) => {
  try { __requestTimestamps.push(Date.now()); if (__requestTimestamps.length > 50000) __requestTimestamps.splice(0, __requestTimestamps.length - 50000); } catch {}
  const start = Date.now();
  const orig = res.end;
  res.end = function(chunk, encoding, cb) {
    try {
      const bytes = chunk ? (Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk), encoding || 'utf8')) : 0;
      __bytesEvents.push({ ts: Date.now(), bytes });
      if (__bytesEvents.length > 50000) __bytesEvents.splice(0, __bytesEvents.length - 50000);
    } catch {}
    return orig.call(this, chunk, encoding, cb);
  };
  try {
    const entry = { ts: start, level: 'info', method: req.method, url: req.originalUrl, message: `${req.method} ${req.originalUrl}` };
    __activityLog.push(entry);
    if (__activityLog.length > __MAX_ACTIVITY) __activityLog.splice(0, __activityLog.length - __MAX_ACTIVITY);
    res.on('finish', () => {
      try {
        entry.status = res.statusCode;
        entry.durationMs = Date.now() - start;
        if (typeof entry.message === 'string') {
          entry.message = `${req.method} ${req.originalUrl} -> ${res.statusCode} in ${entry.durationMs}ms`;
        }
      } catch {}
    });
  } catch {}
  next();
});

const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
const strictLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });

const wss = new WebSocket.Server({ noServer: true });

let __arPriceCache = { usd: 0, ts: 0, source: 'none' };
async function getArUsdCached(_force = false) {
  try {
    if (process.env.NODE_ENV === 'test') return { usd: 0, ts: Date.now(), source: 'test' };
    const now = Date.now();
    if (!__arPriceCache.usd || (now - __arPriceCache.ts) > 10 * 60 * 1000) {
      __arPriceCache = { usd: 5, ts: now, source: 'fallback' };
    }
    return __arPriceCache;
  } catch { return { usd: 0, ts: Date.now(), source: 'error' }; }
}

function getLiveviewsConfigWithDefaults(partial) {
  return {
    bg: typeof partial?.bg === 'string' && partial.bg.trim() ? partial.bg : '#fff',
    color: typeof partial?.color === 'string' && partial.color.trim() ? partial.color : '#222',
    font: typeof partial?.font === 'string' && partial.font.trim() ? partial.font : 'Arial',
    size: typeof partial?.size === 'string' && partial.size.trim() ? partial.size : '32',
    icon: typeof partial?.icon === 'string' ? partial.icon : '',
    claimid: typeof partial?.claimid === 'string' ? partial.claimid : '',
    viewersLabel: typeof partial?.viewersLabel === 'string' && partial.viewersLabel.trim() ? partial.viewersLabel : 'viewers'
  };
}

const languageConfig = new LanguageConfig();
const wssBound = wss;
const lastTip = new LastTipModule(wssBound);
const tipWidget = new TipWidgetModule(wssBound);
const tipGoal = new TipGoalModule(wssBound);
const externalNotifications = new ExternalNotifications(wssBound);
const raffle = new RaffleModule(wssBound);

try { global.gettyRaffleInstance = raffle; } catch {}
const announcementModule = new AnnouncementModule(wssBound);
const chat = new ChatModule(wssBound);
const chatNs = new ChatNsManager(wssBound, store);

const announcementLimiters = { config: (_req,_res,next)=>next(), message: (_req,_res,next)=>next(), favicon: (_req,_res,next)=>next() };

app.get('/api/ar-price', async (_req, res) => {
  try {
    const data = await getArUsdCached(false);
    res.json({ arweave: { usd: data.usd }, source: data.source, ts: data.ts });
  } catch {
    res.status(500).json({ error: 'failed_to_fetch_price' });
  }
});
const __hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
if (!__hostedMode) try {
  const DATA_DIR = path.join(process.cwd(), 'data');
  const DATA_FILE = path.join(DATA_DIR, 'stream-history.json');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  let lastLive = null;
  let lastClaimId = '';
  async function recordHistoryEvent(isLive) {
    try {
      const hist = (function load() {
        try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return { segments: [], samples: [] }; }
      })();
      const now = Date.now();
      const last = hist.segments[hist.segments.length - 1];
      if (isLive) {
        if (!(last && !last.end)) {
          hist.segments.push({ start: now, end: null });
        }
      } else {
        if (last && !last.end) {
          last.end = now;
        }
      }

      try {
        const cutoff = Date.now() - 400 * 86400000;
        hist.segments = hist.segments.filter(s => (s.end || s.start) >= cutoff);
        if (!Array.isArray(hist.samples)) hist.samples = [];
        hist.samples = hist.samples.filter(s => s.ts >= cutoff);
        if (hist.samples.length > 200000) hist.samples.splice(0, hist.samples.length - 200000);
      } catch {}
      fs.writeFileSync(DATA_FILE, JSON.stringify(hist, null, 2));
    } catch {}
  }

  async function checkLiveOnce() {
    try {
      const shCfgPath = path.join(process.cwd(), 'config', 'stream-history-config.json');
      let claim = '';
      try {
        if (fs.existsSync(shCfgPath)) {
          const c = JSON.parse(fs.readFileSync(shCfgPath, 'utf8'));
          if (typeof c.claimid === 'string' && c.claimid.trim()) claim = c.claimid.trim();
        }
      } catch {}
      if (!claim) {
        try {
          const lv = fs.existsSync(LIVEVIEWS_CONFIG_FILE) ? JSON.parse(fs.readFileSync(LIVEVIEWS_CONFIG_FILE, 'utf8')) : {};
          if (typeof lv.claimid === 'string' && lv.claimid.trim()) claim = lv.claimid.trim();
        } catch {}
      }
      if (!claim) return;

      if (claim !== lastClaimId) {
        lastClaimId = claim;
        lastLive = null;
      }
      const url = `https://api.odysee.live/livestream/is_live?channel_claim_id=${encodeURIComponent(claim)}`;
      const resp = await axios.get(url, { timeout: 7000 });
      const nowLive = !!resp?.data?.data?.Live;
      const viewerCount = typeof resp?.data?.data?.ViewerCount === 'number' ? resp.data.data.ViewerCount : 0;

      try {
        const hist = (function load() {
          try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return { segments: [], samples: [] }; }
        })();
        const seg = hist.segments && hist.segments[hist.segments.length - 1];
        const isOpen = !!(seg && !seg.end);
        if (nowLive && !isOpen) await recordHistoryEvent(true);
        if (!nowLive && isOpen) await recordHistoryEvent(false);
      } catch {}

      if (lastLive === null) {
        if (nowLive) await recordHistoryEvent(true);
        lastLive = nowLive;
      } else if (nowLive !== lastLive) {
        const prev = lastLive;
        await recordHistoryEvent(nowLive);

        try {
          if (nowLive === true && prev === false) {
            const cfgPath = path.join(process.cwd(), 'config', 'live-announcement-config.json');
            let draft = null;
            try { if (fs.existsSync(cfgPath)) draft = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
            if (draft && draft.auto) {
              const payload = {
                title: typeof draft.title === 'string' ? draft.title : undefined,
                description: typeof draft.description === 'string' ? draft.description : undefined,
                channelUrl: typeof draft.channelUrl === 'string' ? draft.channelUrl : undefined,
                signature: typeof draft.signature === 'string' ? draft.signature : undefined,
                discordWebhook: typeof draft.discordWebhook === 'string' ? draft.discordWebhook : undefined
              };
              Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });

              try {
                const statusCfg = (typeof externalNotifications?.getStatus === 'function') ? (externalNotifications.getStatus().config || {}) : {};
                const cfg = {
                  ...statusCfg,
                  liveDiscordWebhook: externalNotifications?.liveDiscordWebhook || '',
                  liveTelegramBotToken: externalNotifications?.liveTelegramBotToken || '',
                  liveTelegramChatId: externalNotifications?.liveTelegramChatId || ''
                };
                const hasAny = !!(cfg.liveDiscordWebhook || (cfg.liveTelegramBotToken && cfg.liveTelegramChatId) || payload.discordWebhook);
                if (hasAny) {
                  try { await externalNotifications.sendLiveWithConfig(cfg, payload); } catch {}
                }
              } catch {}
            }
          }
        } catch {}
        lastLive = nowLive;
      }

      try {
        const hist = (function load() {
          try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return { segments: [], samples: [] }; }
        })();

        try {
          const lastSeg = hist.segments && hist.segments[hist.segments.length - 1];
          const lastSample = Array.isArray(hist.samples) && hist.samples.length ? hist.samples[hist.samples.length - 1] : null;
          const lastTs = lastSample ? Number(lastSample.ts || 0) : 0;
          const FRESH_MS = 150000;
          const isStale = !lastTs || (Date.now() - lastTs) > FRESH_MS;
          if (lastSeg && !lastSeg.end && isStale) {
            const closeAt = lastTs > 0 ? lastTs : (Date.now() - FRESH_MS);
            if (typeof lastSeg.start === 'number' && closeAt >= lastSeg.start) {
              lastSeg.end = closeAt;
            }
          }
        } catch {}
        if (!Array.isArray(hist.samples)) hist.samples = [];
        hist.samples.push({ ts: Date.now(), live: nowLive, viewers: viewerCount });
        const cutoff = Date.now() - 400 * 86400000;
        hist.samples = hist.samples.filter(s => s.ts >= cutoff);
        if (hist.samples.length > 200000) hist.samples.splice(0, hist.samples.length - 200000);
        fs.writeFileSync(DATA_FILE, JSON.stringify(hist, null, 2));
      } catch {}
    } catch {}
  }

  if (process.env.NODE_ENV !== 'test') {
    [2000, 8000, 20000].forEach(d => setTimeout(() => { checkLiveOnce(); }, d));
    setInterval(() => { checkLiveOnce(); }, 30000);
  }
} catch {}

try {
  if (__hostedMode && store && store.redis && process.env.NODE_ENV !== 'test') {
    const AUTO_SET = 'getty:auto-live:namespaces';
    const LAST_STATE_KEY = 'getty:auto-live:laststate';
    const LAST_POLL_KEY = 'getty:auto-live:lastpoll';
    const POLL_MS = 30000;
    const jitter = () => Math.floor(Math.random() * 5000);

    async function loadNsDraft(ns) {
      try { return await store.get(ns, 'live-announcement-draft', null); } catch { return null; }
    }
    async function loadNsExtCfg(ns) {
      try { return await store.get(ns, 'external-notifications-config', null); } catch { return null; }
    }
    async function loadNsClaim(ns) {
      try {
        const sh = await store.get(ns, 'stream-history-config', null);
        if (sh && typeof sh.claimid === 'string' && sh.claimid.trim()) return sh.claimid.trim();
      } catch {}
      try {
        const lv = await store.get(ns, 'liveviews-config', null);
        if (lv && typeof lv.claimid === 'string' && lv.claimid.trim()) return lv.claimid.trim();
      } catch {}
      return '';
    }
    async function getLastState() {
      try { const j = await store.redis.get(LAST_STATE_KEY); return j ? JSON.parse(j) : {}; } catch { return {}; }
    }
    async function setLastState(obj) {
      try { await store.redis.set(LAST_STATE_KEY, JSON.stringify(obj), 'EX', 24 * 3600); } catch {}
    }

    async function pollHostedOnce() {
      try {
        const nsList = await store.redis.smembers(AUTO_SET);
        if (!Array.isArray(nsList) || nsList.length === 0) return;
        const lastState = await getLastState();
        for (const ns of nsList) {
          try {

            const draft = await loadNsDraft(ns);
            if (!draft || !draft.auto) {
              try { await store.redis.srem(AUTO_SET, ns); } catch {}
              continue;
            }
            const claim = await loadNsClaim(ns);
            if (!claim) {
              console.warn('[auto-live] ns has auto enabled but no ClaimID configured', ns);
              continue;
            }
            const url = `https://api.odysee.live/livestream/is_live?channel_claim_id=${encodeURIComponent(claim)}`;
            const resp = await axios.get(url, { timeout: 7000 });
            const nowLive = !!resp?.data?.data?.Live;
            const prev = !!lastState[ns];
            lastState[ns] = nowLive;
            try { await store.redis.hset(LAST_POLL_KEY, ns, String(Date.now())); await store.redis.expire(LAST_POLL_KEY, 24 * 3600); } catch {}
            if (nowLive && !prev) {

              const payload = {
                title: typeof draft.title === 'string' ? draft.title : undefined,
                description: typeof draft.description === 'string' ? draft.description : undefined,
                channelUrl: typeof draft.channelUrl === 'string' ? draft.channelUrl : undefined,
                signature: typeof draft.signature === 'string' ? draft.signature : undefined,
                discordWebhook: typeof draft.discordWebhook === 'string' ? draft.discordWebhook : undefined,
                livePostClaimId: typeof draft.livePostClaimId === 'string' ? draft.livePostClaimId : undefined
              };
              Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });

              let cfg = await loadNsExtCfg(ns);
              if (!cfg || typeof cfg !== 'object') cfg = {};
              cfg = {
                ...cfg,
                liveDiscordWebhook: externalNotifications?.liveDiscordWebhook || cfg.liveDiscordWebhook || '',
                liveTelegramBotToken: externalNotifications?.liveTelegramBotToken || cfg.liveTelegramBotToken || '',
                liveTelegramChatId: externalNotifications?.liveTelegramChatId || cfg.liveTelegramChatId || ''
              };
              const hasAny = !!(cfg.liveDiscordWebhook || (cfg.liveTelegramBotToken && cfg.liveTelegramChatId) || payload.discordWebhook);
              console.info('[auto-live] transition offline->live detected', { ns, claim, hasAny, hasDiscord: !!cfg.liveDiscordWebhook || !!payload.discordWebhook, hasTelegram: !!(cfg.liveTelegramBotToken && cfg.liveTelegramChatId) });
              if (hasAny) {
                try {
                  const sent = await externalNotifications.sendLiveWithConfig(cfg, payload);
                  if (!sent) console.warn('[auto-live] sendLiveWithConfig returned false for ns', ns);
                } catch (e) {
                  console.error('[auto-live] send failed for ns', ns, e?.message || e);
                }
              } else {
                console.warn('[auto-live] no live targets configured for ns', ns);
              }
            }
          } catch {}
        }
        await setLastState(lastState);
      } catch {}
    }

    setTimeout(() => { pollHostedOnce(); }, 5000 + jitter());
    setInterval(() => { pollHostedOnce(); }, POLL_MS + jitter());
  }
} catch {}

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
      sameSite: 'Lax',
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

app.get(['/new-session', '/api/session/new'], async (req, res) => {
  try {
    if (!store) return res.status(501).json({ error: 'namespaced_sessions_disabled' });

    const existingAdmin = await resolveAdminNsFromReq(req);
    let adminToken = existingAdmin;
    let publicToken = null;

    if (!adminToken) {
      adminToken = NamespacedStore.genToken(24);
      publicToken = NamespacedStore.genToken(18);
      await store.set(adminToken, 'publicToken', publicToken);
      await store.set(adminToken, 'meta', { createdAt: Date.now(), role: 'admin' });
      await store.set(publicToken, 'adminToken', adminToken);
      await store.set(publicToken, 'meta', { createdAt: Date.now(), role: 'public', parent: adminToken });
    } else {
      publicToken = await store.get(adminToken, 'publicToken', null);
      if (!publicToken) {
        publicToken = NamespacedStore.genToken(18);
        await store.set(adminToken, 'publicToken', publicToken);
        await store.set(publicToken, 'adminToken', adminToken);
        await store.set(publicToken, 'meta', { createdAt: Date.now(), role: 'public', parent: adminToken });
      }
    }

    const cookieOpts = {
      httpOnly: true,
      sameSite: 'Lax',
      secure: SECURE_COOKIE(),
      path: '/',
      maxAge: parseInt(process.env.SESSION_TTL_SECONDS || '259200', 10) * 1000
    };
    res.cookie(ADMIN_COOKIE, adminToken, cookieOpts);
    res.cookie(PUBLIC_COOKIE, publicToken, cookieOpts);

    const wantsHtml = req.accepts(['html','json']) === 'html' && req.query.json !== '1';
    if (wantsHtml) return res.redirect(302, '/admin');
    res.json({ ok: true, adminToken, publicToken });
  } catch (e) {
    res.status(500).json({ error: 'failed_to_create_session', details: e?.message });
  }
});

app.get('/api/session/public-token', async (req, res) => {
  try {
    const adminNs = await resolveAdminNsFromReq(req);
    if (!store || !adminNs) return res.status(400).json({ error: 'no_admin_session' });
    const pub = await store.get(adminNs, 'publicToken', null);
    if (typeof pub !== 'string' || !pub) return res.status(404).json({ error: 'not_found' });
    res.json({ publicToken: pub });
  } catch (e) {
    res.status(500).json({ error: 'failed_to_get_public', details: e?.message });
  }
});

app.get('/api/session/export', async (req, res) => {
  try {
    const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
    const shouldRequireSession = requireSessionFlag || !!process.env.REDIS_URL;
    if (shouldRequireSession) {
      const nsCheck = req?.ns?.admin || req?.ns?.pub || null;
      if (!nsCheck) return res.status(401).json({ error: 'session_required' });
    }
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

    try { exportObj.lastTipConfig = JSON.parse(fs.readFileSync(LAST_TIP_CONFIG_FILE, 'utf8')); } catch { exportObj.lastTipConfig = null; }
    try { exportObj.tipGoalConfig = JSON.parse(fs.readFileSync(TIP_GOAL_CONFIG_FILE, 'utf8')); } catch { exportObj.tipGoalConfig = null; }
    try { exportObj.socialMediaConfig = socialMediaModule.loadConfig(); } catch { exportObj.socialMediaConfig = null; }
    try {
      const extPath = path.join(process.cwd(), 'config', 'external-notifications-config.json');
      exportObj.externalNotificationsConfig = fs.existsSync(extPath) ? JSON.parse(fs.readFileSync(extPath, 'utf8')) : null;
    } catch { exportObj.externalNotificationsConfig = null; }

    try {
      if (fs.existsSync(LIVEVIEWS_CONFIG_FILE)) {
        const raw = JSON.parse(fs.readFileSync(LIVEVIEWS_CONFIG_FILE, 'utf8'));
        exportObj.liveviewsConfig = getLiveviewsConfigWithDefaults(raw || {});
      } else {
        exportObj.liveviewsConfig = null;
      }
    } catch { exportObj.liveviewsConfig = null; }

    try {
      exportObj.announcementConfig = announcementModule.getPublicConfig();
    } catch { exportObj.announcementConfig = null; }

    try {
      const shPath = path.join(process.cwd(), 'config', 'stream-history-config.json');
      exportObj.streamHistoryConfig = fs.existsSync(shPath) ? JSON.parse(fs.readFileSync(shPath, 'utf8')) : null;
    } catch { exportObj.streamHistoryConfig = null; }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="getty-config-${new Date().toISOString().replace(/[:.]/g,'-')}.json"`);
    res.end(JSON.stringify(exportObj, null, 2));
  } catch (e) {
    res.status(500).json({ error: 'failed_to_export', details: e?.message });
  }
});

app.post('/api/session/import', async (req, res) => {
  try {
    const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
    const shouldRequireSession = requireSessionFlag || !!process.env.REDIS_URL;
    if (shouldRequireSession) {
      const nsCheck = req?.ns?.admin || req?.ns?.pub || null;
      if (!nsCheck) return res.status(401).json({ error: 'session_required' });
    }
    const adminNs = await resolveAdminNsFromReq(req);
    const useStore = !!(store && adminNs);
    const payload = req.body || {};
    const incomingTts = (payload && typeof payload.ttsSettings === 'object') ? payload.ttsSettings : null;
    const incomingChat = (payload && typeof payload.chatConfig === 'object') ? payload.chatConfig : null;
    const incomingLastTip = (payload && typeof payload.lastTipConfig === 'object') ? payload.lastTipConfig : null;
    const incomingTipGoal = (payload && typeof payload.tipGoalConfig === 'object') ? payload.tipGoalConfig : null;
    const lastTipWallet = typeof payload.lastTipWallet === 'string' ? payload.lastTipWallet : (typeof payload.lastTipAddress === 'string' ? payload.lastTipAddress : null);
    const tipGoalWallet = typeof payload.tipGoalWallet === 'string' ? payload.tipGoalWallet : (typeof payload.tipGoalAddress === 'string' ? payload.tipGoalAddress : null);
    if (lastTipWallet && !isValidArweaveAddress(String(lastTipWallet).trim())) {
      return res.status(400).json({ error: 'invalid_wallet_address', field: 'lastTipWallet' });
    }
    if (tipGoalWallet && !isValidArweaveAddress(String(tipGoalWallet).trim())) {
      return res.status(400).json({ error: 'invalid_wallet_address', field: 'tipGoalWallet' });
    }
    const incomingSocialMedia = Array.isArray(payload?.socialMediaConfig) ? payload.socialMediaConfig : null;
    const incomingExternal = (payload && typeof payload.externalNotificationsConfig === 'object') ? payload.externalNotificationsConfig : null;
    const incomingLiveviews = (payload && typeof payload.liveviewsConfig === 'object') ? payload.liveviewsConfig : null;
  const incomingAnnouncement = (payload && typeof payload.announcementConfig === 'object') ? payload.announcementConfig : null;
  const incomingStreamHistory = (payload && typeof payload.streamHistoryConfig === 'object') ? payload.streamHistoryConfig : null;

  if (!incomingTts && !incomingChat && !incomingLastTip && !incomingTipGoal && !lastTipWallet && !tipGoalWallet && !incomingSocialMedia && !incomingExternal && !incomingLiveviews && !incomingAnnouncement && !incomingStreamHistory) {
      return res.status(400).json({ error: 'no_valid_payload' });
    }

    if (useStore) {
      if (incomingTts) await store.set(adminNs, 'tts-settings', incomingTts);
      if (incomingChat) await store.set(adminNs, 'chat-config', incomingChat);
    } else {
      try {
        if (incomingTts) fs.writeFileSync(SETTINGS_FILE, JSON.stringify(incomingTts, null, 2));
      } catch {}
      try {
        if (incomingChat) fs.writeFileSync(CHAT_CONFIG_FILE, JSON.stringify(incomingChat, null, 2));
      } catch {}
    }

    function mergeConfigFile(filePath, incomingObj, allowedKeys) {
      try {
        const current = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
        const filtered = {};
        for (const k of allowedKeys) {
          if (Object.prototype.hasOwnProperty.call(incomingObj, k)) filtered[k] = incomingObj[k];
        }
        const merged = { ...current, ...filtered };
        fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
        return merged;
      } catch { return null; }
    }

    let lastTipApplied = false;
    if (incomingLastTip || lastTipWallet) {
      const allowedLT = ['walletAddress','bgColor','fontColor','borderColor','amountColor','iconColor','iconBgColor','fromColor','title'];
      const base = incomingLastTip || {};
      if (lastTipWallet) base.walletAddress = lastTipWallet;
      const mergedLT = mergeConfigFile(LAST_TIP_CONFIG_FILE, base, allowedLT);
      if (mergedLT) {
        try {
          if (typeof mergedLT.walletAddress === 'string') {
            lastTip.updateWalletAddress(mergedLT.walletAddress);
            if (typeof tipWidget.updateWalletAddress === 'function') tipWidget.updateWalletAddress(mergedLT.walletAddress);
          }
          if (typeof lastTip.broadcastConfig === 'function') lastTip.broadcastConfig(mergedLT);
          lastTipApplied = true;
        } catch {}
      }
    }

    let tipGoalApplied = false;
    if (incomingTipGoal || tipGoalWallet) {
      const allowedTG = ['walletAddress','monthlyGoal','currentAmount','theme','bgColor','fontColor','borderColor','progressColor','title'];
      const base = incomingTipGoal || {};
      if (tipGoalWallet) base.walletAddress = tipGoalWallet;
      const mergedTG = mergeConfigFile(TIP_GOAL_CONFIG_FILE, base, allowedTG);
      if (mergedTG) {
        try {
          if (typeof mergedTG.walletAddress === 'string') tipGoal.updateWalletAddress(mergedTG.walletAddress);
          if (typeof mergedTG.monthlyGoal === 'number') tipGoal.monthlyGoalAR = mergedTG.monthlyGoal;
          if (typeof mergedTG.currentAmount === 'number') tipGoal.currentTipsAR = mergedTG.currentAmount;
          if (typeof mergedTG.theme === 'string') tipGoal.theme = mergedTG.theme;
          if (typeof mergedTG.bgColor === 'string') tipGoal.bgColor = mergedTG.bgColor;
          if (typeof mergedTG.fontColor === 'string') tipGoal.fontColor = mergedTG.fontColor;
          if (typeof mergedTG.borderColor === 'string') tipGoal.borderColor = mergedTG.borderColor;
          if (typeof mergedTG.progressColor === 'string') tipGoal.progressColor = mergedTG.progressColor;
          if (typeof mergedTG.title === 'string') tipGoal.title = mergedTG.title;
          tipGoal.sendGoalUpdate();
          tipGoalApplied = true;
        } catch {}
      }
    }

    let socialApplied = false;
    if (incomingSocialMedia) {
      try {
        const ok = Array.isArray(incomingSocialMedia) && incomingSocialMedia.length <= 50;
        if (!ok) throw new Error('invalid_socialmedia_config');
        socialMediaModule.saveConfig(incomingSocialMedia);
        socialApplied = true;
      } catch {}
    }

    let externalApplied = false;
    if (incomingExternal && typeof incomingExternal === 'object') {
      try {
        const payloadExt = {
          template: typeof incomingExternal.template === 'string' ? incomingExternal.template : undefined,
          discordWebhook: typeof incomingExternal.discordWebhook === 'string' ? incomingExternal.discordWebhook : undefined,
          telegramBotToken: typeof incomingExternal.telegramBotToken === 'string' ? incomingExternal.telegramBotToken : undefined,
          telegramChatId: typeof incomingExternal.telegramChatId === 'string' ? incomingExternal.telegramChatId : undefined,
          liveDiscordWebhook: typeof incomingExternal.liveDiscordWebhook === 'string' ? incomingExternal.liveDiscordWebhook : undefined,
          liveTelegramBotToken: typeof incomingExternal.liveTelegramBotToken === 'string' ? incomingExternal.liveTelegramBotToken : undefined,
          liveTelegramChatId: typeof incomingExternal.liveTelegramChatId === 'string' ? incomingExternal.liveTelegramChatId : undefined
        };
        await externalNotifications.saveConfig(payloadExt);
        externalApplied = true;
      } catch {}
    }

    let liveviewsApplied = false;
    if (incomingLiveviews && typeof incomingLiveviews === 'object') {
      try {
        const allowedLV = ['bg','color','font','size','icon','claimid','viewersLabel'];
        const mergedLV = (function mergeLV() {
          const current = fs.existsSync(LIVEVIEWS_CONFIG_FILE) ? JSON.parse(fs.readFileSync(LIVEVIEWS_CONFIG_FILE, 'utf8')) : {};
          const filtered = {};
          for (const k of allowedLV) {
            if (Object.prototype.hasOwnProperty.call(incomingLiveviews, k)) filtered[k] = incomingLiveviews[k];
          }
          const full = getLiveviewsConfigWithDefaults({ ...current, ...filtered });
          fs.writeFileSync(LIVEVIEWS_CONFIG_FILE, JSON.stringify(full, null, 2));
          return full;
        })();
        if (mergedLV) liveviewsApplied = true;
      } catch {}
    }

    let announcementApplied = false;
    if (incomingAnnouncement && typeof incomingAnnouncement === 'object') {
      try {
        const settingsPayload = {
          cooldownSeconds: incomingAnnouncement.cooldownSeconds,
          theme: incomingAnnouncement.theme,
          bgColor: incomingAnnouncement.bgColor,
          textColor: incomingAnnouncement.textColor,
          animationMode: incomingAnnouncement.animationMode,
          defaultDurationSeconds: incomingAnnouncement.defaultDurationSeconds
        };
        try { announcementModule.setSettings(settingsPayload); } catch {}

        try { announcementModule.clearMessages('all'); } catch {}
        const msgs = Array.isArray(incomingAnnouncement.messages) ? incomingAnnouncement.messages.slice(0, 200) : [];
        for (const m of msgs) {
          try {
            const text = typeof m.text === 'string' ? m.text.slice(0, 200) : '';
            if (!text) continue;
            const message = announcementModule.addMessage({
              text,
              imageUrl: typeof m.imageUrl === 'string' ? m.imageUrl : null,
              linkUrl: typeof m.linkUrl === 'string' && m.linkUrl ? m.linkUrl : undefined,
              durationSeconds: typeof m.durationSeconds === 'number' ? m.durationSeconds : undefined
            });
            if (m && m.enabled === false) {
              try { announcementModule.updateMessage(message.id, { enabled: false }); } catch {}
            }
          } catch { /* ignore item */ }
        }
        announcementApplied = true;
      } catch {}
    }

      let streamHistoryApplied = false;
      if (incomingStreamHistory && typeof incomingStreamHistory === 'object') {
        try {
          const cfg = { claimid: (typeof incomingStreamHistory.claimid === 'string') ? incomingStreamHistory.claimid : '' };
          const shPath = path.join(process.cwd(), 'config', 'stream-history-config.json');
          fs.writeFileSync(shPath, JSON.stringify(cfg, null, 2));
          streamHistoryApplied = true;
        } catch {}
      }

  res.json({ ok: true, restored: { tts: !!incomingTts, chat: !!incomingChat, lastTip: !!lastTipApplied, tipGoal: !!tipGoalApplied, socialmedia: !!socialApplied, external: !!externalApplied, liveviews: !!liveviewsApplied, announcement: !!announcementApplied, streamHistory: !!streamHistoryApplied }, namespaced: useStore });
  } catch (e) {
    res.status(500).json({ error: 'failed_to_import', details: e?.message });
  }
});

registerChatRoutes(app, chat, limiter, CHAT_CONFIG_FILE, { store, chatNs });
registerStreamHistoryRoutes(app, limiter, { store, wss });

app.post('/api/chat/start', async (req, res) => {
  try {
    const ns = req?.ns?.admin || req?.ns?.pub || null;
    if (!ns || !store) return res.status(400).json({ error: 'no_session' });
    const cfg = await store.get(ns, 'chat-config', null);
    const url = cfg?.chatUrl;
    if (!url) return res.status(400).json({ error: 'no_chat_url' });
    await chatNs.start(ns, url);
    res.json({ ok: true, status: chatNs.getStatus(ns) });
  } catch (e) { res.status(500).json({ error: 'failed_to_start', details: e?.message }); }
});

app.post('/api/chat/stop', async (req, res) => {
  try {
    const ns = req?.ns?.admin || req?.ns?.pub || null;
    if (!ns) return res.status(400).json({ error: 'no_session' });
    await chatNs.stop(ns);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'failed_to_stop', details: e?.message }); }
});

app.get('/api/chat/status', async (req, res) => {
  try {
    const ns = req?.ns?.admin || req?.ns?.pub || null;
    if (ns) {
      const st = chatNs.getStatus(ns) || { connected: false };
      return res.json(st);
    }

    try {
      const base = chat.getStatus?.() || {};
      return res.json({ connected: !!base.connected, url: base.chatUrl || null });
    } catch {
      return res.json({ connected: false });
    }
  } catch { res.json({ connected: false }); }
});

app.get('/api/chat/debug', async (req, res) => {
  try {
    const ns = req?.ns?.admin || req?.ns?.pub || null;
    const out = { ns: ns || null };
    if (ns) {
      out.status = chatNs.getStatus(ns) || { connected: false };
      try { out.publicToken = await store.get(ns, 'publicToken', null); } catch {}
      try { out.adminToken = await store.get(ns, 'adminToken', null); } catch {}
    }
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: 'failed', details: e?.message });
  }
});

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
registerSocialMediaRoutes(app, socialMediaModule, strictLimiter);
registerSocialMediaRoutes(app, socialMediaModule, strictLimiter, { store });

registerLastTipRoutes(app, lastTip, tipWidget, { store, wss });
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

registerTipGoalRoutes(app, strictLimiter, goalAudioUpload, tipGoal, wss, TIP_GOAL_CONFIG_FILE, GOAL_AUDIO_CONFIG_FILE, { store });

registerExternalNotificationsRoutes(app, externalNotifications, strictLimiter, { store });
registerLiveviewsRoutes(app, strictLimiter, { store });
registerTipNotificationGifRoutes(app, strictLimiter);
registerAnnouncementRoutes(app, announcementModule, announcementLimiters);

app.post('/api/chat/test-message', limiter, async (req, res) => {
  try {
    const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
    const shouldRequireSession = requireSessionFlag || !!process.env.REDIS_URL;
    const ns = req?.ns?.admin || req?.ns?.pub || null;
    if (shouldRequireSession && !ns) return res.status(401).json({ error: 'session_required' });

    const body = req.body || {};
    const username = (typeof body.username === 'string' && body.username.trim()) ? body.username.trim() : 'TestUser';
    const text = (typeof body.message === 'string') ? body.message.slice(0, 500) : 'Test message';
    const donationOnly = !!body.donationOnly;
    const rawCredits = Number(body.credits);
    let credits = Number.isFinite(rawCredits) ? rawCredits : 0;
    if (donationOnly && credits <= 0) credits = 5;
    if (!donationOnly && credits < 0) credits = 0;
    const avatar = (typeof body.avatar === 'string' && body.avatar.trim()) ? body.avatar.trim() : undefined;

    const chatMsg = {
      channelTitle: username,
      message: text,
      credits,
      ...(avatar ? { avatar } : {}),
      timestamp: new Date().toISOString()
    };

    if (typeof wss.broadcast === 'function' && ns) {

      const adminNs = await resolveAdminNsFromReq(req) || ns;
      wss.broadcast(adminNs, { type: 'chatMessage', data: chatMsg });
    } else {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'chatMessage', data: chatMsg }));
        }
      });
    }

    res.json({ ok: true, sent: chatMsg });
  } catch (e) {
    res.status(500).json({ error: 'failed_to_send_test_message', details: e?.message });
  }
});

app.post('/api/test-tip', limiter, async (req, res) => {
  try {
    const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
    const shouldRequireSession = requireSessionFlag || !!process.env.REDIS_URL;
    if (shouldRequireSession) {
      const nsCheck = req?.ns?.admin || req?.ns?.pub || null;
      if (!nsCheck) return res.status(401).json({ error: 'session_required' });
    }
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
    
    const ns = req?.ns?.admin || req?.ns?.pub || null;
    if (typeof wss.broadcast === 'function' && ns) {
      wss.broadcast(ns, { type: 'tip', data: donation });
    } else {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'tip', data: donation }));
        }
      });
    }
    
    if (store && ns) {
      try {
        const cfg = await store.get(ns, 'external-notifications-config', null);
        if (cfg) await externalNotifications.sendWithConfig(cfg, donation);
      } catch {}
    } else {
      externalNotifications.handleIncomingTip({
        ...donation,
        usd: (donation.amount * 5).toFixed(2)
      });
    }
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

app.get('/widgets/giveaway', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/widgets/giveaway.html'));
});

app.get('/obs-help', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/obs-integration.html'));
});

app.get('/widgets/socialmedia', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/widgets/socialmedia.html'));
});

app.get('/widgets/liveviews', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/widgets/liveviews.html'));
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

try {
  app.get(['/', '/index.html'], (req, res, next) => {
    try {
  if (process.env.NODE_ENV === 'test') return next();
      const wantsHtml = req.accepts(['html','json']) === 'html';
      const hasNsCookie = !!(req.cookies?.[ADMIN_COOKIE] || req.cookies?.[PUBLIC_COOKIE]);
      const seen = req.cookies?.['getty_seen_welcome'] === '1';

    if (wantsHtml && !hasNsCookie && !seen) {
        const cookieOpts = {
          httpOnly: false,
          sameSite: 'Lax',
          secure: SECURE_COOKIE(),
          path: '/',
          maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        };
        try { res.cookie('getty_seen_welcome', '1', cookieOpts); } catch {}
        return res.redirect(302, '/welcome');
      }
    } catch {}
    return next();
  });
} catch {}

try {
  app.get(['/welcome','/welcome/'], (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'welcome.html'));
  });
} catch {}


app.use(express.static('public', {
  etag: true,
  lastModified: true,
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
  }
}));

registerRaffleRoutes(app, raffle, wss, { store });

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
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const all = String(req.query.limit || '').toLowerCase() === 'all';
    const baseArr = level ? __activityLog.filter(i => i.level === level) : __activityLog.slice();
    const filtered = q
      ? baseArr.filter(i => {
          try {
            const msg = (i && (i.message || i.msg || '')) + '';
            return msg.toLowerCase().includes(q.toLowerCase());
          } catch { return false; }
        })
      : baseArr;
    const totalItems = filtered.length;
    const max = __MAX_ACTIVITY;
    const rawLimit = all ? totalItems : Math.min(parseInt(req.query.limit, 10) || 100, max);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    let items = filtered.slice();
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
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const base = level ? __activityLog.filter(i => i.level === level) : __activityLog;
    const items = q
      ? base.filter(i => {
          try {
            const msg = (i && (i.message || i.msg || '')) + '';
            return msg.toLowerCase().includes(q.toLowerCase());
          } catch { return false; }
        })
      : base;
    const filename = `activity-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(JSON.stringify(items, null, 2));
  } catch {
    res.status(500).json({ error: 'Failed to export activity log' });
  }
});

app.get('/api/modules', async (req, res) => {
  const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
  const ns = req?.ns?.admin || req?.ns?.pub || null;
  const adminNs = await (async () => {
    try {
      if (!store || !ns) return null;
      if (req?.ns?.admin) return req.ns.admin;
      const mapped = await store.get(ns, 'adminToken', null);
      return mapped || null;
    } catch { return null; }
  })();
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  const hosted = !!(store && store.redis) || !!process.env.REDIS_URL;

  let tipGoalColors = {};
  let lastTipColors = {};
  let chatColors = {};
  try {
    if (store && adminNs) {
      const st = await store.get(adminNs, 'chat-config', null);
      if (st && typeof st === 'object') chatColors = st;
    }
    if ((!chatColors || Object.keys(chatColors).length === 0) && fs.existsSync(CHAT_CONFIG_FILE)) {
      chatColors = JSON.parse(fs.readFileSync(CHAT_CONFIG_FILE, 'utf8'));
    }
  } catch {}

  try {
    if (store && adminNs) {
      const tg = await store.get(adminNs, 'tip-goal-config', null);
      if (tg && typeof tg === 'object') tipGoalColors = tg;

    } else if (fs.existsSync(TIP_GOAL_CONFIG_FILE)) {
      tipGoalColors = JSON.parse(fs.readFileSync(TIP_GOAL_CONFIG_FILE, 'utf8'));
    }
  } catch {}
  try {
    if (store && adminNs) {
      const lt = await store.get(adminNs, 'last-tip-config', null);
      if (lt && typeof lt === 'object') lastTipColors = lt;
    }
    if ((!lastTipColors || Object.keys(lastTipColors).length === 0) && fs.existsSync(LAST_TIP_CONFIG_FILE)) {
      lastTipColors = JSON.parse(fs.readFileSync(LAST_TIP_CONFIG_FILE, 'utf8'));
    }
  } catch {}

  const sanitizeIfNoNs = (obj) => {
    if (hasNs) return obj;
    const clone = { ...obj };
    if (clone.walletAddress) delete clone.walletAddress;
    return clone;
  };

  const uptimeSeconds = Math.floor((Date.now() - __serverStartTime) / 1000);
  const wsClients = (() => {
    try { return Array.from(wss.clients).filter(c=>c && c.readyState === 1).length; } catch { return 0; }
  })();

  const payload = {
    lastTip: (async () => {
      try {
        const base = lastTip.getStatus?.() || {};
        const merged = { ...base, ...lastTipColors };
        const __ltBaseWallet = typeof base.walletAddress === 'string' ? base.walletAddress.trim() : '';
        const __ltCfgWallet = typeof merged.walletAddress === 'string' ? merged.walletAddress.trim() : '';
        const __tgWallet = typeof tipGoalColors.walletAddress === 'string' ? tipGoalColors.walletAddress.trim() : '';
        const __effLtWallet = __ltCfgWallet || __ltBaseWallet || __tgWallet;
        if (__effLtWallet) merged.walletAddress = __effLtWallet;
        const wallet = __effLtWallet;
        if (wallet) {
          try { merged.lastDonation = await lastTip.fetchLastDonation(wallet); } catch {}
        }
        merged.active = !!wallet || !!merged.lastDonation;
        return sanitizeIfNoNs(merged);
      } catch { return sanitizeIfNoNs({ ...lastTip.getStatus(), ...lastTipColors }); }
    })(),
    tipWidget: (() => {
      try {
        const base = tipWidget.getStatus?.() || {};
        const effWallet = (typeof tipGoalColors.walletAddress === 'string' && tipGoalColors.walletAddress.trim())
          || (typeof lastTipColors.walletAddress === 'string' && lastTipColors.walletAddress.trim())
          || (typeof base.walletAddress === 'string' && base.walletAddress.trim())
          || '';
        const out = { ...base };
        if (effWallet) out.walletAddress = effWallet;
        out.active = !!(effWallet || base.active);
        return sanitizeIfNoNs(out);
      } catch { return sanitizeIfNoNs(tipWidget.getStatus()); }
    })(),
  tipGoal: (() => {
      try {
        const base = tipGoal.getStatus?.() || {};
        const merged = { ...base, ...tipGoalColors };
        const current = Number(merged.currentAmount ?? merged.currentTips ?? base.currentTips ?? 0) || 0;
        const goal = Number(merged.monthlyGoal ?? base.monthlyGoal ?? 0) || 0;
        let rate = Number(merged.exchangeRate || base.exchangeRate || 0);
        if (!rate || !isFinite(rate) || rate <= 0) {
          try { if (__arPriceCache && __arPriceCache.usd > 0) rate = Number(__arPriceCache.usd) || 0; } catch {}
        }
        if (rate && isFinite(rate) && rate > 0) {
          merged.exchangeRate = rate;
          merged.usdValue = (current * rate).toFixed(2);
          merged.goalUsd = (goal * rate).toFixed(2);
        }
        merged.currentTips = current;
        merged.currentAmount = current;
        const __tgBaseWallet = typeof base.walletAddress === 'string' ? base.walletAddress.trim() : '';
        const __tgCfgWallet = typeof merged.walletAddress === 'string' ? merged.walletAddress.trim() : '';
        const __effTgWallet = __tgCfgWallet || __tgBaseWallet;
        if (__effTgWallet) merged.walletAddress = __effTgWallet;
        const wallet = __effTgWallet;

        merged.active = !!wallet;
        merged.initialized = !!wallet;
        if (!wallet) {
          merged.title = 'Configure tip goal 💸';
          merged.monthlyGoal = 0;
          merged.currentAmount = 0;
          merged.currentTips = 0;
          merged.usdValue = '0.00';
          merged.goalUsd = '0.00';
          merged.progress = 0;
        }
        return sanitizeIfNoNs(merged);
      } catch { return sanitizeIfNoNs({ ...tipGoal.getStatus(), ...tipGoalColors }); }
    })(),
    chat: (() => {
      try {
        const base = chat.getStatus?.() || {};
        if (store && ns) {
          const st = chatNs?.getStatus?.(ns) || {};
          const out = { ...base, ...chatColors };
          out.connected = !!st.connected;
          out.active = !!(st.connected || (typeof chatColors.chatUrl === 'string' && chatColors.chatUrl.trim()));
          if (typeof chatColors.chatUrl === 'string' && chatColors.chatUrl.trim()) {
            out.chatUrl = chatColors.chatUrl.trim();
          }
          return out;
        }
        return { ...base, ...chatColors };
      } catch { return { active: false, ...chatColors }; }
    })(),
    announcement: (() => {
      try {
        const cfg = announcementModule.getPublicConfig();
        const enabledMessages = cfg.messages.filter(m=>m.enabled).length;
        return { active: enabledMessages > 0, totalMessages: cfg.messages.length, enabledMessages, cooldownSeconds: cfg.cooldownSeconds };
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
        config: { hasDiscord: !!st.config?.hasDiscord, hasTelegram: !!st.config?.hasTelegram, template: st.config?.template || '' },
        lastUpdated: st.lastUpdated
      };
    })(),
  liveviews: (async () => {
      try {
        let cfg = null;
        if (store && ns) {
          try { cfg = await store.get(ns, 'liveviews-config', null); } catch { cfg = null; }
        }
        if (!cfg && fs.existsSync(LIVEVIEWS_CONFIG_FILE)) {
          try { cfg = JSON.parse(fs.readFileSync(LIVEVIEWS_CONFIG_FILE, 'utf8')); } catch { cfg = null; }
        }
        if (!cfg) return { active: false };
        const full = getLiveviewsConfigWithDefaults(cfg || {});
        const active = !!(full.claimid || full.icon || full.viewersLabel);
        return { active, claimid: hasNs ? full.claimid : undefined, viewersLabel: full.viewersLabel };
      } catch { return { active: false }; }
    })(),
  raffle: (async () => {
      try {
    let __adm = adminNs;
    const st = raffle.getPublicState(__adm);
        return { active: !!st.active, paused: !!st.paused, participants: st.participants || [], totalWinners: st.totalWinners || 0 };
      } catch { return { active: false, participants: [] }; }
    })(),
    system: { uptimeSeconds, wsClients, env: process.env.NODE_ENV || 'development' }
  };

  if ((requireSessionFlag || hosted) && !hasNs) {
    try { if (payload.lastTip) payload.lastTip.active = false; } catch {}
    try { if (payload.tipWidget) payload.tipWidget.active = false; } catch {}
    try { if (payload.tipGoal) { payload.tipGoal.active = false; if (typeof payload.tipGoal.initialized !== 'undefined') payload.tipGoal.initialized = false; } } catch {}
    try { if (payload.chat) { payload.chat.connected = false; payload.chat.active = false; } } catch {}
    try { if (payload.announcement) payload.announcement.active = false; } catch {}
    try { if (payload.socialmedia) { payload.socialmedia.configured = false; payload.socialmedia.entries = 0; } } catch {}
    try {
      if (payload.externalNotifications) {
        payload.externalNotifications.active = false;
        payload.externalNotifications.lastTips = [];
        if (payload.externalNotifications.config) {
          payload.externalNotifications.config.hasDiscord = false;
          payload.externalNotifications.config.hasTelegram = false;
          payload.externalNotifications.config.template = '';
        }
      }
    } catch {}
    try { if (payload.liveviews) payload.liveviews.active = false; } catch {}
    try { if (payload.raffle) delete payload.raffle; } catch {}

  payload.masked = true;
  payload.maskedReason = 'no_session';
  }

  try {
    const keys = Object.keys(payload);
    for (const k of keys) {
      if (payload[k] && typeof payload[k].then === 'function') {
        payload[k] = await payload[k];
      }
    }
  } catch {}

  try {
    const now = Date.now();
    const moduleKeys = ['lastTip','tipWidget','tipGoal','chat','announcement','socialmedia','externalNotifications','liveviews','raffle'];
    for (const k of moduleKeys) {
      const obj = payload[k];
      if (!obj || typeof obj !== 'object') continue;
      const isActive = !!obj.active;
      const rec = __moduleUptime[k] || { active: isActive, since: now };
      if (rec.active !== isActive) {
        rec.active = isActive;
        rec.since = now;
      }
      __moduleUptime[k] = rec;
      if (isActive) {
        const seconds = Math.floor((now - rec.since) / 1000);
        try { obj.uptimeSeconds = seconds; } catch {}
        try { obj.activeSince = new Date(rec.since).toISOString(); } catch {}
      } else {
        try { obj.uptimeSeconds = 0; } catch {}
      }
    }
  } catch {}

  res.json(payload);
});

app.get('/api/metrics', async (req, res) => {
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

  let history = [];
  try {
    const ns = req?.ns?.admin || req?.ns?.pub || null;
    if (ns && chatNs && typeof chatNs.getHistory === 'function') {
      history = chatNs.getHistory(ns);
    } else if (typeof chat.getHistory === 'function') {
      history = chat.getHistory();
    }
  } catch { history = []; }
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

wss.on('connection', async (ws) => {
  try {
    let ns = null;
    try { ns = ws.nsToken || null; } catch {}
    const shouldRequireSession = (process.env.GETTY_REQUIRE_SESSION === '1') || !!process.env.REDIS_URL;
    let initPayload = {
      lastTip: lastTip.getLastDonation(),
      tipGoal: tipGoal.getGoalProgress(),
      persistentTips: externalNotifications.getStatus().lastTips,
      raffle: null
    };
  if (ns && store) {
      try {
        const lt = await store.get(ns, 'last-tip-config', null);
        const tg = await store.get(ns, 'tip-goal-config', null);
        if (tg && typeof tg === 'object') {
          let exRate = 0;
          try { const p = await getArUsdCached(false); exRate = Number(p.usd) || 0; } catch {}
          initPayload.tipGoal = {
            currentTips: tg.currentAmount || 0,
            monthlyGoal: tg.monthlyGoal || 10,
            progress: tg.monthlyGoal ? Math.min(((tg.currentAmount || 0) / tg.monthlyGoal) * 100, 100) : 0,
            exchangeRate: exRate,
            usdValue: ((tg.currentAmount || 0) * exRate).toFixed(2),
            goalUsd: ((tg.monthlyGoal || 0) * exRate).toFixed(2),
            theme: tg.theme,
            bgColor: tg.bgColor,
            fontColor: tg.fontColor,
            borderColor: tg.borderColor,
            progressColor: tg.progressColor,
            title: tg.title
          };
        } else {

          initPayload.tipGoal = { currentTips: 0, monthlyGoal: 0, progress: 0, exchangeRate: 0, usdValue: '0.00', goalUsd: '0.00', title: 'Configure tip goal 💸' };
        }
        if (lt && typeof lt === 'object') {
          initPayload.lastTip = { lastDonation: lastTip.getLastDonation(), ...lt };
        }

        initPayload.raffle = raffle.getPublicState(ns);
      } catch {}
    } else {
      initPayload.raffle = shouldRequireSession
        ? { active: false, paused: false, participants: [], totalWinners: 0 }
        : raffle.getPublicState(null);
    }
    ws.send(JSON.stringify({ type: 'init', data: initPayload }));
  } catch {}

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'get_raffle_state') {
        const st = raffle.getPublicState(ws.nsToken || null);
        ws.send(JSON.stringify({ type: 'raffle_state', ...st }));
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
    const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
    const shouldRequireSession = requireSessionFlag || !!process.env.REDIS_URL;
    if (shouldRequireSession) {
      const nsCheck = req?.ns?.admin || req?.ns?.pub || null;
      if (!nsCheck) return res.status(401).json({ error: 'session_required' });
    }
    const { from, amount } = req.body;
    const tip = {
      from: from || "test-user",
      amount: amount || 1,
      message: "Test notification",
      source: "test",
      timestamp: new Date().toISOString()
    };
    let success = false;
    const ns = (req?.ns?.admin || req?.ns?.pub || null);
    if (store && ns) {
      const cfg = await store.get(ns, 'external-notifications-config', null);
      if (cfg) success = await externalNotifications.sendWithConfig(cfg, tip);
    } else {
      success = await externalNotifications.sendToDiscord(tip);
    }
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
  try {
    process.on('unhandledRejection', (reason, p) => {
      try { console.error('Unhandled Rejection at:', p, 'reason:', reason); } catch {}
    });
    process.on('uncaughtException', (err) => {
      try { console.error('Uncaught Exception:', err); } catch {}
    });
  } catch {}

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

  wss.broadcast = function(nsToken, payload) {
    try {
      const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
      wss.clients.forEach(client => {
        if (client && client.readyState === 1) {

          if (nsToken) {
            if (client.nsToken !== nsToken) return;
          }
          client.send(data);
        }
      });
    } catch (e) { console.error('broadcast error', e); }
  };

  const __allowedOrigins = new Set(
    (process.env.GETTY_ALLOW_ORIGINS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  );

  server.on('upgrade', (req, socket, head) => {
    try {
      const origin = req.headers.origin || '';
      if (__allowedOrigins.size > 0 && origin && !__allowedOrigins.has(origin)) {
        try { socket.destroy(); } catch {}
        return;
      }
      const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0] || 'http';
      const url = new URL(req.url || '/', `${proto}://${req.headers.host}`);
      let nsToken = url.searchParams.get('token') || '';
      if (!nsToken && req.headers.cookie) {
        const cookies = parseCookieHeader(req.headers.cookie);
        nsToken = cookies['getty_public_token'] || cookies['getty_admin_token'] || '';
      }
      const bindAndAccept = async () => {
        let effective = nsToken || '';
        try {
          if (store && effective) {

            const mapped = await store.get(effective, 'adminToken', null);
            if (mapped) effective = mapped;
          }
        } catch {}
        wss.handleUpgrade(req, socket, head, ws => {
          ws.nsToken = effective || null;
          wss.emit('connection', ws, req);
        });
      };
      bindAndAccept();
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
        try {
          const host = req.headers.host || 'localhost';
          const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0] || 'http';
          let nsToken = '';
          try {
            const url = new URL(req.url || '/', `${proto}://${host}`);
            nsToken = url.searchParams.get('token') || '';
          } catch {}
          if (!nsToken && req.headers.cookie) {
            const raw = String(req.headers.cookie);
            raw.split(';').forEach(p => {
              const idx = p.indexOf('=');
              if (idx > -1) {
                const k = p.slice(0, idx).trim();
                const v = decodeURIComponent(p.slice(idx + 1).trim());
                if (k === 'getty_admin_token' || k === 'getty_public_token') nsToken = v;
              }
            });
          }
          wss.handleUpgrade(req, socket, head, ws => {
            ws.nsToken = nsToken || null;
            wss.emit('connection', ws, req);
          });
        } catch {
          try { socket.destroy(); } catch {}
        }
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
