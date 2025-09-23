const path = require('path');

require('./lib/log-shim');
try {
  if (process.env.DONT_LOAD_DOTENV !== '1') {
    require('dotenv').config();
  }
} catch {}
const LIVEVIEWS_CONFIG_FILE = path.join(process.cwd(), 'config', 'liveviews-config.json');

let loadTenantConfig = null;
try { ({ loadTenantConfig } = require('./lib/tenant-config')); } catch {}
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
let WebSocket = require('ws');

try {
  if (!WebSocket || (typeof WebSocket !== 'function' && typeof WebSocket.Server !== 'function')) {
    WebSocket = { Server: function StubWSS() { this.clients = new Set(); this.on = () => {}; this.handleUpgrade = (_r,_s,_h,cb)=>{ if (cb) cb({}); }; this.emit = () => {}; this.close = () => {}; } };
  }
} catch {}
const axios = require('axios');
const fs = require('fs');
const multer = require('multer');

const OBS_WS_CONFIG_FILE = path.join(__dirname, 'config', 'obs-ws-config.json');

try {
  const isProd = process.env.NODE_ENV === 'production';
  const keepSri = process.env.GETTY_KEEP_SRI_DEV === '1';
  if (!isProd && !keepSri) {
    const PUBLIC_DIR = path.join(process.cwd(), 'public');
    const stripSriInHtml = (html) => {
      try {
        return html
          .replace(/\s+integrity=["'][^"']+["']/gi, '')
          .replace(/\s+crossorigin=["'][^"']+["']/gi, '');
      } catch { return html; }
    };
    const walk = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else if (e.isFile() && p.toLowerCase().endsWith('.html')) {
            try {
              const raw = fs.readFileSync(p, 'utf8');
              const out = stripSriInHtml(raw);
              if (out !== raw) fs.writeFileSync(p, out);
            } catch {}
          }
        }
      } catch {}
    };
    if (fs.existsSync(PUBLIC_DIR)) walk(PUBLIC_DIR);
  }
} catch {}

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
const registerTipNotificationRoutes = require('./routes/tip-notification');
const registerAnnouncementRoutes = require('./routes/announcement');
const { AchievementsModule } = require('./modules/achievements');
const registerAchievementsRoutes = require('./routes/achievements');
const { AnnouncementModule } = require('./modules/announcement');
const RaffleModule = require('./modules/raffle');
const { registerUserRoutes } = require('./routes/user');

const __CONFIG_DIR = process.env.GETTY_CONFIG_DIR
  ? path.isAbsolute(process.env.GETTY_CONFIG_DIR)
    ? process.env.GETTY_CONFIG_DIR
    : path.join(process.cwd(), process.env.GETTY_CONFIG_DIR)
  : path.join(process.cwd(), 'config');

const GOAL_AUDIO_CONFIG_FILE = path.join(__CONFIG_DIR, 'goal-audio-settings.json');
const TIP_GOAL_CONFIG_FILE = path.join(__CONFIG_DIR, 'tip-goal-config.json');
const LAST_TIP_CONFIG_FILE = path.join(__CONFIG_DIR, 'last-tip-config.json');
const CHAT_CONFIG_FILE = path.join(__CONFIG_DIR, 'chat-config.json');
const RAFFLE_CONFIG_FILE = path.join(__CONFIG_DIR, 'raffle-config.json');
const GOAL_AUDIO_UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'goal-audio');

const app = express();
const cookieParser = require('cookie-parser');
const { NamespacedStore } = require('./lib/store');

let walletAuth = null;
try {
  if (process.env.GETTY_MULTI_TENANT_WALLET === '1') {
    walletAuth = require('./lib/wallet-auth');
  }
} catch {}

const __LOG_LEVEL = (process.env.GETTY_LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')).toLowerCase();
const __levelRank = { debug: 10, info: 20, warn: 30, error: 40, silent: 50 };
function __allow(level) {
  return (__levelRank[level] || 999) >= (__levelRank[__LOG_LEVEL] || 0) && __LOG_LEVEL !== 'silent';
}

const __WS_VERBOSE = process.env.GETTY_WS_DEBUG_VERBOSE === '1';

function extractNamespaceFromRequest(req) {
  try {
    const hdr = req.headers['x-ws-ns'];
    if (hdr && typeof hdr === 'string') return hdr.slice(0, 64);
    const u = new URL(req.url, 'http://internal');
    const qpNs = u.searchParams.get('ns');
    if (qpNs) return qpNs.slice(0, 64);
  } catch {}
  return null;
}

if (!__allow('debug')) { /* console.debug disabled */ }
if (__LOG_LEVEL === 'silent') {

  try { console.warn = () => {}; } catch {}
}

try {
  if (process.env.NODE_ENV === 'test' && process.env.GETTY_SILENCE_LEGACY_WALLET === '1') {
    const __origErr = console.error;
    console.error = (...args) => {
      try { if (args.some(a => typeof a === 'string' && /wallet/i.test(a))) return; } catch {}
      return __origErr.apply(console, args);
    };
  }
} catch {}

function anonymizeIp(ip) {
  try {
    if (!ip) return '';
    ip = ip.replace(/^::ffff:/, '');
    if (ip.includes(':')) {
      const parts = ip.split(':').filter(Boolean);
      return parts.slice(0, 3).join(':') + '::';
    }
    const segs = ip.split('.');
    if (segs.length === 4) { segs[3] = '0'; return segs.join('.'); }
    return ip;
  } catch { return ''; }
}

let redisClient = null;
try {
  if (process.env.REDIS_URL) {
    const Redis = require('ioredis');
    const url = process.env.REDIS_URL;
    let isTls = /^rediss:\/\//i.test(url);
    try {
      const parsed = new URL(url);
      if (/\.upstash\.io$/i.test(parsed.hostname)) isTls = true;
    } catch {}
    const redisOpts = {
      tls: isTls ? {} : undefined,
      enableReadyCheck: false,
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy(times) { return Math.min(1000 * Math.pow(2, times), 15000); },
      reconnectOnError: () => true,
      connectTimeout: 10000,
      keepAlive: 15000,
      noDelay: true
    };
  const __silenceRedis = (process.env.NODE_ENV === 'test' && process.env.GETTY_SILENCE_REDIS_TEST === '1');
  try { if (!__silenceRedis) console.warn('[redis] initializing client', { tls: !!redisOpts.tls, lazy: !!redisOpts.lazyConnect }); } catch {}
    redisClient = new Redis(url, redisOpts);

    try {
      redisClient.on('error', (err) => {
        if (__silenceRedis) return; try { console.warn('[redis] error:', err?.message || String(err)); } catch {}
      });
      redisClient.on('end', () => { if (__silenceRedis) return; try { console.warn('[redis] connection ended'); } catch {} });
      redisClient.on('reconnecting', (delay) => { if (__silenceRedis) return; try { console.warn('[redis] reconnecting in', delay, 'ms'); } catch {} });
  redisClient.on('ready', () => { if (__silenceRedis) return; try { console.warn('[redis] ready'); } catch {} });
  redisClient.on('connect', () => { if (__silenceRedis) return; try { console.warn('[redis] connect'); } catch {} });
    } catch {}

    try {
      redisClient.connect().catch((e) => {
        if (__silenceRedis) return; try { console.warn('[redis] initial connect failed:', e?.message || String(e)); } catch {}
      });
    } catch {}
  }
} catch {}
const store = new NamespacedStore({ redis: redisClient, ttlSeconds: parseInt(process.env.SESSION_TTL_SECONDS || '259200', 10) });
try { app.set('store', store); } catch {}
try {
  if (process.env.REDIS_URL && !store.redis && process.env.NODE_ENV !== 'test') {
    console.warn('[hosted] REDIS_URL is set but Redis client is not initialized. Check network/VPC/credentials.');
  }
} catch {}

try { app.use(helmet({ contentSecurityPolicy: false })); } catch {}

try {
  const isProd = process.env.NODE_ENV === 'production';
  const cspFlag = process.env.GETTY_ENABLE_CSP;
  const enableCsp = (cspFlag === '1') || (typeof cspFlag === 'undefined' && isProd);
  if (enableCsp) {
    app.use((req, res, next) => {
      try {
        const nonce = require('crypto').randomBytes(16).toString('base64');
        res.locals.cspNonce = nonce;
        res.setHeader('X-CSP-Nonce', nonce);
      } catch {}
      next();
    });
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
  const styleExtra = splitEnv('GETTY_CSP_STYLE_EXTRA');
  const frameExtra = splitEnv('GETTY_CSP_FRAME_EXTRA');
  const fontExtra = splitEnv('GETTY_CSP_FONT_EXTRA');
  const scriptHashes = splitEnv('GETTY_CSP_SCRIPT_HASHES');
  const styleHashes = splitEnv('GETTY_CSP_STYLE_HASHES');
  const allowUnsafeHashes = process.env.GETTY_CSP_UNSAFE_HASHES === '1';
  const scriptAttr = (process.env.GETTY_CSP_SCRIPT_ATTR || '').trim();
  const allowInlineScripts = process.env.GETTY_CSP_ALLOW_INLINE_SCRIPTS === '1';
  const allowInlineStyles = process.env.GETTY_CSP_ALLOW_INLINE_STYLES === '1';
  const enableGoogleFonts = process.env.GETTY_CSP_ENABLE_GOOGLE_FONTS !== '0';

    const cspDirectives = {
      defaultSrc: [self],
      scriptSrc: [
        self,
        ...(allowInlineScripts ? ["'unsafe-inline'"] : []),
        ...(allowUnsafeHashes ? ["'unsafe-hashes'"] : []),
        ...unsafeEval,
        ...scriptExtra,
        ...scriptHashes
      ],

      styleSrc: [
        self,
        ...(enableGoogleFonts ? ['https://fonts.googleapis.com'] : []),
        (req, res) => `'nonce-${res.locals.cspNonce || ''}'`,
        ...(allowInlineStyles ? ["'unsafe-inline'"] : []),
        ...styleExtra,
        ...styleHashes
      ],
      imgSrc: [
        self, 'data:', 'blob:',
        'https://thumbs.odycdn.com', 'https://thumbnails.odycdn.com',
        'https://odysee.com', 'https://static.odycdn.com',
        'https://twemoji.maxcdn.com', 'https://spee.ch',
        'https://arweave.net', 'https://*.arweave.net',
        ...imgExtra
      ],
  fontSrc: [self, 'data:', 'blob:', ...(enableGoogleFonts ? ['https://fonts.gstatic.com'] : []), ...fontExtra],
      mediaSrc: [
        self,
        'blob:',
        'https://arweave.net', 'https://*.arweave.net',
        'https://ardrive.net', 'https://*.ardrive.net',
        ...mediaExtra
      ],
      connectSrc: [self, 'ws:', 'wss:', ...connectExtra],
      frameSrc: [self, ...frameExtra]
    };

    if (scriptAttr) {
      const parts = scriptAttr.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length) cspDirectives.scriptSrcAttr = parts;
    }

    try {
      const existing = Array.isArray(cspDirectives.scriptSrcAttr) ? cspDirectives.scriptSrcAttr : [];
      const merged = Array.from(new Set([...existing, 'integrity']));
      cspDirectives.scriptSrcAttr = merged;
    } catch {}

  app.use(helmet.contentSecurityPolicy({ useDefaults: true, directives: cspDirectives }));
  }
} catch {}
try { app.set('trust proxy', 1); } catch {}
try { app.use(express.json({ limit: '1mb' })); } catch {}
try { app.use(express.urlencoded({ extended: true, limit: '1mb' })); } catch {}
try { app.use(cookieParser()); } catch {}

try { if (walletAuth && walletAuth.attachSessionMiddleware) walletAuth.attachSessionMiddleware(app); } catch {}

try {
  app.use(async (req, _res, next) => {
    try {
      if (process.env.GETTY_MULTI_TENANT_WALLET === '1' && req.walletSession) {
        const hash = req.walletSession.walletHash;
        if (hash) {

            if (!req.ns) req.ns = { admin: null, pub: null };

          if (!req.ns.admin) {
            req.ns.admin = hash;
          }

          if (!req.auth || !req.auth.isAdmin) {
            req.auth = { ...(req.auth || {}), isAdmin: true, source: (req.auth && req.auth.source) || 'wallet-session', tokenRole: 'admin' };
          }

          try {
            if (store && hash) {
              const meta = await store.get(hash, 'meta', null);
              if (!meta) {
                await store.set(hash, 'meta', { role: 'admin', createdAt: Date.now(), walletAddr: req.walletSession.addr });
              }
              const admTok = await store.get(hash, 'adminToken', null);
              if (!admTok) {
                await store.set(hash, 'adminToken', hash);
              }

              const pubTok = await store.get(hash, 'publicToken', null);
              if (!pubTok) {
                await store.set(hash, 'publicToken', hash);
              }
            }
          } catch {}
        }
      }
    } catch {}
    return next();
  });
} catch {}
try { app.use(compression()); } catch {}

try {
  morgan.token('anonip', (req) => anonymizeIp(req.ip || req.connection?.remoteAddress || ''));
  const logFormat = process.env.GETTY_LOG_FORMAT || ':method :url :status :res[content-length] - :response-time ms :anonip';
  if (process.env.NODE_ENV !== 'test' && __allow('info')) {
    app.use(morgan(logFormat, {
      skip: () => __LOG_LEVEL === 'silent'
    }));
  }
} catch {}

try {
  app.use((req, _res, next) => {
    try { req.anonymizedIp = anonymizeIp(req.ip || req.connection?.remoteAddress || ''); } catch { req.anonymizedIp = ''; }
    next();
  });
} catch {}

