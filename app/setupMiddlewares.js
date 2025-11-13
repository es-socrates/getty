/* eslint-env node */
const crypto = require('crypto');

function setupMiddlewares(app, {
  store,
  historyStore,
  helmet,
  express: expressModule,
  cookieParser,
  walletAuth,
  compression,
  morgan,
  anonymizeIp,
  __allow,
  __LOG_LEVEL
}) {
  try { app.set('store', store); } catch {}
  try { app.set('historyStore', historyStore); } catch {}
  try {
    if (process.env.REDIS_URL && !store?.redis && process.env.NODE_ENV !== 'test') {
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
          const nonce = crypto.randomBytes(16).toString('base64');
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
      let allowInlineScripts = process.env.GETTY_CSP_ALLOW_INLINE_SCRIPTS === '1';
      let allowInlineStyles = process.env.GETTY_CSP_ALLOW_INLINE_STYLES === '1';
      const enableGoogleFonts = process.env.GETTY_CSP_ENABLE_GOOGLE_FONTS !== '0';
      const enableWanderConnect = process.env.GETTY_ENABLE_WANDER_CONNECT === '1'
        || process.env.GETTY_MULTI_TENANT_WALLET === '1';

      if (enableWanderConnect) {
        allowInlineStyles = true;
        connectExtra.push('https://connect.wander.app', 'https://connect-api.wander.app');
        frameExtra.push('https://connect.wander.app');
        styleExtra.push('https://connect.wander.app');
      }

      const scriptSrc = [
        self,
        ...(allowInlineScripts ? ["'unsafe-inline'"] : []),
        ...(allowUnsafeHashes ? ["'unsafe-hashes'"] : []),
        ...unsafeEval,
        ...scriptExtra,
        ...scriptHashes
      ];

      const styleSrc = [
        self,
        ...(enableGoogleFonts ? ['https://fonts.googleapis.com'] : [])
      ];

      if (!enableWanderConnect) {
        styleSrc.push((req, res) => `'nonce-${res.locals.cspNonce || ''}'`);
      } else {
        allowInlineStyles = true;
      }

      if (allowInlineStyles) {
        styleSrc.push("'unsafe-inline'");
      }

      styleSrc.push(...styleExtra, ...styleHashes);

      const cspDirectives = {
        defaultSrc: [self],
        scriptSrc,
        styleSrc,
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
          'https://*.supabase.co',
          ...mediaExtra
        ],
        connectSrc: [self, 'ws:', 'wss:', 'https://api.na-backend.odysee.com', ...connectExtra],
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
  try { app.use('/api/stream-history/import', expressModule.json({ limit: '32mb' })); } catch {}
  try { app.use(expressModule.json({ limit: '1mb' })); } catch {}
  try { app.use(expressModule.urlencoded({ extended: true, limit: '1mb' })); } catch {}
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

  try {
    const rawAllowed = (process.env.GETTY_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
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
}

module.exports = {
  setupMiddlewares
};
