const crypto = require('crypto');
const Arweave = require('arweave');
const { z } = require('zod');

const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });

const nonces = new Map();

const sessions = new Map();

const COOKIE_DOMAIN_HINTS = new Set(['ac', 'co', 'com', 'edu', 'gov', 'mil', 'net', 'org']);

function normalizeCookieDomainCandidate(raw, { keepFull = false } = {}) {
  if (!raw) return '';
  let trimmed = String(raw).trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('*.')) trimmed = trimmed.slice(2);
  if (trimmed.startsWith('.')) trimmed = trimmed.slice(1);
  const parts = getDomainParts(trimmed);
  let host = (parts.host || trimmed || '').trim().toLowerCase();
  if (!host) return '';
  if (host.startsWith('*.')) host = host.slice(2);
  if (host.startsWith('.')) host = host.slice(1);
  if (!host) return '';
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return '';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return '';
  if (host.includes(':')) host = host.split(':')[0];
  const segments = host.split('.').filter(Boolean);
  if (segments.length <= 1) return '';
  let domainSegments = segments;
  if (!keepFull) {
    let sliceCount = Math.min(2, segments.length);
    if (segments.length >= 3) {
      const penultimate = segments[segments.length - 2];
      if (COOKIE_DOMAIN_HINTS.has(penultimate)) {
        sliceCount = Math.min(3, segments.length);
      }
    }
    if (segments.length > sliceCount) domainSegments = segments.slice(-sliceCount);
  }
  const domain = domainSegments.join('.');
  return domain ? `.${domain}` : '';
}

function getSessionCookieDomain(req) {
  const explicit =
    process.env.GETTY_SESSION_COOKIE_DOMAIN ||
    process.env.GETTY_WALLET_COOKIE_DOMAIN ||
    process.env.GETTY_COOKIE_DOMAIN ||
    '';
  if (explicit) {
    const normalizedExplicit = normalizeCookieDomainCandidate(explicit, { keepFull: true });
    if (normalizedExplicit) return normalizedExplicit;
  }

  const loginDomain = process.env.GETTY_LOGIN_DOMAIN || '';
  const loginNormalized = normalizeCookieDomainCandidate(loginDomain);
  if (loginNormalized) return loginNormalized;

  const hostHeader = req?.headers?.host || req?.hostname || '';
  const headerNormalized = normalizeCookieDomainCandidate(hostHeader);
  if (headerNormalized) return headerNormalized;

  return '';
}

function resolveSessionCookieOptions(req, overrides = {}) {
  const base = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === '1' || process.env.NODE_ENV === 'production',
    path: '/',
    ...overrides
  };
  const cookieDomain = getSessionCookieDomain(req);
  return { base, cookieDomain };
}

function setSessionCookie(res, req, value, overrides = {}) {
  const { base, cookieDomain } = resolveSessionCookieOptions(req, overrides);
  try {
    res.cookie(SESSION_COOKIE, value, base);
  } catch {}
  if (cookieDomain) {
    try {
      res.cookie(SESSION_COOKIE, value, { ...base, domain: cookieDomain });
    } catch {}
  }
}

function clearSessionCookie(res, req, overrides = {}) {
  const { base, cookieDomain } = resolveSessionCookieOptions(req, overrides);
  try {
    res.clearCookie(SESSION_COOKIE, base);
  } catch {}
  if (cookieDomain) {
    try {
      res.clearCookie(SESSION_COOKIE, { ...base, domain: cookieDomain });
    } catch {}
  }
}

function normalizeLocalHost(host) {
  const lowered = (host || '').toString().trim().toLowerCase();
  if (!lowered) return '';
  if (lowered === 'localhost' || lowered === '127.0.0.1' || lowered === '::1') return 'localhost';
  return lowered;
}

function getDomainParts(input) {
  const raw = (input || '').toString().trim();
  if (!raw) return { host: '', port: '' };
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `http://${raw}`;
  try {
    const parsed = new URL(candidate);
    const host = normalizeLocalHost(parsed.hostname);
    const port = parsed.port || '';
    return { host, port };
  } catch {
    let host = raw;
    let port = '';
    const ipv6Match = raw.match(/^\[(.*)\](?::(\d+))?$/);
    if (ipv6Match) {
      host = ipv6Match[1];
      port = ipv6Match[2] || '';
    } else {
      const parts = raw.split(':');
      if (parts.length > 1 && /^[0-9]+$/.test(parts[parts.length - 1])) {
        port = parts.pop();
        host = parts.join(':') || '';
      }
    }
    const normalizedHost = normalizeLocalHost(host);
    return { host: normalizedHost, port };
  }
}

