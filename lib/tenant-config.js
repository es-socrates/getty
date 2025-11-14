const fs = require('fs');
const path = require('path');
const { resolveTenantConfigPath, tenantEnabled } = require('./tenant');
const crypto = require('crypto');

const DEFAULT_ENCRYPTION_KEY = 'default-insecure-key-change-me';
const allowInsecureKey = process.env.GETTY_ALLOW_INSECURE_STORE_KEY === '1';
const enforceSecureKey =
  !allowInsecureKey &&
  process.env.NODE_ENV !== 'test' &&
  (process.env.REDIS_URL ||
    process.env.GETTY_REQUIRE_SESSION === '1' ||
    process.env.GETTY_MULTI_TENANT_WALLET === '1');

if (
  enforceSecureKey &&
  (!process.env.STORE_ENCRYPTION_KEY || process.env.STORE_ENCRYPTION_KEY === DEFAULT_ENCRYPTION_KEY)
) {
  throw new Error(
    '[tenant-config] STORE_ENCRYPTION_KEY is required when running in hosted mode (Redis/session/wallet enabled). Set STORE_ENCRYPTION_KEY to a strong secret or opt-in with GETTY_ALLOW_INSECURE_STORE_KEY=1.'
  );
}

function debugLog(...args) {
  if (process.env.GETTY_TENANT_DEBUG === '1') {
    try {
      console.warn('[tenant-config]', ...args);
    } catch {}
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function computeChecksum(obj) {
  try {
    const json = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('sha256').update(json).digest('hex');
  } catch {
    return null;
  }
}

function withVersion(obj, previous) {
  const base = obj && typeof obj === 'object' ? obj : {};
  const checksum = computeChecksum(base);
  let version = 1;
  if (previous && typeof previous === 'object') {
    try {
      if (previous.checksum && previous.checksum === checksum && previous.__version) {
        version = previous.__version;
      } else if (previous.__version) {
        version = previous.__version + 1;
      }
    } catch {}
  }
  return { __version: version, updatedAt: new Date().toISOString(), checksum, data: base };
}

function _deriveKey(passphrase) {
  return crypto.scryptSync(passphrase, 'salt', 32);
}

function _encrypt(text) {
  const key = _deriveKey(process.env.STORE_ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function _decrypt(encryptedText) {
  const key = _deriveKey(process.env.STORE_ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY);
  const parts = encryptedText.split(':');
  if (parts.length !== 2) return encryptedText;
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function safeRead(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const decrypted = _decrypt(raw);
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

async function loadTenantConfig(req, store, globalPath, filename) {
  const ns = req?.ns?.admin || req?.ns?.pub || null;
  const forceHash = req && req.__forceWalletHash;
  const tenantPath =
    forceHash || tenantEnabled(req)
      ? forceHash
        ? require('path').join(process.cwd(), 'tenant', forceHash, 'config', filename)
        : resolveTenantConfigPath(req, filename)
      : require('path').join(process.cwd(), 'tenant', 'local', 'config', filename);
  let source = 'global';
  let raw = null;
  let meta = null;

  if (ns && store) {
    raw = await store.getConfig(ns, filename, null);
    if (raw) {
      source = 'redis';
      if (
        raw &&
        typeof raw === 'object' &&
        (raw.__version || raw.checksum) &&
        typeof raw.data === 'object'
      ) {
        meta = {
          __version: raw.__version || null,
          checksum: raw.checksum || null,
          updatedAt: raw.updatedAt || null,
        };
        raw = raw.data || {};
      }
    }
  }
  if (!raw && tenantPath) {
    const disk = safeRead(tenantPath);
    if (disk) {
      if (
        disk &&
        typeof disk === 'object' &&
        (disk.__version || disk.checksum) &&
        typeof disk.data === 'object'
      ) {
        meta = {
          __version: disk.__version || null,
          checksum: disk.checksum || null,
          updatedAt: disk.updatedAt || null,
        };
        raw = disk.data || {};
      } else {
        raw = disk;
      }
      source = 'tenant-disk';
    }
  }
  if (!raw && fs.existsSync(globalPath)) {
    source = 'global-file';
    const g = safeRead(globalPath);
    if (g && typeof g === 'object' && (g.__version || g.checksum) && typeof g.data === 'object') {
      meta = {
        __version: g.__version || null,
        checksum: g.checksum || null,
        updatedAt: g.updatedAt || null,
      };
      raw = g.data || {};
    } else {
      raw = g;
    }
  }

  if (ns && store && raw && source !== 'redis') {
    try {
      const writeWrapped = meta
        ? {
            __version: meta.__version,
            checksum: meta.checksum,
            updatedAt: meta.updatedAt,
            data: raw,
          }
        : { data: raw };
      await store.setConfig(ns, filename, writeWrapped);
    } catch {}
  }

  if (source === 'global-file' && tenantPath && raw) {
    try {
      if (!fs.existsSync(tenantPath)) {
        ensureDir(path.dirname(tenantPath));
        const wrapped = withVersion(raw.data ? raw.data : raw);
        fs.writeFileSync(tenantPath, JSON.stringify(wrapped, null, 2));
        debugLog('migrated-global-to-tenant', { filename, tenantPath });
      }
    } catch (e) {
      debugLog('migrate-error', { filename, error: e.message });
    }
  }
  debugLog('load', { filename, ns, source, tenantPath, forceHash, hasMeta: !!meta });
  return { data: raw || {}, source, tenantPath, meta };
}

async function saveTenantConfig(req, store, globalPath, filename, nextObj) {
  const ns = req?.ns?.admin || req?.ns?.pub || null;
  const forceHash = req && req.__forceWalletHash;
  const tenantPath =
    forceHash || tenantEnabled(req)
      ? forceHash
        ? require('path').join(process.cwd(), 'tenant', forceHash, 'config', filename)
        : resolveTenantConfigPath(req, filename)
      : require('path').join(process.cwd(), 'tenant', 'local', 'config', filename);
  let previousWrapped = null;
  try {
    if (tenantPath && fs.existsSync(tenantPath)) {
      previousWrapped = safeRead(tenantPath);
    } else if (!tenantPath && fs.existsSync(globalPath)) {
      previousWrapped = safeRead(globalPath);
    }
  } catch {}
  const wrapped = withVersion(nextObj, previousWrapped);

  if (ns && store) {
    await store.setConfig(ns, filename, wrapped);
  }
  if (tenantPath) {
    ensureDir(path.dirname(tenantPath));
    const encryptedJson = _encrypt(JSON.stringify(wrapped, null, 2));
    fs.writeFileSync(tenantPath, encryptedJson);
  } else {
    ensureDir(path.dirname(globalPath));
    fs.writeFileSync(globalPath, JSON.stringify(wrapped, null, 2));
  }
  debugLog('save', { filename, ns, tenantPath, forceHash, wroteTenant: !!tenantPath });
  return {
    tenantPath,
    ns,
    forceHash,
    meta: {
      __version: wrapped.__version,
      checksum: wrapped.checksum,
      updatedAt: wrapped.updatedAt,
    },
  };
}

module.exports = { loadTenantConfig, saveTenantConfig, computeChecksum };
