/* eslint-env node */

function walletTestMiddleware(forceHash) {
  return function (req, _res, next) {
    req.walletSession = { walletHash: forceHash };
    if (!req.ns) req.ns = {};
    req.ns.admin = forceHash;
    next();
  };
}

// eslint-disable-next-line no-undef
module.exports = { walletTestMiddleware };