function canonicalizeDomain(input) {
  const { host, port } = getDomainParts(input);
  if (!host) return '';
  return port ? `${host}:${port}` : host;
}

const SESSION_COOKIE = 'getty_wallet_session';
const SESSION_TTL_SECONDS = parseInt(process.env.WALLET_SESSION_TTL_SECONDS || '86400', 10); // 24h default

function getSessionSecret() {
  if (!process.__GETTY_SESSION_SECRET) {
    const envSecret = process.env.GETTY_SESSION_SECRET || '';
    process.__GETTY_SESSION_SECRET = envSecret || crypto.randomBytes(32).toString('hex');
  }
  return process.__GETTY_SESSION_SECRET;
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
}

function deriveWalletHash(address) {
  return crypto.createHash('sha256').update(String(address || '').toLowerCase()).digest('hex').slice(0,16);
}

function buildLoginMessage({ address, nonce, issuedAt, expiresAt, domain }) {
  return [
    'Getty Login',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Domain: ${domain}`,
    `Issued At: ${issuedAt}`,
    `Expires At: ${expiresAt}`,
    'Version: 1'
  ].join('\n');
}

function issueNonce(address, { domain } = {}) {
  const nonce = base64url(crypto.randomBytes(18));
  const now = Date.now();
  const expMs = now + 5 * 60 * 1000;
  const issuedAt = new Date(now).toISOString();
  const rawDomain = (domain || 'localhost').toString();
  const effectiveDomain = canonicalizeDomain(rawDomain) || 'localhost';
  const expiresAtIso = new Date(expMs).toISOString();
  const message = buildLoginMessage({ address, nonce, issuedAt, expiresAt: expiresAtIso, domain: effectiveDomain });
  nonces.set(address, { nonce, exp: expMs, issuedAt, message, domain: effectiveDomain });
  return { nonce, issuedAt, expiresAt: expiresAtIso, message, domain: effectiveDomain };
}

function getNonceRecord(address) {
  return nonces.get(address) || null;
}

function deleteNonce(address) {
  try { nonces.delete(address); } catch {}
}

async function verifySignature(publicKeyB64Url, message, signatureB64Url) {

  if (process.env.GETTY_WALLET_AUTH_ALLOW_DUMMY === '1' && signatureB64Url === 'TEST') return true;
  try {
    const debug = process.env.GETTY_WALLET_AUTH_DEBUG === '1';
    const variants = [];
    const norm = (s) => s.replace(/-/g,'+').replace(/_/g,'/');
    const addPad = (s) => s + (s.length % 4 === 2 ? '==' : (s.length % 4 === 3 ? '=' : ''));
    const trim = (s) => s.trim();
    const sigRaw = trim(signatureB64Url);
    const pubRaw = trim(publicKeyB64Url);
    const basePub = addPad(norm(pubRaw));
    const baseSig = addPad(norm(sigRaw));

    variants.push({ pub: basePub, sig: baseSig, tag: 'b64url->b64' });

    if (/[+/]/.test(sigRaw)) variants.push({ pub: addPad(pubRaw), sig: addPad(sigRaw), tag: 'raw-b64' });

    if (!/=+$/.test(baseSig)) variants.push({ pub: basePub, sig: baseSig + '==', tag: 'force-pad-==' });

    if (!/=+$/.test(baseSig)) variants.push({ pub: basePub, sig: baseSig + '=', tag: 'force-pad-=' });

    if (/^[0-9a-f]{512,}$/i.test(sigRaw)) {
      try {
        const buf = Buffer.from(sigRaw, 'hex');
        variants.push({ pub: basePub, sig: buf.toString('base64'), tag: 'hex->b64' });
      } catch {}
    }

    if (/^[0-9a-f]{512,}$/i.test(pubRaw) && pubRaw.length % 2 === 0) {
      try {
        const pbuf = Buffer.from(pubRaw, 'hex');
        variants.push({ pub: pbuf.toString('base64'), sig: baseSig, tag: 'pub-hex->b64' });
      } catch {}
    }
    const dataVariants = [];
    const originalData = Buffer.from(message, 'utf8');
    dataVariants.push({ data: originalData, tag: 'orig-msg' });

    if (/\r\n/.test(message)) {
      const lfOnly = message.replace(/\r\n/g,'\n');
      if (lfOnly !== message) {
        dataVariants.push({ data: Buffer.from(lfOnly,'utf8'), tag: 'lf-only' });
      }
    }
    const pubKeyRaw = Buffer.from(basePub, 'base64');

    for (const dv of dataVariants) {
      for (const v of variants) {
        try {
          const pubKey = Buffer.from(v.pub, 'base64');
          const signature = Buffer.from(v.sig, 'base64');
          const ok = await arweave.crypto.verify(pubKey, dv.data, signature);
          if (ok) {
            if (debug) console.warn('[wallet-auth-debug] verify ok', { variant: v.tag, dataVariant: dv.tag, sigLen: signature.length });
            return true;
          }
          if (debug) console.warn('[wallet-auth-debug] variant failed', v.tag, 'dataVariant', dv.tag);
        } catch (e) { if (debug) console.warn('[wallet-auth-debug] variant error', v.tag, 'dataVariant', dv.tag, e?.message); }
      }
    }
    if (debug) {
      try {
        const crypto = require('crypto');
        console.warn('[wallet-auth-debug] all variants failed', {
          messageHash: crypto.createHash('sha256').update(originalData).digest('hex').slice(0,32),
          pubKeyLen: pubKeyRaw.length,
          attempted: variants.map(v=>v.tag),
          dataVariants: dataVariants.map(d=>d.tag),
          msgPreview: message.split('\n').slice(0,3),
          sigLen: baseSig.length,
          pubPreview: pubRaw.slice(0,16)
        });
      } catch {}
    }
    return false;
  } catch {
    return false;
  }
}

function addressFromOwnerPublicKey(publicKeyB64Url) {
  try {
    const b64 = publicKeyB64Url.replace(/-/g,'+').replace(/_/g,'/');
    const pubKey = Buffer.from(b64, 'base64');
    const hash = crypto.createHash('sha256').update(pubKey).digest();
    return base64url(hash);
  } catch {
    return '';
  }
}

function signSession(payload) {
  const secret = getSessionSecret();
  const json = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret).update(json).digest('hex');
  return base64url(Buffer.from(json,'utf8')) + '.' + hmac;
}

function verifySessionCookie(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const secret = getSessionSecret();
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const jsonBuf = Buffer.from(parts[0].replace(/-/g,'+').replace(/_/g,'/'), 'base64');
  const json = jsonBuf.toString('utf8');
  const expected = crypto.createHmac('sha256', secret).update(json).digest('hex');
  if (expected !== parts[1]) return null;
  let obj; try { obj = JSON.parse(json); } catch { return null; }
  if (obj.exp && Date.now() > obj.exp) return null;
  return obj;
}

function attachSessionMiddleware(app) {
  app.use((req,_res,next)=>{
    if (req.walletSession) return next();
    try {
      const raw = req.cookies?.[SESSION_COOKIE];
      if (raw) {
        const sess = verifySessionCookie(raw);
        if (sess && sess.addr) {
          req.walletSession = sess;
          req.tenant = { walletAddress: sess.addr, walletHash: deriveWalletHash(sess.addr) };
        }
      }
    } catch {}
    next();
  });
}

function registerWalletAuthRoutes(app) {
  const enabled = process.env.GETTY_MULTI_TENANT_WALLET === '1';
  if (!enabled) return;

  const hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';

  app.post('/api/auth/wallet/nonce', (req,res)=>{
    try {
      const schema = z.object({ address: z.string().min(10).max(64) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'invalid_address' });
      const address = parsed.data.address.trim();

      if (!/^[A-Za-z0-9_-]{43,64}$/.test(address)) return res.status(400).json({ error: 'invalid_address_format' });
  const domain = process.env.GETTY_LOGIN_DOMAIN || (req.headers.host || 'localhost');
  const { nonce, issuedAt, expiresAt, message } = issueNonce(address, { domain });
  return res.json({ address, nonce, issuedAt, expiresAt, message, domain });
    } catch (e) {
      return res.status(500).json({ error: 'internal_error', details: e.message });
    }
  });

  app.post('/api/auth/wallet/verify', async (req,res)=>{
    try {
      const schema = z.object({
        address: z.string(),
        publicKey: z.string(),
        signature: z.string(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });
      const { address, publicKey, signature } = parsed.data;
    const rec = nonces.get(address);
      if (!rec) return res.status(400).json({ error: 'nonce_not_found' });
      if (Date.now() > rec.exp) { nonces.delete(address); return res.status(400).json({ error: 'nonce_expired' }); }

    const expectedDomainRaw = process.env.GETTY_LOGIN_DOMAIN || (req.headers.host || 'localhost');
    const expectedParts = getDomainParts(expectedDomainRaw);
    if (!expectedParts.host) expectedParts.host = 'localhost';
    const storedParts = getDomainParts(rec.domain);
    if (storedParts.host && storedParts.host !== expectedParts.host) {
      nonces.delete(address);
      return res.status(400).json({ error: 'domain_mismatch' });
    }
    const hostForPortCheck = (storedParts.host || expectedParts.host || '').toLowerCase();
    if (hostForPortCheck !== 'localhost' && storedParts.port && expectedParts.port && storedParts.port !== expectedParts.port) {
      nonces.delete(address);
      return res.status(400).json({ error: 'domain_mismatch' });
    }
    const domainHost = storedParts.host || expectedParts.host || 'localhost';
    const domainPort = storedParts.port || expectedParts.port || '';
    const domain = domainPort ? `${domainHost}:${domainPort}` : domainHost;

    const message = rec.message || buildLoginMessage({ address, nonce: rec.nonce, issuedAt: rec.issuedAt || new Date(rec.exp - 5*60*1000).toISOString(), expiresAt: new Date(rec.exp).toISOString(), domain });

      const derivedAddress = addressFromOwnerPublicKey(publicKey);
      if (!derivedAddress || derivedAddress !== address) {
        return res.status(400).json({ error: 'address_mismatch' });
      }
      const ok = await verifySignature(publicKey, message, signature);
      if (!ok) return res.status(401).json({ error: 'bad_signature' });
      nonces.delete(address);

      const walletHash = deriveWalletHash(address);
      const now = Date.now();
      const sess = { sid: crypto.randomUUID(), addr: address, walletHash, iat: now, exp: now + SESSION_TTL_SECONDS * 1000, caps: ['config.read','config.write'] };
      const signed = signSession(sess);
      sessions.set(sess.sid, { ...sess });
      setSessionCookie(res, req, signed, { maxAge: SESSION_TTL_SECONDS * 1000 });
      return res.json({ success: true, address, walletHash, expiresAt: new Date(sess.exp).toISOString(), capabilities: sess.caps });
    } catch (e) {
      return res.status(500).json({ error: 'internal_error', details: e.message });
    }
  });

  app.get('/api/auth/wallet/me', (req,res)=>{
    const sess = req.walletSession || null;
    if (!sess) return res.status(401).json({ error: 'no_session' });
    return res.json({ address: sess.addr, walletHash: sess.walletHash, capabilities: sess.caps, expiresAt: new Date(sess.exp).toISOString() });
  });

  app.post('/api/auth/wallet/logout', (req,res)=>{
    try {
      const sess = req.walletSession;
      if (sess) sessions.delete(sess.sid);
      clearSessionCookie(res, req);
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'internal_error', details: e.message }); }
  });

  app.post('/api/auth/wallet/import-seed', (req,res)=>{
    try {
      const localOnly = !(hostedMode);
      if (!localOnly || process.env.GETTY_ALLOW_LOCAL_SEED_IMPORT !== '1') {
        return res.status(403).json({ error: 'seed_import_disabled' });
      }
      const sess = req.walletSession;
      if (!sess) return res.status(401).json({ error: 'no_session' });
      const schema = z.object({ seed: z.string().min(10), passphrase: z.string().min(6) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });
      const { seed, passphrase } = parsed.data;
      const salt = crypto.randomBytes(16);
      const key = crypto.scryptSync(passphrase, salt, 32);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([cipher.update(seed, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      const payload = {
        version: 1,
        addr: sess.addr,
        walletHash: sess.walletHash,
        iv: base64url(iv),
        salt: base64url(salt),
        tag: base64url(tag),
        cipherText: base64url(enc),
        createdAt: new Date().toISOString()
      };
      const fs = require('fs');
      const path = require('path');
      const tenantDir = path.join(process.cwd(), 'tenant', sess.walletHash);
      const secretsDir = path.join(tenantDir, 'secrets');
      fs.mkdirSync(secretsDir, { recursive: true });
      const filePath = path.join(secretsDir, 'seed.json');
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: 'internal_error', details: e.message });
    }
  });
}

module.exports = {
  registerWalletAuthRoutes,
  attachSessionMiddleware,
  deriveWalletHash,
  addressFromOwnerPublicKey,
  verifySessionCookie,
  buildLoginMessage,
  issueNonce,
  getNonceRecord,
  deleteNonce,
  verifySignature,
  signSession,
  getSessionTtlMs: () => SESSION_TTL_SECONDS * 1000,
  canonicalizeDomain,
  getDomainParts,
  getSessionCookieDomain,
  setSessionCookie,
  clearSessionCookie
};