try {
  app.use((req, res, next) => {
    try {
      res.setHeader('Referrer-Policy', 'no-referrer');
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

try {
  const rawAllowed = (process.env.GETTY_ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
  const allowedSet = new Set(rawAllowed);
  if (allowedSet.size) {
    app.use((req, res, next) => {
      try {
        const method = req.method || 'GET';
        const isUnsafe = /^(POST|PUT|PATCH|DELETE)$/i.test(method);
        const isApi = typeof req.path === 'string' && req.path.startsWith('/api/');
        if (!isUnsafe || !isApi) return next();
        const origin = req.headers.origin;
        if (!origin || !allowedSet.has(origin)) {
          return res.status(403).json({ error: 'origin_not_allowed' });
        }
        res.setHeader('Vary', 'Origin');
        return next();
      } catch { return next(); }
    });

    app.options('*', (req, res, next) => {
      const origin = req.headers.origin;
      if (origin && allowedSet.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-csrf-token');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        return res.sendStatus(204);
      }
      return next();
    });
  }
} catch {}

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

    const hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
    let acceptedToken = '';
    let presentedRole = null;
    if (incomingToken) {
      try {
        if (store && hostedMode) {
          const meta = await store.get(incomingToken, 'meta', null);
          if (meta) {
            acceptedToken = incomingToken;
            try { presentedRole = (typeof meta.role === 'string') ? meta.role : null; } catch {}
          }
        } else {
          acceptedToken = incomingToken;
        }
      } catch {}
    }

    if (!acceptedToken && !nsPub) {
      try {
        const urlObj = new URL(req.originalUrl || req.url || '/', `${req.protocol || 'http'}://${req.headers.host || 'localhost'}`);
        const qpNs = urlObj.searchParams.get('ns');
        if (qpNs) {
          nsPub = qpNs.slice(0,64);
        }
      } catch {}
    }

    if (acceptedToken) {
      nsPub = acceptedToken;
      try {
        if (store) {
          const adm = await store.get(acceptedToken, 'adminToken', null);
          if (adm) nsAdmin = adm;
        }
      } catch {}
    } else if (!nsAdmin && nsPub && store) {
      try {
        if (hostedMode) {
          const meta = await store.get(nsPub, 'meta', null);
          if (!meta) nsPub = null;
        }
        if (nsPub) {
          const adm = await store.get(nsPub, 'adminToken', null);
          if (adm) nsAdmin = adm;
        }
      } catch {}
    }

    req.ns = { admin: nsAdmin || null, pub: nsPub || null };

    try {
      if (process.env.GETTY_MULTI_TENANT_WALLET === '1' && req.walletSession && req.walletSession.walletHash) {
        if (!req.ns.admin) {
          req.ns.admin = req.walletSession.walletHash;
        }
      }
    } catch {}

    try {
      const hasAdminCookie = !!req.cookies?.[ADMIN_COOKIE];
      const isAdminPresented = hasAdminCookie || (presentedRole === 'admin');
      req.auth = {
        isAdmin: !!isAdminPresented,
        source: incomingToken ? 'token' : (hasAdminCookie ? 'admin-cookie' : (req.cookies?.[PUBLIC_COOKIE] ? 'public-cookie' : null)),
        tokenRole: presentedRole
      };
    } catch {}

    try {
      if (process.env.GETTY_MULTI_TENANT_WALLET === '1' && req.walletSession && req.walletSession.walletHash) {
        if (req.ns && req.ns.admin === req.walletSession.walletHash) {
          if (!req.auth) req.auth = {};
          if (!req.auth.isAdmin) {
            req.auth.isAdmin = true;
            req.auth.source = req.auth.source || 'wallet-session';
            req.auth.tokenRole = req.auth.tokenRole || 'admin';
          }

          try {
            if (!req.cookies?.[ADMIN_COOKIE]) {
              const cookieOpts = {
                httpOnly: true,
                sameSite: 'Lax',
                secure: SECURE_COOKIE(),
                path: '/',
                maxAge: parseInt(process.env.SESSION_TTL_SECONDS || '259200', 10) * 1000
              };
              res.cookie(ADMIN_COOKIE, req.ns.admin, cookieOpts);
            }
          } catch {}
        }
      }
    } catch {}

    try {
      if (acceptedToken) {
        const cookieOpts = {
          httpOnly: true,
          sameSite: 'Lax',
          secure: SECURE_COOKIE(),
          path: '/',
          maxAge: parseInt(process.env.SESSION_TTL_SECONDS || '259200', 10) * 1000
        };
        res.cookie(PUBLIC_COOKIE, acceptedToken, cookieOpts);

        if (req.auth && req.auth.isAdmin && nsAdmin) {
          res.cookie(ADMIN_COOKIE, nsAdmin, cookieOpts);
        }

        const isQueryToken = !!qToken;
        const isIdempotent = req.method === 'GET' || req.method === 'HEAD';
        const isApi = typeof req.path === 'string' && req.path.startsWith('/api/');
        const accept = req.accepts(['html','json','text']);
        const isHtmlLike = accept === 'html' || accept === 'text';
        if (isQueryToken && isIdempotent && !isApi && isHtmlLike) {
          try {
            const base = `${req.protocol}://${req.get('host')}`;
            const u = new URL(req.originalUrl || '/', base);
            u.searchParams.delete('token');
            const cleaned = u.pathname + (u.searchParams.toString() ? `?${u.searchParams.toString()}` : '');
            if (cleaned !== req.originalUrl) {
              return res.redirect(302, cleaned);
            }
          } catch {}
        }
      }
    } catch {}
  } catch { req.ns = { admin: null, pub: null }; }
  next();
});

app.use((req, res, next) => {
  try {
    if (req.query && typeof req.query.tenant === 'string' && req.query.tenant.trim()) {
      const tenantHash = req.query.tenant.trim();
      if (/^[a-f0-9]{16,64}$/i.test(tenantHash)) {
        req.tenant = { walletHash: tenantHash };
      }
    }
  } catch {}
  next();
});


try {
  const ENABLE_CSRF = process.env.GETTY_ENABLE_CSRF === '1';
  const CSRF_HEADER = (process.env.GETTY_CSRF_HEADER || 'x-csrf-token').toLowerCase();
  const ENABLE_ADMIN_RL = process.env.GETTY_ENABLE_ADMIN_RL === '1';
  const crypto = require('crypto');
  const { isTrustedLocalAdmin } = (() => {
    try { return require('./lib/trust'); } catch { return { isTrustedLocalAdmin: () => false }; }
  })();

  const __csrfTokenByAdminNs = new Map();

  function getOrCreateCsrf(adminNs) {
    if (!adminNs) return null;
    let tok = __csrfTokenByAdminNs.get(adminNs);
    if (!tok) {
      tok = crypto.randomBytes(32).toString('base64url');
      __csrfTokenByAdminNs.set(adminNs, tok);
    }
    return tok;
  }

  if (ENABLE_CSRF) {
    app.get('/api/admin/csrf', async (req, res) => {
      try {
        const adminNs = await resolveAdminNsFromReq(req);
        if (!adminNs) return res.status(401).json({ error: 'admin_session_required' });
        const token = getOrCreateCsrf(adminNs);
        return res.json({ csrfToken: token });
      } catch (e) {
        return res.status(500).json({ error: 'failed_to_generate_csrf', details: e?.message });
      }
    });
  }

  app.get('/api/publicToken', async (req, res) => {
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (!ns || !store) return res.status(400).json({ error: 'no_session' });
      let publicToken = await store.get(ns, 'publicToken', null);
      if (!publicToken) {
        publicToken = ns;
        await store.set(ns, 'publicToken', publicToken);
      }
      res.json({ publicToken });
    } catch (e) {
      res.status(500).json({ error: 'failed_to_get_public_token', details: e?.message });
    }
  });

  let adminWriteLimiter = null;
  if (ENABLE_ADMIN_RL) {
    const max = parseInt(process.env.GETTY_ADMIN_RL_MAX || '30', 10);
    const windowMs = parseInt(process.env.GETTY_ADMIN_RL_WINDOW_MS || '60000', 10);
    adminWriteLimiter = rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false });
  }

  app.use(async (req, res, next) => {
    try {
      const method = req.method || 'GET';
      const isUnsafe = /^(POST|PUT|PATCH|DELETE)$/i.test(method);
      const isApi = typeof req.path === 'string' && req.path.startsWith('/api/');
      if (!isApi || !isUnsafe) return next();

      if (req.path === '/api/auth/wander/nonce' ||
          req.path === '/api/auth/wander/verify' ||
          req.path === '/api/auth/wander/logout') {
        return next();
      }

      const adminNs = await resolveAdminNsFromReq(req);
      if (!adminNs) return next();

      if (adminWriteLimiter) {
        return adminWriteLimiter(req, res, () => {
          if (!ENABLE_CSRF) return next();
          try {
            if (isTrustedLocalAdmin && isTrustedLocalAdmin(req)) return next();
          } catch {}
          const presented = (req.headers[CSRF_HEADER] || '').toString();
            const expected = getOrCreateCsrf(adminNs);
            if (!presented || presented !== expected) {
              return res.status(403).json({ error: 'invalid_csrf', header: CSRF_HEADER });
            }
          return next();
        });
      }

      if (ENABLE_CSRF) {
        try { if (isTrustedLocalAdmin && isTrustedLocalAdmin(req)) return next(); } catch {}
        const presented = (req.headers[CSRF_HEADER] || '').toString();
        const expected = getOrCreateCsrf(adminNs);
        if (!presented || presented !== expected) {
          return res.status(403).json({ error: 'invalid_csrf', header: CSRF_HEADER });
        }
      }
      return next();
    } catch (e) {
      return res.status(500).json({ error: 'csrf_middleware_error', details: e?.message });
    }
  });
} catch {}

const __requestTimestamps = [];
const __bytesEvents = [];
const __activityLog = [];
const __moduleUptime = {};
const __MAX_ACTIVITY = 2000;
const __auditLog = [];
const __MAX_AUDIT = 3000;
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
    const __sanitizeUrl = (u) => {
      try {
        const s = String(u || '');

        return s.replace(/([?&]token=)[^&#]+/gi, '$1[REDACTED]');
      } catch { return u; }
    };
    const __safeUrl = __sanitizeUrl(req.originalUrl);
    const entry = { ts: start, level: 'info', method: req.method, url: __safeUrl, message: `${req.method} ${__safeUrl}` };
    __activityLog.push(entry);
    if (__activityLog.length > __MAX_ACTIVITY) __activityLog.splice(0, __activityLog.length - __MAX_ACTIVITY);
    res.on('finish', () => {
      try {
        entry.status = res.statusCode;
        entry.durationMs = Date.now() - start;
        if (typeof entry.message === 'string') {
          entry.message = `${req.method} ${__safeUrl} -> ${res.statusCode} in ${entry.durationMs}ms`;
        }
      } catch {}
    });
  } catch {}
  next();
});

const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
const strictLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });

try {
  const ENABLE_AUDIT = process.env.GETTY_ENABLE_AUDIT === '1';
  if (ENABLE_AUDIT) {
    app.use(async (req, _res, next) => {
      try {
        const m = req.method || 'GET';
        const unsafe = /^(POST|PUT|PATCH|DELETE)$/i.test(m);
        if (!unsafe) return next();
        if (!req.path || !req.path.startsWith('/api/')) return next();
        const adminNs = await resolveAdminNsFromReq(req);
        if (!adminNs) return next();
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const keys = Object.keys(body).slice(0, 25);
        __auditLog.push({ ts: Date.now(), adminNs, route: req.path, method: m, keys, ip: req.anonymizedIp || '' });
        if (__auditLog.length > __MAX_AUDIT) __auditLog.splice(0, __auditLog.length - __MAX_AUDIT);
      } catch {}
      return next();
    });
    app.get('/api/admin/audit', async (req, res) => {
      try {
        const adminNs = await resolveAdminNsFromReq(req);
        if (!adminNs) return res.status(401).json({ error: 'admin_session_required' });
        const limit = Math.min(parseInt(req.query.limit,10)||200, 1000);
        const out = __auditLog.slice(-limit).reverse();
        res.json({ items: out, total: __auditLog.length });
      } catch (e) {
        res.status(500).json({ error: 'audit_read_failed', details: e?.message });
      }
    });
  }
} catch {}

let wss;
try { wss = new WebSocket.Server({ noServer: true }); }
catch { wss = new (function(){ return function StubWSS(){ this.clients=new Set(); this.on=()=>{}; this.handleUpgrade=(_r,_s,_h,cb)=>{ if(cb) cb({}); }; this.emit=()=>{}; this.close=()=>{}; }; })(); }

let __pendingNsQueue = new Map();
wss.broadcast = function(nsToken, payload) {
  try {
    if (payload === null || typeof payload === 'undefined') return;
    const data = JSON.stringify(payload);
    if (nsToken) {
      let delivered = 0;
      wss.clients.forEach(client => {
        try {
          if (!client || client.readyState !== 1) return;
          if (client.nsToken !== nsToken) return;
          client.send(data);
          delivered++;
        } catch {}
      });
      if (delivered === 0) {
        const arr = __pendingNsQueue.get(nsToken) || [];
        arr.push(data);
        __pendingNsQueue.set(nsToken, arr.slice(-25));
      }
      if (process.env.NODE_ENV === 'test') {
        // try { console.warn('[wss.broadcast]', { nsToken, delivered, queued: delivered === 0 }); } catch {}
      }
    } else {
      wss.clients.forEach(client => { try { if (client && client.readyState === 1) client.send(data); } catch {} });
    }
  } catch (e) { console.error('broadcast error', e); }
};

let __arPriceCache = { usd: 0, ts: 0, source: 'none', providersTried: [] };
let __arPriceFetchPromise = null;
async function getArUsdCached(_force = false) {
  try {
    if (process.env.NODE_ENV === 'test') {
      return { usd: 0, ts: Date.now(), source: 'test', providersTried: ['test'] };
    }
    const now = Date.now();
    const MAX_AGE_MS = 60 * 1000;
    if (!_force && __arPriceCache.usd > 0 && (now - __arPriceCache.ts) < MAX_AGE_MS) {
      return __arPriceCache;
    }

    if (!__arPriceFetchPromise) {
      __arPriceFetchPromise = (async () => {
        const axios = require('axios');
        const tried = [];
        let price = 0; let source = 'none';

        try {
          tried.push('coingecko');
          const r = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
            timeout: 3500,
            params: { ids: 'arweave', vs_currencies: 'usd' }
          });
          const v = r?.data?.arweave?.usd;
          if (typeof v === 'number' && v > 0) { price = v; source = 'coingecko'; }
        } catch {}

        if (!(price > 0)) {
          try {
            tried.push('kucoin');
            const r = await axios.get('https://api.kucoin.com/api/v1/market/orderbook/level1', {
              timeout: 3000,
              params: { symbol: 'AR-USDT' }
            });
            const v = Number(r?.data?.data?.price);
            if (v > 0) { price = v; source = 'kucoin'; }
          } catch {}
        }

        if (!(price > 0)) {
          try {
            tried.push('coinpaprika');
            const r = await axios.get('https://api.coinpaprika.com/v1/tickers/arweave-ar', { timeout: 3000 });
            const v = Number(r?.data?.quotes?.USD?.price);
            if (v > 0) { price = v; source = 'coinpaprika'; }
          } catch {}
        }

        if (!(price > 0)) {
            const ccKey = process.env.CRYPTOCOMPARE_API_KEY || '';
            try {
              tried.push('cryptocompare');
              const headers = ccKey ? { authorization: `Apikey ${ccKey}` } : {};
              const r = await axios.get('https://min-api.cryptocompare.com/data/price', {
                timeout: 3000,
                params: { fsym: 'AR', tsyms: 'USD' },
                headers
              });
              const v = Number(r?.data?.USD);
              if (v > 0) { price = v; source = 'cryptocompare'; }
            } catch {}
        }

        if (!(price > 0)) {
          if (__arPriceCache.usd > 0) {
            price = __arPriceCache.usd;
            source = __arPriceCache.source === 'fallback' ? 'stale-cache' : (__arPriceCache.source || 'stale-cache');
          } else {
            price = 5;
            source = 'fallback';
          }
        }
        __arPriceCache = { usd: price, ts: Date.now(), source, providersTried: tried };
        return __arPriceCache;
      })();
      try {
        const result = await __arPriceFetchPromise;
        __arPriceFetchPromise = null;
        return result;
      } catch {
        __arPriceFetchPromise = null;
        if (__arPriceCache.usd > 0) return __arPriceCache;
        return { usd: 5, ts: Date.now(), source: 'fallback-error', providersTried: [] };
      }
    } else {
      try {
        const result = await __arPriceFetchPromise;
        return result;
      } catch {
        if (__arPriceCache.usd > 0) return __arPriceCache;
        return { usd: 5, ts: Date.now(), source: 'fallback-error', providersTried: [] };
      }
    }
  } catch {
    if (__arPriceCache.usd > 0) return __arPriceCache;
    return { usd: 5, ts: Date.now(), source: 'fallback-exception', providersTried: [] };
  }
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
const achievements = new AchievementsModule(wssBound, { store, liveviewsCfgFile: LIVEVIEWS_CONFIG_FILE });

