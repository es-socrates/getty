const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OWNER_FILE = path.join(process.cwd(), 'config', 'owner-token.json');

function safeReadFileJSON(p) {
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {}
  return null;
}

function writeFileJSON(p, obj) {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(obj, null, 2));
    return true;
  } catch {
    return false;
  }
}

function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function getEnvOwnerToken() {
  const t = process.env.GETTY_OWNER_TOKEN;
  return typeof t === 'string' && t.trim().length >= 10 ? t.trim() : null;
}

async function loadOwnerToken(store) {
  const envTok = getEnvOwnerToken();
  if (envTok) return { token: envTok, source: 'env', claimed: true };

  // Hosted store path
  if (store && store.redis) {
    try {
      const t = await store.get('global', 'owner-token', null);
      if (t && typeof t.token === 'string')
        return { token: t.token, source: 'store', claimed: true };
    } catch {}
  } else {
    const f = safeReadFileJSON(OWNER_FILE);
    if (f && typeof f.token === 'string') return { token: f.token, source: 'file', claimed: true };
  }
  return { token: null, source: null, claimed: false };
}

async function claimOwnerToken(store, provided) {
  const existing = await loadOwnerToken(store);
  if (existing.token) {
    return { ok: false, alreadyClaimed: true };
  }
  const token =
    typeof provided === 'string' && provided.trim().length >= 10
      ? provided.trim()
      : generateToken();
  const entry = { token, createdAt: Date.now() };
  if (store && store.redis) {
    try {
      await store.set('global', 'owner-token', entry);
      return { ok: true, token, created: true };
    } catch {}
    return { ok: false };
  }
  const ok = writeFileJSON(OWNER_FILE, entry);
  return { ok, token: ok ? token : null, created: ok };
}

async function rotateOwnerToken(store, oldToken) {
  const envTok = getEnvOwnerToken();
  if (envTok) return { ok: false, error: 'env_token_immutable' };
  const existing = await loadOwnerToken(store);
  if (!existing.token) return { ok: false, error: 'not_claimed' };
  if (existing.token !== oldToken) return { ok: false, error: 'invalid_old_token' };
  const newToken = generateToken();
  const entry = { token: newToken, rotatedAt: Date.now() };
  if (store && store.redis) {
    try {
      await store.set('global', 'owner-token', entry);
      return { ok: true, token: newToken };
    } catch {}
    return { ok: false, error: 'store_write_failed' };
  }
  const ok = writeFileJSON(OWNER_FILE, entry);
  return { ok, token: ok ? newToken : null, error: ok ? null : 'file_write_failed' };
}

function extractOwnerTokenFromReq(req) {
  try {
    const hdr = req.headers['x-owner-token'];
    if (typeof hdr === 'string' && hdr.trim()) return hdr.trim();
    if (req.query && typeof req.query.ownerToken === 'string') return req.query.ownerToken.trim();
    if (req.cookies && typeof req.cookies.ownerToken === 'string')
      return req.cookies.ownerToken.trim();
  } catch {}
  return null;
}

async function isOwnerRequest(req, store) {
  try {
    const candidate = extractOwnerTokenFromReq(req);
    if (!candidate) return false;
    const existing = await loadOwnerToken(store);
    if (!existing.token) return false;
    return candidate === existing.token;
  } catch {
    return false;
  }
}

async function getStatus(store) {
  const envTok = getEnvOwnerToken();
  const existing = await loadOwnerToken(store);
  const preview = existing.token ? existing.token.slice(0, 6) + '...' : null;
  return {
    claimed: !!existing.token,
    source: existing.source || (envTok ? 'env' : null),
    tokenPreview: preview,
    envImmutable: !!envTok,
  };
}

module.exports = {
  loadOwnerToken,
  claimOwnerToken,
  rotateOwnerToken,
  isOwnerRequest,
  getStatus,
  extractOwnerTokenFromReq,
};
