const fs = require('fs');
const path = require('path');

function tenantEnabled(req) {
  const enabledFlag = process.env.GETTY_MULTI_TENANT_WALLET === '1';
  const hash = (req && (
    (req.walletSession && req.walletSession.walletHash) ||
    (req.tenant && req.tenant.walletHash)
  )) || null;
  return !!(enabledFlag && hash);
}

function getTenantRoot(walletHash) {
  return path.join(process.cwd(), 'tenant', walletHash);
}

function getTenantConfigDir(walletHash) {
  return path.join(getTenantRoot(walletHash), 'config');
}

function resolveTenantConfigPath(req, baseFilename) {
  if (!tenantEnabled(req)) return null;
  const hash = (req.walletSession && req.walletSession.walletHash) || (req.tenant && req.tenant.walletHash);
  if (!hash) return null;
  return path.join(getTenantConfigDir(hash), baseFilename);
}

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function writeJsonSafe(filePath, obj) {
  try {
    ensureDirForFile(filePath);
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
    return true;
  } catch { return false; }
}

function loadConfigWithFallback(req, globalPath, filename) {
  const disableFallback = process.env.GETTY_DISABLE_GLOBAL_FALLBACK === '1';
  const strictTenant = disableFallback;
  if (tenantEnabled(req)) {
    const tenantPath = resolveTenantConfigPath(req, filename);
    const data = readJsonSafe(tenantPath);
    if (data) return { data, path: tenantPath, tenant: true };

    if (strictTenant) return { data: null, path: tenantPath, tenant: true, missing: true };

    const globalData = readJsonSafe(globalPath);
    if (globalData) return { data: globalData, path: globalPath, tenant: false, fallback: true };
    return { data: null, path: tenantPath, tenant: true, missing: true };
  }
  const data = readJsonSafe(globalPath);
  return { data: data || {}, path: globalPath, tenant: false };
}

function saveTenantAwareConfig(req, globalPath, filename, updater) {
  if (tenantEnabled(req)) {
    const tenantPath = resolveTenantConfigPath(req, filename);
    const current = readJsonSafe(tenantPath) || {};
    const next = updater(current) || current;
    writeJsonSafe(tenantPath, next);
    return { data: next, path: tenantPath, tenant: true };
  }
  const current = readJsonSafe(globalPath) || {};
  const next = updater(current) || current;
  writeJsonSafe(globalPath, next);
  return { data: next, path: globalPath, tenant: false };
}

module.exports = {
  tenantEnabled,
  resolveTenantConfigPath,
  loadConfigWithFallback,
  saveTenantAwareConfig
};
