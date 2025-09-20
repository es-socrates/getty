const { isTrustedLocalAdmin } = require('./trust');
const { isOwnerRequest } = require('./owner');

function isOwner(req) {
  try {

    if (typeof req.__isOwner === 'boolean') return req.__isOwner;

    if (!req.__ownerCheckPromise) {
      req.__ownerCheckPromise = isOwnerRequest(req, req.app?.locals?.store).then(tokenMatch => {
        const legacy = !!(req?.auth && req.auth.isAdmin && isTrustedLocalAdmin(req));
        req.__isOwner = tokenMatch || legacy;
        return req.__isOwner;
      }).catch(() => {
        const legacy = !!(req?.auth && req.auth.isAdmin && isTrustedLocalAdmin(req));
        req.__isOwner = legacy;
        return req.__isOwner;
      });
    }

    const legacy = !!(req?.auth && req.auth.isAdmin && isTrustedLocalAdmin(req));
    return typeof req.__isOwner === 'boolean' ? req.__isOwner : legacy;
  } catch { return false; }
}

function canReadSensitive(req) {
  if (isOwner(req)) return true;
  try {
    if (req.walletSession && Array.isArray(req.walletSession.caps) && req.walletSession.caps.includes('config.read')) return true;
  } catch {}

  if (req?.auth && req.auth.isAdmin) return true;

  const relax = process.env.GETTY_RELAX_REMOTE_ADMIN === '1';
  if (relax && req?.auth && req.auth.isAdmin) return true;
  return false;
}

function canWriteConfig(req) {
  const enforceOwner = process.env.GETTY_ENFORCE_OWNER_WRITES === '1';
  const requireAdminWrites = (process.env.GETTY_REQUIRE_ADMIN_WRITE === '1') || !!process.env.REDIS_URL;

  try {
    if (req.walletSession && Array.isArray(req.walletSession.caps) && req.walletSession.caps.includes('config.write')) {

      if (enforceOwner) return true;
      return true;
    }
  } catch {}

  if (enforceOwner) {
    if (isOwner(req)) return true;
    if (req?.auth && req.auth.isAdmin) return true;
    return false;
  }

  if (requireAdminWrites) {

    return !!(req?.auth && req.auth.isAdmin);
  }

  if (req?.ns?.admin || req?.ns?.pub) return true;

  return !!(req?.auth && req.auth.isAdmin && isTrustedLocalAdmin(req));
}

module.exports = { isOwner, canReadSensitive, canWriteConfig };