try { global.gettyAchievementsInstance = achievements; } catch {}

try { global.gettyRaffleInstance = raffle; } catch {}
const announcementModule = new AnnouncementModule(wssBound, { store });
const chat = new ChatModule(wssBound);
const chatNs = new ChatNsManager(wssBound, store);

const announcementLimiters = { config: (_req,_res,next)=>next(), message: (_req,_res,next)=>next(), favicon: (_req,_res,next)=>next() };

app.get('/api/ar-price', async (req, res) => {
  try {
    const force = String(req.query.force || '').trim() === '1';
    const data = await getArUsdCached(force);
    res.json({
      arweave: { usd: data.usd },
      source: data.source,
      ts: data.ts,
      ageSeconds: Number(((Date.now() - data.ts) / 1000).toFixed(1)),
      providersTried: data.providersTried || []
    });
  } catch (e) {
    res.status(500).json({ error: 'failed_to_fetch_price', details: e?.message });
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

  const CHECK_LIVE_MS = Math.max(10000, Number(process.env.CHECK_LIVE_MS || 30000));

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
        achievements.onLiveStatusSample(null, nowLive, CHECK_LIVE_MS);
      } catch {}

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

  setInterval(() => { checkLiveOnce(); }, CHECK_LIVE_MS);

  const DEFAULT_ACH_MS = 300000; // 5 minutes
  const envMs = Number(process.env.ACHIEVEMENTS_POLL_MS || 0) || 0;
  const achIntervalMs = Math.max(15000, envMs || DEFAULT_ACH_MS);
  setInterval(() => { try { achievements.pollViewersOnce(null); } catch {} }, achIntervalMs);
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
      try {
        const raw = await store.get(ns, 'external-notifications-config', null);
        if (raw && typeof raw === 'object' && raw.__version && raw.data && typeof raw.data === 'object') return raw.data;
        return raw;
      } catch { return null; }
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
            try { achievements.onLiveStatusSample(ns, nowLive, POLL_MS); } catch {}
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

try {
  const legacyRemoved = [
    '/api/session/regenerate-public',
    '/api/session/revoke',
    '/api/session/status',
    '/api/session/public-token',
    '/api/session/export',
    '/api/session/import',
    '/api/session/new',
    '/new-session'
  ];
  legacyRemoved.forEach(p => {
    try {
      app.all(p, (_req, res) => {
        res.status(410).json({ error: 'legacy_removed', mode: 'wallet_only' });
      });
    } catch {}
  });
} catch {}

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

  try {
    const autostartDisabled = process.env.GETTY_CHAT_AUTOSTART === '0';
    const hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
    const debugAutostart = process.env.GETTY_CHAT_AUTOSTART_DEBUG === '1';
    if (!autostartDisabled && !hostedMode) {
      const status = typeof chat.getStatus === 'function' ? chat.getStatus() : { active: false, connected: false };
      const hasExplicitConfig = fs.existsSync(CHAT_CONFIG_FILE);
      const alreadyActive = !!(status && (status.active || status.connected));
      if (debugAutostart) console.warn('[Chat][Autostart] begin check', { autostartDisabled, hostedMode, hasExplicitConfig, alreadyActive });
      if (!hasExplicitConfig && !alreadyActive) {
        let claimId = '';

        try {
          const shPath = path.join(process.cwd(), 'config', 'stream-history-config.json');
          if (fs.existsSync(shPath)) {
            const raw = JSON.parse(fs.readFileSync(shPath, 'utf8'));
            if (raw && typeof raw === 'object') {
              if (typeof raw.claimid === 'string' && raw.claimid.trim()) claimId = raw.claimid.trim();
              else if (raw.data && typeof raw.data.claimid === 'string' && raw.data.claimid.trim()) claimId = raw.data.claimid.trim();
            }
          }
        } catch (e) { if (debugAutostart) console.warn('[Chat][Autostart] stream-history parse error', e?.message); }
        if (!claimId) {
          try {
            const lvPath = path.join(process.cwd(), 'config', 'liveviews-config.json');
            if (fs.existsSync(lvPath)) {
              const raw = JSON.parse(fs.readFileSync(lvPath, 'utf8'));
              if (raw && typeof raw === 'object') {
                if (typeof raw.claimid === 'string' && raw.claimid.trim()) claimId = raw.claimid.trim();
                else if (raw.data && typeof raw.data.claimid === 'string' && raw.data.claimid.trim()) claimId = raw.data.claimid.trim();
              }
            }
          } catch (e) { if (debugAutostart) console.warn('[Chat][Autostart] liveviews parse error', e?.message); }
        }

        let directWs = '';
        try { if (process.env.ODYSEE_WS_URL && /^wss?:\/\//i.test(process.env.ODYSEE_WS_URL)) directWs = process.env.ODYSEE_WS_URL; } catch {}
        if (debugAutostart) console.warn('[Chat][Autostart] resolved inputs', { claimId: claimId ? claimId.slice(0,8)+'…' : '', directWs: directWs ? 'yes' : 'no' });
        if (directWs || claimId) {
          try {
            console.warn('[Chat] Autostart connecting', directWs ? '[env URL]' : '[claimId derived]', directWs || (claimId.slice(0, 8) + '…'));
            chat.updateChatUrl(directWs || claimId);
          } catch (e) {
            console.error('[Chat] Autostart failed:', e && e.message ? e.message : e);
          }
        } else if (debugAutostart) {
          console.warn('[Chat][Autostart] skipped: no claimId or env ODYSEE_WS_URL');
        }
      } else if (debugAutostart) {
        console.warn('[Chat][Autostart] not eligible', { hasExplicitConfig, alreadyActive });
      }
    } else if (debugAutostart) {
      console.warn('[Chat][Autostart] disabled or hosted', { autostartDisabled, hostedMode });
    }
  } catch {}

  try {
    const enableTenantAuto = process.env.GETTY_CHAT_AUTOSTART_TENANT === '1';
    const debugAutostart = process.env.GETTY_CHAT_AUTOSTART_DEBUG === '1';
    const inWalletMulti = process.env.GETTY_MULTI_TENANT_WALLET === '1';
    const hasRedis = !!process.env.REDIS_URL;
    if (enableTenantAuto && inWalletMulti && !hasRedis && chatNs) {
      const tenantRoot = path.join(process.cwd(), 'tenant');
      if (fs.existsSync(tenantRoot)) {
        const dirs = fs.readdirSync(tenantRoot, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).slice(0, 200);
        if (debugAutostart) console.warn('[Chat][Autostart][Tenant] scanning', { count: dirs.length });
        const startPromises = [];
        for (const ns of dirs) {
          const nsLabel = ns.slice(0,8)+'…';
          try {
            const cfgPath = path.join(tenantRoot, ns, 'config', 'chat-config.json');
            if (!fs.existsSync(cfgPath)) { continue; }
            const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
            const data = raw && raw.data ? raw.data : raw;
            const chatUrl = (data && typeof data.chatUrl === 'string') ? data.chatUrl : '';
            if (!chatUrl) { continue; }
            const st = chatNs.getStatus(ns) || {};
            if (st.connected) { if (debugAutostart) console.warn('[Chat][Autostart][Tenant] already connected', nsLabel); continue; }
            if (debugAutostart) console.warn('[Chat][Autostart][Tenant] starting ns', nsLabel);
            const p = chatNs.start(ns, chatUrl).catch(e => {
              if (debugAutostart) console.warn('[Chat][Autostart][Tenant] start promise rejected', nsLabel, e?.message);
              throw e;
            });
            startPromises.push(p);
          } catch (e) {
            if (debugAutostart) console.warn('[Chat][Autostart][Tenant] failed pre-start', nsLabel, e?.message);
          }
        }
        if (startPromises.length) {
          Promise.allSettled(startPromises).then(results => {
            try {
              const ok = results.filter(r => r.status === 'fulfilled').length;
              const fail = results.filter(r => r.status === 'rejected').length;
              if (debugAutostart) console.warn('[Chat][Autostart][Tenant] completed', { ok, fail });
            } catch {}
          });
        } else if (debugAutostart) {
          console.warn('[Chat][Autostart][Tenant] no eligible tenants to start');
        }
      } else if (debugAutostart) {
        console.warn('[Chat][Autostart][Tenant] no tenant dir');
      }
    } else if (debugAutostart) {
      console.warn('[Chat][Autostart][Tenant] skipped', { enableTenantAuto, inWalletMulti, hasRedis, hasChatNs: !!chatNs });
    }
  } catch {}
}

registerTtsRoutes(app, wss, limiter, { store });
registerSocialMediaRoutes(app, socialMediaModule, strictLimiter, { store });

registerLastTipRoutes(app, lastTip, tipWidget, { store, wss, tipGoal });

try {
  const { getStatus, claimOwnerToken, rotateOwnerToken, extractOwnerTokenFromReq, loadOwnerToken } = require('./lib/owner');
  app.get('/api/owner/status', async (req, res) => {
    try {
      const st = await getStatus(store);
      let isOwner = false;
      try {
        const candidate = extractOwnerTokenFromReq(req);
        const existing = await loadOwnerToken(store);
        isOwner = !!(existing.token && candidate === existing.token);
      } catch {}
      const out = { claimed: st.claimed, envImmutable: st.envImmutable };
      if (st.claimed && isOwner) out.tokenPreview = st.tokenPreview;
      if (!st.claimed) out.claimable = true;
      return res.json(out);
    } catch { return res.status(500).json({ error: 'owner_status_failed' }); }
  });
  app.post('/api/owner/claim', async (req, res) => {
    try {
      const existing = await loadOwnerToken(store);
      if (existing.token) return res.status(400).json({ error: 'already_claimed' });
      if (process.env.GETTY_OWNER_TOKEN) return res.status(400).json({ error: 'env_defined' });
      const desired = typeof req.body?.token === 'string' ? req.body.token : null;
      const result = await claimOwnerToken(store, desired);
      if (!result.ok) return res.status(500).json({ error: 'claim_failed' });
      return res.json({ success: true, token: result.token });
    } catch (e) { return res.status(500).json({ error: 'claim_failed', details: e?.message }); }
  });
  app.post('/api/owner/rotate', async (req, res) => {
    try {
      const oldToken = typeof req.body?.oldToken === 'string' ? req.body.oldToken : '';
      const result = await rotateOwnerToken(store, oldToken);
      if (!result.ok) return res.status(400).json({ error: result.error || 'rotate_failed' });
      return res.json({ success: true, token: result.token });
    } catch (e) { return res.status(500).json({ error: 'rotate_failed', details: e?.message }); }
  });
} catch {}

try { if (walletAuth && walletAuth.registerWalletAuthRoutes) walletAuth.registerWalletAuthRoutes(app); } catch {}

try {
  if (process.env.GETTY_MULTI_TENANT_WALLET === '1') {
    app.post('/api/auth/wander', (req,res)=>{
      return res.status(410).json({ error: 'deprecated_endpoint', use: '/api/auth/wander/nonce + /api/auth/wander/verify' });
    });

    const wanderWindowMs = parseInt(process.env.GETTY_WANDER_RL_WINDOW_MS || '60000', 10);
    const wanderNonceMax = parseInt(process.env.GETTY_WANDER_RL_NONCE_MAX || '30', 10);
    const wanderVerifyMax = parseInt(process.env.GETTY_WANDER_RL_VERIFY_MAX || '20', 10);
    const wanderRateLimit = require('express-rate-limit');
    const wanderNonceLimiter = wanderRateLimit({ windowMs: wanderWindowMs, max: wanderNonceMax, legacyHeaders: false, standardHeaders: true });
    const wanderVerifyLimiter = wanderRateLimit({ windowMs: wanderWindowMs, max: wanderVerifyMax, legacyHeaders: false, standardHeaders: true });

  const { issueNonce } = walletAuth;

    app.post('/api/auth/wander/nonce', wanderNonceLimiter, express.json(), async (req,res)=>{
      try {
        if (!walletAuth) return res.status(503).json({ error: 'wallet_auth_disabled' });
        const address = (req.body && req.body.address) ? String(req.body.address).trim() : '';
        if (!/^[A-Za-z0-9_-]{43,64}$/.test(address)) return res.status(400).json({ error: 'invalid_address_format' });
        const domain = process.env.GETTY_LOGIN_DOMAIN || (req.headers.host || 'localhost');
        const { nonce, issuedAt, expiresAt, message } = issueNonce(address, { domain });
        return res.json({ address, nonce, issuedAt, expiresAt, message, domain });
      } catch (e) { return res.status(500).json({ error: 'wander_nonce_failed', details: e?.message }); }
    });

    const { verifyWander } = require('./lib/wander-verify');
    app.post('/api/auth/wander/verify', wanderVerifyLimiter, express.json(), async (req,res)=>{
      try {
        const result = await verifyWander(req.body || {}, {
          walletAuth,
          reqHost: req.headers.host,
          allowDummy: process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY === '1' && process.env.NODE_ENV === 'test',
          loginDomain: process.env.GETTY_LOGIN_DOMAIN
        });
        const ttl = result.session.exp - result.session.iat;

        if (store && result.response.widgetToken && result.session.walletHash) {
          try {
            await store.set(result.response.widgetToken, 'walletHash', result.session.walletHash, { ttl: Math.ceil(ttl / 1000) });
          } catch (e) {
            console.warn('Failed to store widget token:', e.message);
          }
        }
        res.cookie('getty_wallet_session', result.signed, {
          httpOnly: true,
          sameSite: 'lax',
            secure: process.env.COOKIE_SECURE === '1' || process.env.NODE_ENV === 'production',
          maxAge: ttl
        });
        return res.json(result.response);
      } catch (e) {
        const code = e && e.code ? e.code : 'wander_verify_failed';
        const http = e && e.http ? e.http : (code === 'bad_signature' ? 401 : 400);
        return res.status(http).json({ error: code, details: e?.message && e.code !== e.message ? e.message : undefined });
      }
    });

    app.get('/api/auth/wander/me', (req,res)=>{
      try {
        if (!req.walletSession) return res.status(401).json({ error: 'no_session' });
        const s = req.walletSession;
        return res.json({ address: s.addr, walletHash: s.walletHash, expiresAt: new Date(s.exp).toISOString(), capabilities: s.caps, mode: 'wander-bridge' });
      } catch (e) { return res.status(500).json({ error: 'wander_me_failed', details: e?.message }); }
    });

    app.post('/api/auth/wander/logout', (req,res)=>{
      try {
        res.clearCookie('getty_wallet_session');
        return res.json({ success: true });
      } catch (e) { return res.status(500).json({ error: 'wander_logout_failed', details: e?.message }); }
    });
  }
} catch {}
if (!fs.existsSync(GOAL_AUDIO_UPLOADS_DIR)) {
    fs.mkdirSync(GOAL_AUDIO_UPLOADS_DIR, { recursive: true });
}

const goalAudioStorage = multer.diskStorage({
  destination: function (req, _file, cb) {
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      let target = GOAL_AUDIO_UPLOADS_DIR;
      if (ns) {
        const safe = ns.replace(/[^a-zA-Z0-9_-]/g, '_');
        target = path.join(GOAL_AUDIO_UPLOADS_DIR, safe);
      }
      if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
      try {
        const files = fs.readdirSync(target);
        files.forEach(oldFile => {
          if (oldFile.startsWith('goal-audio')) {
            fs.unlinkSync(path.join(target, oldFile));
          }
        });
      } catch (error) {
        console.error('Error cleaning old audio files:', error);
      }
      cb(null, target);
    } catch (e) {
      console.error('Error preparing goal audio upload dir:', e);
      cb(null, GOAL_AUDIO_UPLOADS_DIR);
    }
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
registerAchievementsRoutes(app, achievements, strictLimiter, { store });
registerUserRoutes(app, { store });

app.post('/api/chat/test-message', limiter, async (req, res) => {
  try {
    const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
    const shouldRequireSession = requireSessionFlag || !!process.env.REDIS_URL;
    const ns = req?.ns?.admin || req?.ns?.pub || null;
    if (shouldRequireSession && !ns) return res.status(401).json({ error: 'session_required' });

    const body = req.body || {};
    const username = (typeof body.username === 'string' && body.username.trim()) ? body.username.trim() : 'TestUser';
    const donationOnly = !!body.donationOnly;
    const rawCredits = Number(body.credits);
    let credits = Number.isFinite(rawCredits) ? rawCredits : 0;
    if (donationOnly && credits <= 0) credits = 5;
    if (!donationOnly && credits < 0) credits = 0;
    const avatar = (typeof body.avatar === 'string' && body.avatar.trim()) ? body.avatar.trim() : undefined;

  let rateObj = null;
  try { rateObj = await getArUsdCached(false); } catch {}
  const rate = (rateObj && rateObj.usd) ? rateObj.usd : 5;
  const isTip = credits > 0;
  const usdAmount = isTip ? credits : 0;
  const arAmount = isTip ? (usdAmount / (rate || 5)) : 0;
  const chatMsg = {
      channelTitle: username,
     
      credits,
      creditsIsUsd: isTip,
      isChatTip: isTip,
      usdAmount: isTip ? Number(usdAmount.toFixed(2)) : undefined,
      arAmount: isTip ? Number(arAmount.toFixed(6)) : undefined,
      rateUsed: isTip ? rate : undefined,
      ...(avatar ? { avatar } : {}),
      timestamp: new Date().toISOString()
    };

    if (typeof wss.broadcast === 'function' && ns) {

      const adminNs = await resolveAdminNsFromReq(req) || ns;
      wss.broadcast(adminNs, { type: 'chatMessage', data: chatMsg });
    try { achievements.onChatMessage(adminNs, chatMsg); } catch {}
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

app.get('/widgets/persistent-notifications', (req, res, next) => {
  try {
    const filePath = path.join(__dirname, 'public', 'widgets', 'persistent-notifications.html');
    const nonce = res.locals?.cspNonce || '';
    let html = fs.readFileSync(filePath, 'utf8');
    if (nonce && !/property=["']csp-nonce["']/.test(html)) {
      const meta = `<meta property="csp-nonce" nonce="${nonce}">`;
      const patch = `<script src="/js/nonce-style-patch.js" nonce="${nonce}" defer></script>`;
      html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}\n    ${patch}`);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try { if (nonce) res.setHeader('X-CSP-Nonce', nonce); } catch {}
    return res.send(html);
  } catch { return next(); }
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
    },
    achievements: {
      name: "Achievements",
      url: `${baseUrl}/widgets/achievements`,
      params: { position: "top-right", width: 380, height: 120 }
    }
  };
  
  res.json(widgets);
});

app.get('/widgets/last-tip', (req, res, next) => {
  try {
    const filePath = path.join(__dirname, 'public', 'widgets', 'last-tip.html');
    const nonce = res.locals?.cspNonce || '';
    let html = fs.readFileSync(filePath, 'utf8');
    if (nonce && !/property=["']csp-nonce["']/.test(html)) {
      const meta = `<meta property="csp-nonce" nonce="${nonce}">`;
      const patch = `<script src="/js/nonce-style-patch.js" nonce="${nonce}" defer></script>`;
      html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}\n    ${patch}`);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try { if (nonce) res.setHeader('X-CSP-Nonce', nonce); } catch {}
    return res.send(html);
  } catch { return next(); }
});

app.get('/widgets/tip-goal', (req, res, next) => {
  try {
    const filePath = path.join(__dirname, 'public', 'widgets', 'tip-goal.html');
    const nonce = res.locals?.cspNonce || '';
    let html = fs.readFileSync(filePath, 'utf8');
    if (nonce && !/property=["']csp-nonce["']/.test(html)) {
      const meta = `<meta property="csp-nonce" nonce="${nonce}">`;
      const patch = `<script src="/js/nonce-style-patch.js" nonce="${nonce}" defer></script>`;
      html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}\n    ${patch}`);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try { if (nonce) res.setHeader('X-CSP-Nonce', nonce); } catch {}
    return res.send(html);
  } catch { return next(); }
});

app.get('/widgets/tip-notification', (req, res, next) => {
  try {
    const filePath = path.join(__dirname, 'public', 'widgets', 'tip-notification.html');
    const nonce = res.locals?.cspNonce || '';
    let html = fs.readFileSync(filePath, 'utf8');
    if (nonce && !/property=["']csp-nonce["']/.test(html)) {
      const meta = `<meta property="csp-nonce" nonce="${nonce}">`;
      const patch = `<script src="/js/nonce-style-patch.js" nonce="${nonce}" defer></script>`;
      html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}\n    ${patch}`);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try { if (nonce) res.setHeader('X-CSP-Nonce', nonce); } catch {}
    return res.send(html);
  } catch { return next(); }
});

try { registerTipNotificationRoutes(app, limiter, { wss, store }); } catch {}
try { registerTipNotificationGifRoutes(app, limiter, { store }); } catch {}

app.get('/widgets/chat', (req, res, next) => {
  try {
    const filePath = path.join(__dirname, 'public', 'widgets', 'chat.html');
    const nonce = res.locals?.cspNonce || '';
    let html = fs.readFileSync(filePath, 'utf8');
    if (nonce && !/property=["']csp-nonce["']/.test(html)) {
      const meta = `<meta property="csp-nonce" nonce="${nonce}">`;
      const patch = `<script src="/js/nonce-style-patch.js" nonce="${nonce}" defer></script>`;
      html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}\n    ${patch}`);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try { if (nonce) res.setHeader('X-CSP-Nonce', nonce); } catch {}
    return res.send(html);
  } catch { return next(); }
});
app.get('/widgets/announcement', (req, res, next) => {
  try {
    const filePath = path.join(__dirname, 'public', 'widgets', 'announcement.html');
    const nonce = res.locals?.cspNonce || '';
    let html = fs.readFileSync(filePath, 'utf8');
    if (nonce && !/property=["']csp-nonce["']/.test(html)) {
      const meta = `<meta property="csp-nonce" nonce="${nonce}">`;
      const patch = `<script src="/js/nonce-style-patch.js" nonce="${nonce}" defer></script>`;
      html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}\n    ${patch}`);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try { if (nonce) res.setHeader('X-CSP-Nonce', nonce); } catch {}
    return res.send(html);
  } catch { return next(); }
});

app.get('/widgets/achievements', (req, res, next) => {
  try {
    const filePath = path.join(__dirname, 'public', 'widgets', 'achievements.html');
    const nonce = res.locals?.cspNonce || '';
    let html = fs.readFileSync(filePath, 'utf8');
    if (nonce && !/property=["']csp-nonce["']/.test(html)) {
      const meta = `<meta property="csp-nonce" nonce="${nonce}">`;
      const patch = `<script src="/js/nonce-style-patch.js" nonce="${nonce}" defer></script>`;
      html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}\n    ${patch}`);
    }

    if (nonce) {
      html = html.replace(/<style(\s[^>]*)?>/gi, function (m) {
        return m.includes('nonce=') ? m : m.replace('<style', `<style nonce="${nonce}"`);
      });
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try { if (nonce) res.setHeader('X-CSP-Nonce', nonce); } catch {}
    return res.send(html);
  } catch { return next(); }
});

app.get('/api/channel/avatar', async (req, res) => {
  try {
    const claimId = String(req.query.claimId || '').trim();
    if (!claimId) return res.status(400).json({ error: 'missing_claimId' });
  const out = await chatNs._fetchChannelAvatar(claimId);
    res.json({ avatar: out.avatar || null, title: out.title || null });
  } catch (e) {
    res.status(500).json({ error: 'failed_to_fetch_avatar', details: e?.message });
  }
});

app.get('/widgets/giveaway', (req, res, next) => {
  try {
    const filePath = path.join(__dirname, 'public', 'widgets', 'giveaway.html');
    const nonce = res.locals?.cspNonce || '';
    let html = fs.readFileSync(filePath, 'utf8');
    if (nonce && !/property=["']csp-nonce["']/.test(html)) {
      const meta = `<meta property="csp-nonce" nonce="${nonce}">`;
      const patch = `<script src="/js/nonce-style-patch.js" nonce="${nonce}" defer></script>`;
      html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}\n    ${patch}`);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try { if (nonce) res.setHeader('X-CSP-Nonce', nonce); } catch {}
    return res.send(html);
  } catch { return next(); }
});

app.get('/obs-help', (req, res, next) => {
  try {
    const filePath = path.join(__dirname, 'public', 'obs-integration.html');
    const nonce = res.locals?.cspNonce || '';
    let html = fs.readFileSync(filePath, 'utf8');
    if (nonce && !/property=["']csp-nonce["']/.test(html)) {
      const meta = `<meta property="csp-nonce" nonce="${nonce}">`;
      const patch = `<script src="/js/nonce-style-patch.js" nonce="${nonce}" defer></script>`;
      html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}\n    ${patch}`);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try { if (nonce) res.setHeader('X-CSP-Nonce', nonce); } catch {}
    return res.send(html);
  } catch { return next(); }
});

app.get('/widgets/socialmedia', (req, res, next) => {
  try {
    const filePath = path.join(__dirname, 'public', 'widgets', 'socialmedia.html');
    const nonce = res.locals?.cspNonce || '';
    let html = fs.readFileSync(filePath, 'utf8');
    if (nonce && !/property=["']csp-nonce["']/.test(html)) {
      const meta = `<meta property="csp-nonce" nonce="${nonce}">`;
      const patch = `<script src="/js/nonce-style-patch.js" nonce="${nonce}" defer></script>`;
      html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}\n    ${patch}`);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try { if (nonce) res.setHeader('X-CSP-Nonce', nonce); } catch {}
    return res.send(html);
  } catch { return next(); }
});

app.get('/widgets/liveviews', (req, res, next) => {
  try {
    const filePath = path.join(__dirname, 'public', 'widgets', 'liveviews.html');
    const nonce = res.locals?.cspNonce || '';
    let html = fs.readFileSync(filePath, 'utf8');
    if (nonce && !/property=["']csp-nonce["']/.test(html)) {
      const meta = `<meta property="csp-nonce" nonce="${nonce}">`;
      const patch = `<script src="/js/nonce-style-patch.js" nonce="${nonce}" defer></script>`;
      html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}\n    ${patch}`);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try { if (nonce) res.setHeader('X-CSP-Nonce', nonce); } catch {}
    return res.send(html);
  } catch { return next(); }
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
  destination: function (req, _file, cb) {
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      const safe = ns ? ns.replace(/[^a-zA-Z0-9_-]/g, '_') : '';
      const target = ns ? path.join(AUDIO_UPLOADS_DIR, safe) : AUDIO_UPLOADS_DIR;
      if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
      try {
        const existing = path.join(target, 'custom-notification-audio.mp3');
        if (fs.existsSync(existing)) fs.unlinkSync(existing);
      } catch {}
      cb(null, target);
    } catch {
      cb(null, AUDIO_UPLOADS_DIR);
    }
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


registerAudioSettingsRoutes(app, wss, audioUpload, AUDIO_UPLOADS_DIR, AUDIO_CONFIG_FILE, { store });

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

try {
  app.get('/index.html', (req, res) => {
    res.redirect(301, '/');
  });
} catch {}

try {
  app.get('/', (req, res, next) => {
    try {
      const indexPath = path.join(__dirname, 'public', 'index.html');
      if (!fs.existsSync(indexPath)) return next();
      const nonce = res.locals?.cspNonce || '';
      let html = fs.readFileSync(indexPath, 'utf8');
      if (nonce && !/property=["']csp-nonce["']/.test(html)) {
        const meta = `<meta property="csp-nonce" nonce="${nonce}">`;
        const patch = `<script src="/js/nonce-style-patch.js" nonce="${nonce}" defer></script>`;
        html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}\n    ${patch}`);
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      try { if (nonce) res.setHeader('X-CSP-Nonce', nonce); } catch {}
      return res.send(html);
    } catch { return next(); }
  });
} catch {}

try {
  app.get(/^(?!\/admin)(.*\.html)$/i, (req, res, next) => {
    try {
      const reqPath = req.path.replace(/\/+/, '/');
      const unsafeFsPath = path.join(__dirname, 'public', reqPath);
      const publicDir = path.join(__dirname, 'public');
      const filePath = path.resolve(unsafeFsPath);
      if (!filePath.startsWith(publicDir + path.sep)) return next();
      if (!fs.existsSync(filePath)) return next();
      let html = fs.readFileSync(filePath, 'utf8');
      const nonce = res.locals?.cspNonce || '';
      if (nonce && !/property=["']csp-nonce["']/.test(html)) {
        const meta = `<meta property="csp-nonce" nonce="${nonce}">`;
        const patch = `<script src="/js/nonce-style-patch.js" nonce="${nonce}" defer></script>`;
        html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}\n    ${patch}`);
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      try { if (nonce) res.setHeader('X-CSP-Nonce', nonce); } catch {}
      return res.send(html);
    } catch { return next(); }
  });
} catch {}


app.use(express.static('public', {
  etag: true,
  lastModified: true,
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  try { if (res.locals?.cspNonce) res.setHeader('X-CSP-Nonce', res.locals.cspNonce); } catch {}
    }

    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
  }
}));

try {
  app.use((req, res, next) => {
    const send = res.send;
    res.send = function (body) {
      try {
        const ct = res.getHeader('Content-Type') || '';
        if (typeof body === 'string' && /text\/html/i.test(ct) && res.locals?.cspNonce) {
          if (!/property=["']csp-nonce["']/.test(body)) {
            const meta = `<meta property="csp-nonce" nonce="${res.locals.cspNonce}">`;
            body = body.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}`);
          }
        }

        try {
          const isProd = process.env.NODE_ENV === 'production';
          const keepSri = process.env.GETTY_KEEP_SRI_DEV === '1';
          if (!isProd && !keepSri && typeof body === 'string' && /text\/html/i.test(ct)) {
            body = body.replace(/\s+integrity=["'][^"']+["']/gi, '')
                       .replace(/\s+crossorigin=["'][^"']+["']/gi, '');
          }
        } catch {}
      } catch {}
      return send.call(this, body);
    };
    next();
  });
} catch {}

registerRaffleRoutes(app, raffle, wss, { store });

const __serverStartTime = Date.now();

try {
  app.get('/api/admin/tenant/config-status', async (req, res) => {
    try {
      if (!process.env.GETTY_MULTI_TENANT_WALLET === '1') {
        return res.status(400).json({ error: 'multi_tenant_disabled' });
      }
      const adminNs = await resolveAdminNsFromReq(req);
      if (!adminNs) return res.status(401).json({ error: 'admin_session_required' });

      if (!req.auth || !req.auth.isAdmin) return res.status(401).json({ error: 'admin_required' });

      const { loadTenantConfig, computeChecksum } = require('./lib/tenant-config');
      const fs = require('fs');
      const path = require('path');
      const baseTenantDir = path.join(process.cwd(), 'tenant', adminNs, 'config');
      const ensureMeta = (p) => {
        try {
          if (!fs.existsSync(p)) return null;
          const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
          const data = raw.data || raw;
          const checksum = raw.checksum || computeChecksum(data);
          return {
            filename: path.basename(p),
            exists: true,
            __version: raw.__version || null,
            updatedAt: raw.updatedAt || null,
            checksum,
            size: Buffer.byteLength(JSON.stringify(raw)),
            items: Array.isArray(data) ? data.length : (Array.isArray(data.messages) ? data.messages.length : undefined)
          };
        } catch (e) { return { filename: path.basename(p), error: e.message }; }
      };

  const annGlobal = path.join(process.cwd(), 'config', 'announcement-config.json');
  const socGlobal = path.join(process.cwd(), 'config', 'socialmedia-config.json');
  const tipGoalGlobal = path.join(process.cwd(), 'config', 'tip-goal-config.json');
  const lastTipGlobal = path.join(process.cwd(), 'config', 'last-tip-config.json');
  const raffleGlobal = path.join(process.cwd(), 'config', 'raffle-config.json');
  const achievementsGlobal = path.join(process.cwd(), 'config', 'achievements-config.json');
  const chatGlobal = path.join(process.cwd(), 'config', 'chat-config.json');
    const annTenant = path.join(baseTenantDir, 'announcement-config.json');
    const socTenant = path.join(baseTenantDir, 'socialmedia-config.json');
  const tipGoalTenant = path.join(baseTenantDir, 'tip-goal-config.json');
  const lastTipTenant = path.join(baseTenantDir, 'last-tip-config.json');
  const raffleTenant = path.join(baseTenantDir, 'raffle-config.json');
  const achievementsTenant = path.join(baseTenantDir, 'achievements-config.json');
  const chatTenant = path.join(baseTenantDir, 'chat-config.json');

  const annLoad = await loadTenantConfig({ ns: { admin: adminNs } }, store, annGlobal, 'announcement-config.json');
  const socLoad = await loadTenantConfig({ ns: { admin: adminNs } }, store, socGlobal, 'socialmedia-config.json');
  const tipGoalLoad = await loadTenantConfig({ ns: { admin: adminNs } }, store, tipGoalGlobal, 'tip-goal-config.json');
  const lastTipLoad = await loadTenantConfig({ ns: { admin: adminNs } }, store, lastTipGlobal, 'last-tip-config.json');
  const raffleLoad = await loadTenantConfig({ ns: { admin: adminNs } }, store, raffleGlobal, 'raffle-config.json');
  const achievementsLoad = await loadTenantConfig({ ns: { admin: adminNs } }, store, achievementsGlobal, 'achievements-config.json');
  const chatLoad = await loadTenantConfig({ ns: { admin: adminNs } }, store, chatGlobal, 'chat-config.json');

      const out = {
        namespace: adminNs,
        timestamp: new Date().toISOString(),
        configs: {
          announcement: {
            source: annLoad.source,
            tenantPath: annLoad.tenantPath || null,
            meta: ensureMeta(annTenant) || ensureMeta(annGlobal)
          },
          socialmedia: {
            source: socLoad.source,
            tenantPath: socLoad.tenantPath || null,
            meta: ensureMeta(socTenant) || ensureMeta(socGlobal)
          },
          tipGoal: {
            source: tipGoalLoad.source,
            tenantPath: tipGoalLoad.tenantPath || null,
            meta: ensureMeta(tipGoalTenant) || ensureMeta(tipGoalGlobal)
          },
          lastTip: {
            source: lastTipLoad.source,
            tenantPath: lastTipLoad.tenantPath || null,
            meta: ensureMeta(lastTipTenant) || ensureMeta(lastTipGlobal)
          },
          raffle: {
            source: raffleLoad.source,
            tenantPath: raffleLoad.tenantPath || null,
            meta: ensureMeta(raffleTenant) || ensureMeta(raffleGlobal)
          },
          achievements: {
            source: achievementsLoad.source,
            tenantPath: achievementsLoad.tenantPath || null,
            meta: ensureMeta(achievementsTenant) || ensureMeta(achievementsGlobal)
          },
          chat: {
            source: chatLoad.source,
            tenantPath: chatLoad.tenantPath || null,
            meta: ensureMeta(chatTenant) || ensureMeta(chatGlobal)
          }
        }
      };
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ error: 'config_status_failed', details: e?.message });
    }
  });
} catch {}

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

let __walletBalanceCache = new Map();
async function __fetchWalletBalance(arAddr) {
  try {
    if (!arAddr || typeof arAddr !== 'string') return null;
    const now = Date.now();
    const cached = __walletBalanceCache.get(arAddr);
    if (cached && (now - cached.ts) < 60000) return cached.ar;

    const axios = require('axios');
    const url = `https://arweave.net/wallet/${encodeURIComponent(arAddr)}/balance`;
    let winston = '0';
    try {
      const resp = await axios.get(url, { timeout: 3000 });
      if (resp && (typeof resp.data === 'string' || typeof resp.data === 'number')) {
        winston = String(resp.data).trim();
      }
    } catch {}
    if (!/^[0-9]+$/.test(winston)) winston = '0';
    const ar = Number((parseInt(winston, 10) / 1e12).toFixed(6));
    __walletBalanceCache.set(arAddr, { ts: now, ar });
    return ar;
  } catch { return null; }
}

async function __resolveWalletAddressForMetrics(req) {

  try {
    let addr = '';
    let tenant = null;
    try { tenant = require('./lib/tenant'); } catch {}

    const fs = require('fs');
    const LAST_TIP_CONFIG_FILE = require('path').join(process.cwd(), 'config', 'last-tip-config.json');
    if (tenant && typeof tenant.tenantEnabled === 'function' && tenant.tenantEnabled(req)) {
      try {
        const loaded = tenant.loadConfigWithFallback(req, LAST_TIP_CONFIG_FILE, 'last-tip-config.json');
        if (loaded && loaded.data && typeof loaded.data.walletAddress === 'string') addr = loaded.data.walletAddress.trim();
      } catch {}
    }
    if (!addr) {
      try {
        if (fs.existsSync(LAST_TIP_CONFIG_FILE)) {
          const raw = JSON.parse(fs.readFileSync(LAST_TIP_CONFIG_FILE, 'utf8'));
          if (raw && typeof raw.walletAddress === 'string') addr = raw.walletAddress.trim();
        }
      } catch {}
    }
    if (!addr) {
      try { if (typeof tipWidget?.getStatus === 'function') { const s = tipWidget.getStatus(); if (s?.walletAddress) addr = String(s.walletAddress).trim(); } } catch {}
    }
    if (!addr) {
      try { if (typeof tipGoal?.getStatus === 'function') { const s = tipGoal.getStatus(); if (s?.walletAddress) addr = String(s.walletAddress).trim(); } } catch {}
    }
    return addr || '';
  } catch { return ''; }
}

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

try {
  app.get('/shared-i18n/:lang.json', (req, res) => {
    try {
      const lang = String(req.params.lang || '').toLowerCase();
      const safe = (lang === 'es') ? 'es' : 'en';
      const file = path.join(process.cwd(), 'shared-i18n', `${safe}.json`);
      if (!fs.existsSync(file)) return res.status(404).json({ error: 'not_found' });
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.send(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      return res.status(500).json({ error: 'failed_to_load_i18n', details: e?.message });
    }
  });
} catch {}

app.get('/api/modules', async (req, res) => {

  if (req.query.widgetToken && store) {
    try {
      const walletHash = await store.get(req.query.widgetToken, 'walletHash');
      if (walletHash) {
        req.ns = req.ns || {};
        req.ns.pub = walletHash;
      }
    } catch (e) {
      console.warn('Failed to resolve widgetToken:', e.message);
    }
  }
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

  function __unwrapMaybe(o) {

    try {
      let cur = o;
      let safety = 0;
      while (
        cur && typeof cur === 'object' &&
        cur.data && typeof cur.data === 'object' &&
        (cur.__version || cur.checksum || cur.updatedAt || cur.data.__version || cur.data.checksum || cur.data.updatedAt) &&
        safety < 5
      ) {

        if (
          cur.data.walletAddress !== undefined ||
          cur.data.monthlyGoal !== undefined ||
          cur.data.currentAmount !== undefined ||
          cur.data.currentTips !== undefined ||
          cur.data.bgColor !== undefined
        ) {
          cur = cur.data;
        } else if (cur.data.data && typeof cur.data.data === 'object') {

          cur = cur.data.data;
        } else {
          cur = cur.data;
        }
        safety++;
      }
      return cur;
    } catch {}
    return o;
  }

  const TENANT_SCAN_TTL_MS = 30_000;
  if (!global.__gettyTenantConfigCache) global.__gettyTenantConfigCache = { files: {}, ts: 0 };
  function hasAnyTenantFile(basename) {
    try {
      const cache = global.__gettyTenantConfigCache;
      const now = Date.now();
      if ((now - cache.ts) > TENANT_SCAN_TTL_MS) {
        cache.files = {}; cache.ts = now;
        const tenantRoot = path.join(process.cwd(), 'tenant');
        if (fs.existsSync(tenantRoot)) {
          const dirs = fs.readdirSync(tenantRoot).filter(d => !d.startsWith('.') && fs.statSync(path.join(tenantRoot, d)).isDirectory());
          for (const d of dirs) {
            const cfgDir = path.join(tenantRoot, d, 'config');
            if (!fs.existsSync(cfgDir)) continue;
            try {
              const entries = fs.readdirSync(cfgDir);
              for (const f of entries) {
                cache.files[f] = true;
              }
            } catch {}
          }
        }
      }
      return !!cache.files[basename];
    } catch { return false; }
  }
  try {
    const chatLoad = await loadTenantConfig(req, store, CHAT_CONFIG_FILE, 'chat-config.json');
    if (chatLoad && chatLoad.data) {
      chatColors = chatLoad.data;
    }
  } catch {}

  try {
    const tipGoalLoad = await loadTenantConfig(req, store, TIP_GOAL_CONFIG_FILE, 'tip-goal-config.json');
    if (tipGoalLoad && tipGoalLoad.data) {
      tipGoalColors = __unwrapMaybe(tipGoalLoad.data);
    }
  } catch {}
  try {
    const lastTipLoad = await loadTenantConfig(req, store, LAST_TIP_CONFIG_FILE, 'last-tip-config.json');
    if (lastTipLoad && lastTipLoad.data) {
      lastTipColors = __unwrapMaybe(lastTipLoad.data);
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

  if (typeof tipGoal.getStatus === 'function') {
    try {
      // Wallet address loading is now handled inside the tipGoal payload above
    } catch {}
  }

  const payload = {
  lastTip: (async () => {
      try {

        try {
          const hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
          const hasSessionWallet = !!(req?.walletSession && req.walletSession.walletHash);
          if (hostedMode && hasSessionWallet && lastTip && (!lastTip.walletAddress || !String(lastTip.walletAddress).trim()) && typeof lastTip.loadWalletAddress === 'function') {
            await lastTip.loadWalletAddress(req);
          }
        } catch {}
        const base = lastTip.getStatus?.() || {};
        const merged = { ...base, ...lastTipColors };
        const __ltBaseWallet = typeof base.walletAddress === 'string' ? base.walletAddress.trim() : '';
        const __ltCfgWallet = typeof merged.walletAddress === 'string' ? merged.walletAddress.trim() : '';
        let __tgWallet = '';
        try { if (typeof tipGoal.getStatus === 'function') { const tg = tipGoal.getStatus(); if (tg && tg.walletAddress) __tgWallet = String(tg.walletAddress).trim(); } } catch {}
        if (!__tgWallet && typeof tipGoalColors.walletAddress === 'string') __tgWallet = tipGoalColors.walletAddress.trim();

        let __storeWallet = '';
        try {
          const hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
          const hasNsSession = !!(req?.ns?.admin || req?.ns?.pub);
          const nsSession = req?.ns?.admin || req?.ns?.pub || null;
          if (!__ltBaseWallet && !__ltCfgWallet && !__tgWallet && hostedMode && hasNsSession && store && nsSession) {
            let cfgObj = null;
            if (typeof store.getConfig === 'function') {
              try { cfgObj = await store.getConfig(nsSession, 'last-tip-config.json', null); } catch {}
            }
            if (!cfgObj) {
              try { cfgObj = await store.get(nsSession, 'last-tip-config', null); } catch {}
            }
            const data = cfgObj && cfgObj.data ? cfgObj.data : cfgObj;
            if (data && typeof data.walletAddress === 'string' && data.walletAddress.trim()) {
              __storeWallet = data.walletAddress.trim();
            }
          }
        } catch {}
        const __effLtWallet = __ltCfgWallet || __ltBaseWallet || __tgWallet || __storeWallet;

        try {
          const hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
          const hasNsSession = !!(req?.ns?.admin || req?.ns?.pub);
          if (hostedMode && hasNsSession) {
            if (!__ltBaseWallet && (__ltCfgWallet || __tgWallet)) {
              const adopt = __ltCfgWallet || __tgWallet;
              if (adopt && typeof adopt === 'string') {
                if (typeof lastTip.updateWalletAddress === 'function') {
                  try { lastTip.updateWalletAddress(adopt, req); } catch {}
                } else {
                  try { lastTip.walletAddress = adopt; } catch {}
                }
              }
            }
          }
        } catch {}
        if (__effLtWallet) merged.walletAddress = __effLtWallet;
        const wallet = __effLtWallet;
        if (wallet) {
          try {
            const fetched = await lastTip.fetchLastDonation(wallet);
            if (fetched) {
              merged.lastDonation = fetched;
            } else if (process.env.GETTY_LAST_TIP_DEBUG === '1') {
              try { console.warn('[LastTip][DEBUG] Retaining cached lastDonation because fetch returned null'); } catch {}
            }
          } catch (e) {
            if (process.env.GETTY_LAST_TIP_DEBUG === '1') {
              try { console.warn('[LastTip][DEBUG] fetchLastDonation error, retaining cached value:', e.message); } catch {}
            }
          }
        }
        merged.active = !!wallet || !!merged.lastDonation;
        return sanitizeIfNoNs(merged);
      } catch { return sanitizeIfNoNs({ ...lastTip.getStatus(), ...lastTipColors }); }
    })(),
    tipWidget: (() => {
      try {
        const base = tipWidget.getStatus?.() || {};
        let effWallet = '';
        try {
          if (tipGoal && typeof tipGoal.walletAddress === 'string' && tipGoal.walletAddress.trim()) {
            effWallet = tipGoal.walletAddress.trim();
          } else if (typeof tipGoal?.getStatus === 'function') {
            const liveTg = tipGoal.getStatus();
            if (liveTg && typeof liveTg.walletAddress === 'string' && liveTg.walletAddress.trim()) {
              effWallet = liveTg.walletAddress.trim();
            }
          }
        } catch {}
        if (!effWallet && typeof tipGoalColors.walletAddress === 'string' && tipGoalColors.walletAddress.trim()) effWallet = tipGoalColors.walletAddress.trim();
        if (!effWallet && typeof lastTipColors.walletAddress === 'string' && lastTipColors.walletAddress.trim()) effWallet = lastTipColors.walletAddress.trim();
        if (!effWallet && typeof base.walletAddress === 'string' && base.walletAddress.trim()) effWallet = base.walletAddress.trim();
        if (!effWallet) {
          try {
            if (typeof tipGoal?.getStatus === 'function') {
              const lateTg = tipGoal.getStatus();
              if (lateTg && typeof lateTg.walletAddress === 'string' && lateTg.walletAddress.trim()) {
                effWallet = lateTg.walletAddress.trim();
              }
            }
          } catch {}
        }
        const out = { ...base };
        if (effWallet) out.walletAddress = effWallet;
        try {
          if (effWallet) {
            if (typeof tipWidget.updateWalletAddress === 'function') {
              try { tipWidget.updateWalletAddress(effWallet, req); } catch {}
            } else {
              try { tipWidget.walletAddress = effWallet; } catch {}
            }
            out.walletAddress = effWallet;
          }
        } catch {}
        const __hasEffectiveWallet = !!(effWallet || out.walletAddress);
        out.active = __hasEffectiveWallet || !!base.active;
        out.configured = !!effWallet;
        if (!out.configured && process.env.GETTY_MULTI_TENANT_WALLET === '1') {
          if (hasAnyTenantFile('tip-goal-config.json') || hasAnyTenantFile('last-tip-config.json')) {
            out.configured = true;
          }
        }
        return sanitizeIfNoNs(out);
      } catch { return sanitizeIfNoNs(tipWidget.getStatus()); }
    })(),
    tipGoal: (async () => {
      try {

        try {
          const hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
          const hasSessionWallet = !!(req?.walletSession && req.walletSession.walletHash);
          if (hostedMode && hasSessionWallet && tipGoal && (!tipGoal.walletAddress || !String(tipGoal.walletAddress).trim()) && typeof tipGoal.loadWalletAddress === 'function') {
            await tipGoal.loadWalletAddress(req);
          }
        } catch {}
        const base = (typeof tipGoal.getStatus === 'function') ? (tipGoal.getStatus() || {}) : {};
        const merged = { ...base, ...tipGoalColors };

        if (store && (req?.ns?.admin || req?.ns?.pub)) {
          const nsSession = req?.ns?.admin || req?.ns?.pub;
          let cfgObj = null;
          if (typeof store.getConfig === 'function') {
            try { cfgObj = await store.getConfig(nsSession, 'tip-goal-config.json', null); } catch {}
          }
          if (!cfgObj) { try { cfgObj = await store.get(nsSession, 'tip-goal-config', null); } catch {} }
          const data = cfgObj && cfgObj.data ? cfgObj.data : cfgObj;
          if (data) {
            if (data.walletAddress) tipGoal.walletAddress = data.walletAddress.trim();
            if (data.monthlyGoal) tipGoal.monthlyGoalAR = data.monthlyGoal;
            if (data.currentAmount) tipGoal.currentTipsAR = data.currentAmount;
            else if (data.currentTips) tipGoal.currentTipsAR = data.currentTips;
            if (data.theme) tipGoal.theme = data.theme;
            if (data.title) tipGoal.title = data.title;
            if (data.bgColor) tipGoal.bgColor = data.bgColor;
            if (data.fontColor) tipGoal.fontColor = data.fontColor;
            if (data.borderColor) tipGoal.borderColor = data.borderColor;
            if (data.progressColor) tipGoal.progressColor = data.progressColor;
            const updatedBase = (typeof tipGoal.getStatus === 'function') ? (tipGoal.getStatus() || {}) : {};
            Object.assign(merged, updatedBase);
          }
        }
        try {

          if ((merged.monthlyGoal === 10 || merged.monthlyGoal == null) && (Number(merged.currentAmount||merged.currentTips||0) === 0)) {
            const fs = require('fs');
            const path = require('path');
            const cfgPath = path.join(process.cwd(),'config','tip-goal-config.json');
            if (fs.existsSync(cfgPath)) {
              try {
                let raw = JSON.parse(fs.readFileSync(cfgPath,'utf8'));
                if (raw && raw.data && typeof raw.data === 'object' && ((raw.__version || raw.checksum || raw.updatedAt) || !raw.walletAddress)) {
                  raw = raw.data; if (raw && raw.data && typeof raw.data === 'object') raw = raw.data;
                }
                if (raw && typeof raw === 'object') {
                  const rGoal = Number(raw.monthlyGoal || 0);
                  const rCur = Number(raw.currentAmount || raw.currentTips || 0);
                  const hasNonDefault = (rGoal && rGoal !== 10) || (rCur && rCur !== 0);
                  if (hasNonDefault) {
                    if (rGoal && rGoal !== 10) merged.monthlyGoal = rGoal;
                    if (rCur || rCur === 0) merged.currentAmount = rCur;
                    if (typeof raw.theme === 'string') merged.theme = (raw.theme === 'koku-list') ? 'modern-list' : raw.theme;
                    if (typeof raw.bgColor === 'string') merged.bgColor = raw.bgColor;
                    if (typeof raw.fontColor === 'string') merged.fontColor = raw.fontColor;
                    if (typeof raw.borderColor === 'string') merged.borderColor = raw.borderColor;
                    if (typeof raw.progressColor === 'string') merged.progressColor = raw.progressColor;
                    if (typeof raw.title === 'string' && raw.title.trim()) merged.title = raw.title.trim();
                  }
                }
              } catch {}
            }
          }
        } catch {}
        if (merged.currentAmount == null && typeof merged.currentTips === 'number') {
          merged.currentAmount = merged.currentTips;
        }
        if (typeof merged.progress !== 'number') {
          const g = Number(merged.monthlyGoal || 0);
            const c = Number(merged.currentAmount || merged.currentTips || 0);
          if (g > 0) merged.progress = Math.min((c / g) * 100, 100);
        }
        try {
          const p = await getArUsdCached(true);
          const exRate = Number(p.usd) || 0;
          merged.exchangeRate = exRate;
          merged.usdValue = ((merged.currentAmount || 0) * exRate).toFixed(2);
          merged.goalUsd = ((merged.monthlyGoal || 0) * exRate).toFixed(2);
        } catch {
          merged.exchangeRate = 0;
          merged.usdValue = '0.00';
          merged.goalUsd = '0.00';
        }
        return sanitizeIfNoNs(merged);
      } catch {
        try {
          const fallback = (tipGoal.getStatus?.() || {});
          if (fallback.currentAmount == null && typeof fallback.currentTips === 'number') fallback.currentAmount = fallback.currentTips;
          return sanitizeIfNoNs({ ...fallback, ...tipGoalColors });
        } catch { return sanitizeIfNoNs({ ...tipGoalColors }); }
      }
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
    announcement: (async () => {
      try {
        const ns = hasNs ? adminNs : null;
        const cfg = await announcementModule.getPublicConfig(ns);
        const enabledMessages = cfg.messages.filter(m=>m.enabled).length;
        const base = { active: enabledMessages > 0, totalMessages: cfg.messages.length, enabledMessages, cooldownSeconds: cfg.cooldownSeconds };
        return (requireSessionFlag || hosted) && !hasNs ? { active: false, totalMessages: 0, enabledMessages: 0 } : base;
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
      const hasDiscord = !!st.config?.hasDiscord;
      const hasTelegram = !!st.config?.hasTelegram;
      const hasLiveDiscord = !!st.config?.hasLiveDiscord;
      const hasLiveTelegram = !!st.config?.hasLiveTelegram;
      const configured = hasDiscord || hasTelegram || hasLiveDiscord || hasLiveTelegram || !!(st.config?.template && st.config.template !== '');
      return {
        active: !!st.active,
        configured,
        lastTips: st.lastTips,
        config: { hasDiscord, hasTelegram, hasLiveDiscord, hasLiveTelegram, template: st.config?.template || '' },
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
  const st = await raffle.getPublicState(__adm);
        let configured = !!st.active || !!st.paused || (Array.isArray(st.participants) && st.participants.length > 0);

        if (!configured) {
          try {
            if (fs.existsSync(RAFFLE_CONFIG_FILE)) {
              const raw = fs.readFileSync(RAFFLE_CONFIG_FILE, 'utf8');
              const data = JSON.parse(raw || '{}');
              if (data && typeof data === 'object') {
                const keys = Object.keys(data);
                for (const k of keys) {
                  if (k === 'default' || k === 'namespaces') continue;
                  const cfg = data[k];
                  if (cfg && typeof cfg === 'object') {
                    if (cfg.enabled === true || (cfg.prize && String(cfg.prize).trim()) || (cfg.command && cfg.command !== '!giveaway')) {
                      configured = true; break;
                    }
                  }
                }
              }
            }
          } catch {}
        }

        if (!configured && process.env.GETTY_MULTI_TENANT_WALLET === '1') {
          if (hasAnyTenantFile('raffle-config.json')) configured = true;
        }
        return { active: !!st.active, paused: !!st.paused, participants: st.participants || [], totalWinners: st.totalWinners || 0, configured };
      } catch { return { active: false, participants: [] }; }
    })(),
    achievements: (async () => {
      try {
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        const cfg = await achievements.getConfigEffective(ns);
        const st = await achievements.getStatus(ns);
        return { active: !!cfg.enabled, dnd: !!cfg.dnd, items: st.items?.length || 0 };
      } catch { return { active: false, items: 0 }; }
    })(),
    system: { uptimeSeconds, wsClients, env: process.env.NODE_ENV || 'development' }
  };

  if ((requireSessionFlag || hosted) && !hasNs) {

    const walletOnly = !requireSessionFlag;
    if (!walletOnly) {
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
      try { if (payload.achievements) payload.achievements.active = false; } catch {}
      payload.masked = true;
      payload.maskedReason = 'no_session';
    } else {

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

      payload.masked = true;
      payload.maskedReason = 'no_session_partial';
    }
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
    if (payload.tipGoal && payload.tipGoal.walletAddress) {
      if (payload.lastTip && (!payload.lastTip.walletAddress || !String(payload.lastTip.walletAddress).trim())) {
        payload.lastTip.walletAddress = payload.tipGoal.walletAddress;
        payload.lastTip.active = true;
      }
      if (payload.tipWidget && (!payload.tipWidget.walletAddress || !String(payload.tipWidget.walletAddress).trim())) {
        payload.tipWidget.walletAddress = payload.tipGoal.walletAddress;
        payload.tipWidget.active = true;
        payload.tipWidget.configured = true;
      }
    }
  } catch {}

  try {
    const derive = (obj) => {
      if (!obj || typeof obj !== 'object') return 'inactive';
      const active = !!obj.active || !!obj.connected;
      const configured = !!obj.configured || !!obj.initialized || !!obj.walletAddress || !!obj.participants?.length;
      if (active) return 'active';
      if (configured) return 'configured';
      return 'inactive';
    };
    const moduleKeys = ['lastTip','tipWidget','tipGoal','chat','announcement','socialmedia','externalNotifications','liveviews','raffle','achievements'];
    for (const mk of moduleKeys) {
      if (payload[mk] && typeof payload[mk] === 'object') {
        try { payload[mk].displayState = derive(payload[mk]); } catch {}
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
  const totalTipsAR = +sumAr(__tipEvents).toFixed(2);
  const totalTipsUSD = +sumUsd(__tipEvents).toFixed(2);

    let liveviews = { live: false, viewerCount: 0 };
    try {
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      const key = ns ? `ns:${ns}` : 'single';
      const ttlMs = Math.max(1000, parseInt(process.env.GETTY_LIVEVIEWS_TTL_MS || '10000', 10));
      if (!app.__lvCache) app.__lvCache = {};

      let cfgData = null;
      if (loadTenantConfig) {
        try {
          const wrapped = await loadTenantConfig(req, store, LIVEVIEWS_CONFIG_FILE, 'liveviews-config.json');
          if (wrapped && wrapped.data) cfgData = wrapped.data;
        } catch {}
      }

      if ((!cfgData || !cfgData.claimid) && store && ns) {
        try {
          const legacy = await store.get(ns, 'liveviews-config', null);
          if (legacy && typeof legacy === 'object') cfgData = { ...(cfgData || {}), ...legacy };
        } catch {}
      }

      if ((!cfgData || !cfgData.claimid) && fs.existsSync(LIVEVIEWS_CONFIG_FILE)) {
        try {
          const raw = JSON.parse(fs.readFileSync(LIVEVIEWS_CONFIG_FILE, 'utf8'));
          if (raw && typeof raw === 'object') cfgData = { ...(cfgData || {}), ...raw };
        } catch {}
      }
      const cfg = getLiveviewsConfigWithDefaults(cfgData || {});
      const claimid = (cfg.claimid || '').trim();
      if (claimid) {
        const cached = app.__lvCache[key];
        const now = Date.now();
        if (cached && (now - cached.ts) < ttlMs) {
          liveviews.live = !!cached.data.Live;
          liveviews.viewerCount = typeof cached.data.ViewerCount === 'number' ? cached.data.ViewerCount : 0;
        } else {
          try {
            const url = `https://api.odysee.live/livestream/is_live?channel_claim_id=${encodeURIComponent(claimid)}`;
            const resp = await axios.get(url, { timeout: 3000 });
            const data = resp?.data?.data || {};
            const out = { Live: !!data.Live, ViewerCount: (typeof data.ViewerCount === 'number' ? data.ViewerCount : 0) };
            app.__lvCache[key] = { ts: now, data: out };
            liveviews.live = out.Live;
            liveviews.viewerCount = out.ViewerCount;
          } catch {
            const stale = app.__lvCache[key];
            if (stale) {
              liveviews.live = !!stale.data.Live;
              liveviews.viewerCount = typeof stale.data.ViewerCount === 'number' ? stale.data.ViewerCount : 0;
            }
          }
        }
      }
    } catch {}

    let walletAddr = '';
    let walletBalanceAR = null;
    try { walletAddr = await __resolveWalletAddressForMetrics(req); } catch {}
    let walletBalanceUSD = null;
    if (walletAddr) {
      try { walletBalanceAR = await __fetchWalletBalance(walletAddr); } catch {}
      if (walletBalanceAR != null) {
        try {
          const rate = (__arPriceCache && __arPriceCache.usd > 0) ? Number(__arPriceCache.usd) : 0;
          if (rate > 0) walletBalanceUSD = +(walletBalanceAR * rate).toFixed(2);
        } catch {}
      }
    }

    res.json({
      serverTime: now,
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
        total: { ar: totalTipsAR, usd: totalTipsUSD },
        totalBalance: walletBalanceAR != null ? { ar: walletBalanceAR, usd: walletBalanceUSD } : null,
        wallet: walletAddr ? { address: walletAddr } : null,
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

try {
  if (!global.__gettyPendingNsQueue) { global.__gettyPendingNsQueue = new Map(); }
} catch {}

wss.on('connection', async (ws) => {
  try {
    let ns = null;
    try { ns = ws.nsToken || null; } catch {}

    if (process.env.NODE_ENV === 'test' && __WS_VERBOSE) {
      try {
        const tokens = []; wss.clients.forEach(c=>{ try { tokens.push(c.nsToken||null); } catch {} });

      } catch {}
    }

    try { if (!ws.__initTenantSent) { ws.send(JSON.stringify({ type: 'initTenant', nsToken: ws.nsToken, ts: Date.now(), phase: 'early' })); ws.__initTenantSent = true; } } catch {}

    if (process.env.NODE_ENV === 'test') {
      try {
        const cfg = await announcementModule.getPublicConfig(ns || null);
        ws.send(JSON.stringify({ type: 'announcement_config', data: cfg }));
      } catch {}

      try {
        let attempts = 0;
        const iv = setInterval(async () => {
          attempts++;
            try {
              const st = await (announcementModule._getState ? announcementModule._getState(ns || null) : null);
              if (st && st.messages && st.messages.length) {
                await announcementModule.broadcastRandomMessage(ns || null);
                clearInterval(iv);
                return;
              }
            } catch {}
          if (attempts > 40) { clearInterval(iv); }
        }, 50);
        if (iv.unref) { try { iv.unref(); } catch {} }
      } catch {}
    }
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

  initPayload.raffle = await raffle.getPublicState(ns);
      } catch {}
    } else {
      initPayload.raffle = shouldRequireSession
        ? { active: false, paused: false, participants: [], totalWinners: 0 }
  : await raffle.getPublicState(null);
    }
  try { ws.send(JSON.stringify({ type: 'init', data: initPayload })); ws.__initSent = true; } catch {}

    if (ws.nsToken) {
      raffle.getPublicState(ws.nsToken).then(st => {
        ws.send(JSON.stringify({ type: 'raffle_state', ...st }));
      }).catch(err => {
        console.error('Error sending raffle_state on connect:', err);
      });
    }

    if (process.env.NODE_ENV === 'test' && __WS_VERBOSE) {

      setTimeout(() => { try { if (ws.readyState === 1) ws.send(JSON.stringify({ type: '_probe', nsToken: ws.nsToken })); } catch {}; }, 35);
    }

    try {
      if (ws.nsToken) {
        const queued = __pendingNsQueue.get(ws.nsToken);
        if (queued && queued.length) {
          queued.forEach(msg => { try { if (ws.readyState === 1) ws.send(msg); } catch {} });
          __pendingNsQueue.delete(ws.nsToken);
        }
      }
    } catch {}

    try {
      if (!ws.__initTenantPostSent) {
        ws.send(JSON.stringify({ type: 'initTenant', nsToken: ws.nsToken, ts: Date.now(), phase: 'post-init' }));
        ws.__initTenantPostSent = true;
      }
    } catch {}

    if (process.env.NODE_ENV === 'test') {
      setTimeout(() => {
        try {
          if (!ws.__initSent && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'init', data: { lastTip: lastTip.getLastDonation(), tipGoal: tipGoal.getGoalProgress(), persistentTips: [], raffle: null, fallback: true } }));
            ws.__initSent = true;
          }
        } catch {}
      }, 50);
    }

    if (process.env.NODE_ENV === 'test') {
      try {
        setTimeout(async () => {
          try {
            const st = (typeof announcementModule._getState === 'function')
              ? await announcementModule._getState(ns || null)
              : null;
            if (st && Array.isArray(st.messages) && st.messages.length && !st.staticMode) {
              await announcementModule.broadcastRandomMessage(ns || null);
            }
          } catch {}
        }, 0);
      } catch {}
    }
  } catch {}

  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'get_raffle_state') {
  const st = await raffle.getPublicState(ws.nsToken || null);
        ws.send(JSON.stringify({ type: 'raffle_state', ...st }));
      }

    } catch (error) {
      console.error('Error parsing message from client:', error);
    }
  });

  ws.on('close', () => {
    if (process.env.NODE_ENV !== 'test') {
  // console.warn('WebSocket connection closed');
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
      let cfg = await store.get(ns, 'external-notifications-config', null);
      if (cfg && cfg.__version && cfg.data) cfg = cfg.data;
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
        const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
        const shouldRequireSession = requireSessionFlag || !!process.env.REDIS_URL;
        const ns = req?.ns?.admin || req?.ns?.pub || null;
        if (shouldRequireSession && !ns) {
            return res.status(401).json({ error: 'session_required' });
        }

        const { amount = 5.00, from = 'TestUser', message = 'Test donation!' } = req.body;

        const donationData = {
            type: 'donation',
            amount: parseFloat(amount),
            from: from,
            message: message,
            timestamp: new Date().toISOString()
        };
        
        if (ns) {
            if (typeof wss?.broadcast === 'function') {
                wss.broadcast(ns, donationData);
            } else {
                wss?.clients?.forEach(client => {
                    try {
                        if (client.readyState === client.OPEN && client.nsToken === ns) {
                            client.send(JSON.stringify(donationData));
                        }
                    } catch {}
                });
            }
        } else if (!process.env.GETTY_MULTI_TENANT_WALLET === '1') {
            wss.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    client.send(JSON.stringify(donationData));
                }
            });
        }
        
        try {
          const nsForAchievements = ns || null;
          achievements.onTip(nsForAchievements, { usd: donationData.amount });
        } catch {}
        
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

try {
  app.post('/api/test-tip', express.json(), async (req, res) => {
    try {

      try { const { ensureWalletSession } = require('./lib/wallet-session'); ensureWalletSession(req); } catch {}

      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const shouldRequireSession = requireSessionFlag || !!process.env.REDIS_URL;
      const ns = req?.ns?.admin || req?.ns?.pub || null;
      if (shouldRequireSession && !ns) {
        return res.status(401).json({ error: 'session_required' });
      }

      const {
        amountAr,
        amount,
        usd,
        from = 'TestUser',
        message = 'Synthetic tip event'
      } = req.body || {};
      let arVal = 0; let usdVal = 0;

      try {
        const price = (typeof __arPriceCache === 'object' && __arPriceCache && __arPriceCache.usd) ? Number(__arPriceCache.usd) : 0;
        const candidateAr = (typeof amountAr === 'number' && isFinite(amountAr) && amountAr > 0)
          ? amountAr
          : (typeof amount === 'number' && isFinite(amount) && amount > 0 ? amount : 0);
        if (candidateAr > 0) {
          arVal = candidateAr;
          usdVal = (typeof usd === 'number' && isFinite(usd) && usd >= 0)
            ? usd
            : (price > 0 ? +(candidateAr * price).toFixed(2) : 0);
        } else if (typeof usd === 'number' && isFinite(usd) && usd > 0) {
          usdVal = usd; arVal = (price > 0 ? +(usd / price).toFixed(6) : 0);
        }
      } catch {}

      if (!(arVal > 0) && !(usdVal > 0)) { arVal = 1; usdVal = 0; }
      const tipEvt = {
        amount: arVal,
        usd: usdVal,
        from,
        message,
        source: 'test-tip',
        timestamp: new Date().toISOString()
      };

  try { if (wss && typeof wss.emit === 'function') wss.emit('tip', tipEvt, ns || null); } catch {}

      const frameTip = { type: 'tip', data: { amount: arVal, usd: usdVal, from, message, timestamp: tipEvt.timestamp } };
      const frameNotif = { type: 'tipNotification', data: { from, amount: arVal.toFixed(6), usd: usdVal, message, timestamp: tipEvt.timestamp } };

      if (ns) {
        if (typeof wss?.broadcast === 'function') {
          if (process.env.NODE_ENV === 'test') { try { console.warn('[test-tip][debug] broadcasting namespaced frames', { ns, arVal, usdVal, wssClients: Array.from(wss?.clients||[]).length }); } catch {} }
          wss.broadcast(ns, frameTip);
          wss.broadcast(ns, frameNotif);
        } else {
          try {
            if (process.env.NODE_ENV === 'test') { try { console.warn('[test-tip][debug] manual namespace send fallback', { ns, arVal, usdVal }); } catch {} }
            wss?.clients?.forEach(c => { try { if (c.readyState === 1 && c.nsToken === ns) { c.send(JSON.stringify(frameTip)); c.send(JSON.stringify(frameNotif)); } } catch {} });
          } catch {}
        }
      } else {
        if (process.env.NODE_ENV === 'test') {
          wss?.clients?.forEach(c=>{ try { if (c.readyState === 1) { c.send(JSON.stringify(frameTip)); c.send(JSON.stringify(frameNotif)); } } catch {} });
        } else {
          if (process.env.NODE_ENV === 'test') { try { console.warn('[test-tip][debug] skipping broadcast - no namespace provided and not in test mode', { arVal, usdVal }); } catch {} }
        }
      }
      return res.json({ success: true, tip: { ar: arVal, usd: usdVal, from, message, ns: ns || null } });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });
} catch {}

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

let OBSWebSocket;
try {
  if (process.env.NODE_ENV === 'test') {
    OBSWebSocket = class MockOBSWebSocket { async connect(){ return { connected: true }; } async call(){ return {}; } on(){} off(){} };
  } else {
    ({ OBSWebSocket } = require('obs-websocket-js'));
  }
} catch { OBSWebSocket = class MockOBSWebSocket { async connect(){ return { connected: false }; } async call(){ return {}; } on(){} off(){} }; }
const obs = new OBSWebSocket();

async function connectOBS() {
  try {
    if (obsWsConfig.ip && obsWsConfig.port) {
      await obs.connect(`ws://${obsWsConfig.ip}:${obsWsConfig.port}`, obsWsConfig.password);
    }
  } catch (error) {
    console.error('Error connecting to OBS:', error);
  }
}

if (process.env.NODE_ENV !== 'test') {
  connectOBS();
}

registerObsRoutes(app, strictLimiter, obsWsConfig, OBS_WS_CONFIG_FILE, connectOBS, store);

try {
  const adminDist = path.join(__dirname, 'public', 'admin-dist');
  if (fs.existsSync(adminDist)) {
    app.use('/admin', (req, res, next) => {
      try {
        if (process.env.GETTY_ADMIN_REQUIRE_AUTH === '1') {
          const hasWallet = !!req.walletSession;
          const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
          const isHtmlAccept = req.accepts(['html','json']) === 'html';
          const wantsHtmlDoc = isHtmlAccept && (req.path === '/' || req.path === '');
          const blockAssets = process.env.GETTY_ADMIN_BLOCK_ASSETS === '1';
          const isAsset = /\.(js|css|map|json|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)$/i.test(req.path);
          if (!hasWallet && !hasNs) {
            if (wantsHtmlDoc) return res.redirect(302, '/?admin=login');
            if (blockAssets && isAsset) return res.status(401).json({ error: 'admin_auth_required' });
          }
        }
      } catch (e) { try { console.warn('[adminGuard][warn]', e?.message); } catch {} }
      return next();
    });
    app.get(['/admin', '/admin/'], (req, res, next) => {
      try {
        const indexPath = path.join(adminDist, 'index.html');
        if (!fs.existsSync(indexPath)) return next();
        const nonce = res.locals?.cspNonce || '';
        let html = fs.readFileSync(indexPath, 'utf8');
        if (nonce && !/property=["']csp-nonce["']/.test(html)) {
          const meta = `<meta property="csp-nonce" nonce="${nonce}">`;
          const patch = `<script src="/js/nonce-style-patch.js" nonce="${nonce}" defer></script>`;
          html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}\n    ${patch}`);
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        try { if (nonce) res.setHeader('X-CSP-Nonce', nonce); } catch {}
        return res.send(html);
      } catch { return next(); }
    });
    app.use('/admin', express.static(adminDist, { index: 'index.html' }));
    app.get('/admin/*', (req, res, next) => {
      try {
        const indexPath = path.join(adminDist, 'index.html');
        if (!fs.existsSync(indexPath)) return next();
        const nonce = res.locals?.cspNonce || '';
        let html = fs.readFileSync(indexPath, 'utf8');
        if (nonce && !/property=["']csp-nonce["']/.test(html)) {
          const meta = `<meta property="csp-nonce" nonce="${nonce}">`;
          const patch = `<script src="/js/nonce-style-patch.js" nonce="${nonce}" defer></script>`;
          html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}\n    ${patch}`);
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        try { if (nonce) res.setHeader('X-CSP-Nonce', nonce); } catch {}
        return res.send(html);
      } catch { return next(); }
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
      try {
        const nonce = res.locals?.cspNonce || '';
        let html = fs.readFileSync(indexPath, 'utf8');
        if (nonce && !/property=["']csp-nonce["']/.test(html)) {
          const meta = `<meta property="csp-nonce" nonce="${nonce}">`;
          const patch = `<script src="/js/nonce-style-patch.js" nonce="${nonce}" defer></script>`;
          html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${meta}\n    ${patch}`);
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        try { if (nonce) res.setHeader('X-CSP-Nonce', nonce); } catch {}
        return res.send(html);
  } catch {
        return res.sendFile(indexPath);
      }
    }

    return res.status(503).send('Admin UI not built. Run "npm run admin:build".');
  } catch (e) {
    return next(e);
  }
});

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'test' || process.env.GETTY_DEBUG_ROUTES === '1') {
    if (req.originalUrl === '/__ws-debug' || req.originalUrl === '/__routes') {
      return next();
    }
  }
  const silenceTest404 = process.env.NODE_ENV === 'test' && process.env.GETTY_SILENCE_404_TEST === '1';
  const isApi = typeof req.originalUrl === 'string' && req.originalUrl.startsWith('/api/');
  if (!silenceTest404 && (isApi || __allow('warn'))) {
    try { console.warn('404 Not Found:', { method: req.method, url: req.originalUrl }); } catch {}
  }
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

  try {
    wss.on('tip', async (tipData, ns) => {
      try {
        let payload = tipData || {};
        const amount = Number(payload.amount || 0) || 0;
        const hasUsd = typeof payload.usd === 'number' && !Number.isNaN(payload.usd);
        const isUsd = !!payload.creditsIsUsd;
        if (!hasUsd && !isUsd && amount > 0) {
          try {
            const rate = await getArUsdCached(false);
            const usd = (rate && typeof rate.usd === 'number' ? rate.usd : 0) * amount;
            if (usd > 0) payload = { ...payload, usd };
          } catch {}
        }
        try { achievements.onTip(ns || null, payload); } catch {}
      } catch {}
    });
  } catch {}

  const __allowedOrigins = new Set(
    (process.env.GETTY_ALLOW_ORIGINS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  );

  server.on('upgrade', (req, socket, head) => {
    try {
      const origin = req.headers.origin || '';
      if (__allowedOrigins.size > 0 && origin && !__allowedOrigins.has(origin) && !origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
        try { socket.destroy(); } catch {}
        return;
      }

  let nsToken = extractNamespaceFromRequest(req) || '';
      if (!nsToken && req.headers.cookie) {
        const cookies = parseCookieHeader(req.headers.cookie);
  const legacyCookie = cookies['getty_public_token'] || cookies['getty_admin_token'] || '';
  if (!nsToken && legacyCookie) { nsToken = legacyCookie; /* tokenSource = 'cookie-public-admin'; */ }
        try {
          if (!nsToken && cookies['getty_wallet_session']) {
            const { verifySessionCookie, deriveWalletHash } = require('./lib/wallet-auth');
            const parsed = verifySessionCookie(cookies['getty_wallet_session']);
            if (parsed && parsed.addr) nsToken = deriveWalletHash(parsed.addr);
            if (nsToken) { /* tokenSource = 'wallet-session'; */ }
          }
        } catch {}
      }

      try {
        if (nsToken && /^[a-f0-9]{16,64}$/i.test(nsToken)) {
          req.tenant = { walletHash: nsToken };
        }
      } catch {}
        const bindAndAccept = async () => {

        if (!nsToken && req.url) {
          try {
            const url = new URL(req.url, 'http://localhost');
            const widgetToken = url.searchParams.get('widgetToken');
            if (widgetToken && store) {
              const walletHash = await store.get(widgetToken, 'walletHash');
              if (walletHash) nsToken = walletHash;
            }
          } catch {}
        }
        let effective = nsToken || '';
        try {
          if (store && effective) {

            const mapped = await store.get(effective, 'adminToken', null);
            if (mapped) effective = mapped;
          }
        } catch {}
        wss.handleUpgrade(req, socket, head, ws => {
          ws.nsToken = effective || null;
          if (!ws.nsToken && nsToken) { ws.nsToken = nsToken; }
          if (process.env.NODE_ENV === 'test') { try { console.warn('[ws][upgrade][debug]', { presented: nsToken || null, effective: ws.nsToken }); } catch {} }

          wss.emit('connection', ws, req);
          try {
            if (process.env.NODE_ENV === 'test' && __WS_VERBOSE) {
              const tokens = []; try { wss.clients.forEach(c=> tokens.push(c.nsToken)); } catch {}
            }
          } catch {}
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

  app.ensureWsDebugRoute = function ensureWsDebugRoute() {
    if (app.__wsDebugRouteAdded) return;
    app.__wsDebugRouteAdded = true;
    app.get('/__ws-debug', (_req,res)=>{
      try {
        const sockets = []; try { wss.clients.forEach(c=> sockets.push({ nsToken: c.nsToken || null, ready: c.readyState })); } catch {}
        if (app.__fallbackWss) { try { app.__fallbackWss.clients.forEach(c=> sockets.push({ nsToken: c.__fallbackNs || null, ready: c.readyState })); } catch {} }
        const queues=[]; try { __pendingNsQueue.forEach((v,k)=>queues.push({ nsToken:k, size:v.length })); } catch{}
        res.json({ sockets, queues });
      } catch { res.status(500).json({ error:'debug_failed' }); }
    });
  };
  try {
    if (typeof wss.broadcast !== 'function') {
      wss.broadcast = function(nsToken, payload) {
        try {
          if (payload === null || typeof payload === 'undefined') return;
          const data = JSON.stringify(payload);
          if (nsToken) {
            let delivered = 0;
            wss.clients.forEach(client => {
              try {
                if (!client || client.readyState !== 1) return;
                if (client.nsToken !== nsToken) return;
                client.send(data); delivered++;
              } catch {}
            });
            if (delivered === 0) {
              const arr = __pendingNsQueue.get(nsToken) || [];
              arr.push(data);
              __pendingNsQueue.set(nsToken, arr.slice(-25));
            }
          } else {
            wss.clients.forEach(client => { try { if (client && client.readyState === 1) client.send(data); } catch {} });
          }
        } catch {}
      };
    }
  } catch { /* ignore override errors */ }
  app.startTestServer = function startTestServer(port = 0) {
    return new Promise(resolve => {
      const server = http.createServer(app);
  try { server.on('connection', (sock)=>{ /* test server connection trace removed */ try { sock.once('data', _buf=>{ /* first chunk suppressed */ }); } catch {}; }); } catch {}

      function parseCookieHeader(cookieHeader) {
        const out = {}; if (typeof cookieHeader !== 'string' || !cookieHeader) return out;
        cookieHeader.split(';').forEach(p=>{ const idx = p.indexOf('='); if (idx>-1) { const k=p.slice(0,idx).trim(); const v=p.slice(idx+1).trim(); if(k) out[k]=decodeURIComponent(v); } });
        return out;
      }
      if (!server.__upgradeHookAdded) {
        server.__upgradeHookAdded = true;
        server.on('upgrade', (req, socket, head) => {
          try {
            try {
              if (process.env.NODE_ENV === 'test') {
                const hdrs = {};
                try { Object.keys(req.headers || {}).forEach(k=>{ if(/^(host|upgrade|connection|sec-websocket-key|sec-websocket-version|cookie|sec-websocket-extensions|x-ws-ns)$/i.test(k)) hdrs[k]=req.headers[k]; }); } catch {}
                try { console.warn('[ws][test-upgrade][incoming]', { url: req.url, hdrs }); } catch {}
              }
            } catch {}

            let nsToken = extractNamespaceFromRequest(req) || '';
            if (!nsToken && req.headers.cookie) {
              const cookies = parseCookieHeader(req.headers.cookie);
              const legacyCookie = cookies['getty_public_token'] || cookies['getty_admin_token'] || '';
              if (!nsToken && legacyCookie) { nsToken = legacyCookie; }
              if (!nsToken && cookies['getty_wallet_session']) { try { const { verifySessionCookie, deriveWalletHash } = require('./lib/wallet-auth'); const parsed = verifySessionCookie(cookies['getty_wallet_session']); if (parsed && parsed.addr) { nsToken = deriveWalletHash(parsed.addr); } } catch {} }
            }

            if (process.env.NODE_ENV === 'test') { try { console.warn('[ws][test-upgrade][ns-resolved]', { presented: nsToken || null }); } catch {} }

            const bindAndAccept = async () => {
              let effective = nsToken || '';
              try { if (store && effective) { const mapped = await store.get(effective, 'adminToken', null); if (mapped) effective = mapped; } } catch {}
              wss.handleUpgrade(req, socket, head, ws => {
                ws.nsToken = effective || null;
                if (!ws.nsToken && nsToken) ws.nsToken = nsToken;
                if (process.env.NODE_ENV === 'test') { try { console.warn('[ws][test-upgrade][accepted]', { effective: ws.nsToken || null, totalClients: Array.from(wss.clients || []).length + 1 }); } catch {} }

                const origSend = ws.send;
                ws.send = function(data) {
                  origSend.call(this, data);

                  if (process.env.NODE_ENV === 'test' && this.nsToken) {
                    try {
                      const { servers } = require('./tests/mocks/ws');
                      servers.forEach(server => {
                        server.clients.forEach(client => {
                          if (client.nsToken === this.nsToken) {
                            const messageData = typeof data === 'string' ? data : String(data);
                            client.emit('message', messageData);
                          }
                        });
                      });
                    } catch {}
                  }
                };

                ws.on('message', async (message) => {
                  try {
                    const msg = JSON.parse(message);
                    if (msg.type === 'get_raffle_state') {
                      const st = await raffle.getPublicState(ws.nsToken || null);
                      ws.send(JSON.stringify({ type: 'raffle_state', ...st }));
                    }
                  } catch (error) {
                    console.error('Error parsing message from client:', error);
                  }
                });

                wss.emit('connection', ws, req);

                if (process.env.NODE_ENV === 'test' && ws.nsToken) {
                  setTimeout(() => {
                    console.warn('[test][raffle_state] about to getPublicState for nsToken:', ws.nsToken);
                    raffle.getPublicState(ws.nsToken).then(st => {
                      console.warn('[test][raffle_state] got state:', st);
                      const msg = JSON.stringify({ type: 'raffle_state', ...st });
                      console.warn('[test][raffle_state] sending to nsToken:', ws.nsToken, 'msg:', msg);
                      ws.send(msg);
                    }).catch((err) => { console.warn('[test][raffle_state] error:', err); });
                  }, 50);
                }
              });
            };
            bindAndAccept();
          } catch { try { socket.destroy(); } catch {} }
        });

        try {
          if (process.env.NODE_ENV === 'test' && !server.__upgradeProbeInterval) {
            let upgradesObserved = 0;
            server.on('upgrade', () => { upgradesObserved++; });
            server.__upgradeProbeInterval = setInterval(()=>{
              try {
                if (upgradesObserved === 0) {
                  // console.warn('[wss.upgrade][test][probe]', { note: 'no-upgrade-events-seen-yet', listenerCount: (server.listeners('upgrade')||[]).length, wssClients: (()=>{ try { return Array.from(wss.clients).length; } catch { return -1; } })() });
                } else if (upgradesObserved > 0 && server.__upgradeProbeInterval) {
                  clearInterval(server.__upgradeProbeInterval);
                  server.__upgradeProbeInterval = null;
                }
              } catch {}
            }, 250);
            if (server.__upgradeProbeInterval && server.__upgradeProbeInterval.unref) { try { server.__upgradeProbeInterval.unref(); } catch {} }
          }
        } catch {}
      }

      try {
        if (!app.__fallbackWss && process.env.NODE_ENV !== 'test') {
          const fallbackWss = new WebSocket.Server({ server });
          app.__fallbackWss = fallbackWss;

          const origBroadcast = wss.broadcast || function(){};
          wss.broadcast = function(nsToken, payload) {
            try { origBroadcast.call(wss, nsToken, payload); } catch {}
            try {
              if (!fallbackWss || !fallbackWss.clients) return;
              const data = JSON.stringify(payload);

              fallbackWss.clients.forEach(c=>{ try { if (c.readyState===1 && (!nsToken || c.__fallbackNs===nsToken)) { c.send(data); } } catch {} });

            } catch {}
          };

          fallbackWss.on('connection', (ws, req) => {
            try {
              const url = new URL(req.url, 'http://localhost');
              let nsToken = url.searchParams.get('token') || url.searchParams.get('ns') || '';

              try {
                if (!nsToken && req.headers.cookie) {
                  const parts = req.headers.cookie.split(/;\s*/);
                  const jar = {}; parts.forEach(p=>{ const i=p.indexOf('='); if(i>0){ jar[p.slice(0,i)]=decodeURIComponent(p.slice(i+1)); } });
                  nsToken = jar['getty_public_token'] || jar['getty_admin_token'] || '';
                  if (!nsToken && jar['getty_wallet_session']) {
                    try { const { verifySessionCookie, deriveWalletHash } = require('./lib/wallet-auth'); const parsed = verifySessionCookie(jar['getty_wallet_session']); if (parsed && parsed.addr) nsToken = deriveWalletHash(parsed.addr); } catch {}
                  }
                }
              } catch {}
              ws.__fallbackNs = nsToken || null;
              if (!ws.nsToken && nsToken) ws.nsToken = nsToken;

              try { ws.send(JSON.stringify({ type: 'initTenant', nsToken: ws.__fallbackNs, ts: Date.now(), phase: 'early-fallback' })); } catch {}
            } catch {}
          });
        }
      } catch {}
      if (process.env.NODE_ENV==='test') { app.ensureWsDebugRoute(); }
      if (!app.__routesListAdded) {
        app.__routesListAdded = true;
        app.get('/__routes', (_req,res)=>{
          try { const stack = (app._router && app._router.stack) ? app._router.stack : []; const routes = stack.filter(l=>l.route && l.route.path).map(r=>({ path:r.route.path, methods:Object.keys(r.route.methods) })); res.json({ routes }); } catch (e) { res.status(500).json({ error:String(e) }); }
        });
        app.get('/', (_req,res)=> res.status(200).send('ok-test-root'));
      }

      server.listen(port, '127.0.0.1', () => {
        try { if (process.env.NODE_ENV === 'test') { const addr = server.address(); console.warn('[test-server][listening]', addr); } } catch {}
        resolve(server);
      });
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
    try { if (wss.close) wss.close(); } catch {}
  };
}
