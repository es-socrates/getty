function ensureWalletSession(req) {
  try {
    if (req.walletSession && req.walletSession.addr) return req.walletSession;
    const { verifySessionCookie, deriveWalletHash } = require('./wallet-auth');
    let raw = null;
    if (req.cookies && req.cookies.getty_wallet_session) raw = req.cookies.getty_wallet_session;
    else if (req.headers && req.headers.cookie) {
      try {
        const parts = String(req.headers.cookie).split(/;\s*/);
        for (const p of parts) { if (p.startsWith('getty_wallet_session=')) { raw = p.substring('getty_wallet_session='.length); break; } }
      } catch {}
    }
    if (!raw) return null;
    const parsed = verifySessionCookie(raw);
    if (parsed && parsed.addr) {
      req.walletSession = parsed;
      if (!req.tenant) req.tenant = { walletAddress: parsed.addr, walletHash: deriveWalletHash(parsed.addr) };
      return parsed;
    }
  } catch {}
  return null;
}

module.exports = { ensureWalletSession };
