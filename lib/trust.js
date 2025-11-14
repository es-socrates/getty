function extractIp(req) {
  try {
    let ip = req.ip || req.connection?.remoteAddress || '';
    if (typeof ip === 'string' && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
    return ip || '';
  } catch {
    return '';
  }
}

function isTrustedIp(ip) {
  try {
    const strict = process.env.GETTY_STRICT_LOCAL_ADMIN === '1';
    const allow = (process.env.GETTY_ALLOW_IPS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const loopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (strict) return loopback;
    return loopback || (allow.length > 0 && allow.includes(ip));
  } catch {
    return false;
  }
}

function hasAdminNamespace(req) {
  return !!req?.ns?.admin;
}

function isTrustedLocalAdmin(req) {
  const ip = extractIp(req);
  return hasAdminNamespace(req) && isTrustedIp(ip);
}

function shouldMaskSensitive(req) {
  const hosted = !!process.env.REDIS_URL;
  const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
  if (!(hosted || requireSessionFlag)) return false;
  return !isTrustedLocalAdmin(req);
}

module.exports = {
  extractIp,
  isTrustedIp,
  hasAdminNamespace,
  isTrustedLocalAdmin,
  shouldMaskSensitive,
};
