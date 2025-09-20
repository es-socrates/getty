function resolveAdminNamespace(req) {
  try {
    let adminNs = req?.ns?.admin || null;
    if (!adminNs && req?.query && req.query.ns) adminNs = String(req.query.ns);
    if (
      !adminNs &&
      process.env.GETTY_MULTI_TENANT_WALLET === '1' &&
      req.walletSession && req.walletSession.walletHash
    ) {
      adminNs = req.walletSession.walletHash;
    }
    return adminNs || null;
  } catch {
    return null;
  }
}

module.exports = { resolveAdminNamespace };
