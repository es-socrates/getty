function buildError(code, http = 400, extra = {}) {
  const e = new Error(code);
  e.code = code;
  e.http = http;
  Object.assign(e, extra);
  return e;
}

async function verifyWander(payload, ctx) {
  const { walletAuth, reqHost, allowDummy, loginDomain } = ctx;
  if (!walletAuth) throw buildError('wallet_auth_disabled', 503);
  const { address, publicKey, signature } = payload || {};
  if (!address || !publicKey || !signature) throw buildError('invalid_payload');
  const { getNonceRecord, deleteNonce, buildLoginMessage, addressFromOwnerPublicKey, verifySignature, deriveWalletHash, signSession, getSessionTtlMs } = walletAuth;
  const rec = getNonceRecord(address);
  if (!rec) throw buildError('nonce_not_found');
  if (Date.now() > rec.exp) { deleteNonce(address); throw buildError('nonce_expired'); }
  const domain = loginDomain || reqHost || 'localhost';
  const message = rec.message || buildLoginMessage({ address, nonce: rec.nonce, issuedAt: rec.issuedAt || new Date().toISOString(), expiresAt: new Date(rec.exp).toISOString(), domain });

  const isDummy = allowDummy && signature === 'TEST';
  if (!isDummy) {
    const derived = addressFromOwnerPublicKey(publicKey);
    if (!derived || derived !== address) throw buildError('address_mismatch');
    const ok = await verifySignature(publicKey, message, signature);
    if (!ok) throw buildError('bad_signature', 401);
  }
  deleteNonce(address);
  const now = Date.now();
  const ttl = getSessionTtlMs();
  const walletHash = deriveWalletHash(address);
  const sess = { sid: require('crypto').randomUUID(), addr: address, walletHash, iat: now, exp: now + ttl, caps: ['config.read','config.write'] };
  const widgetToken = require('crypto').randomUUID();
  sess.widgetToken = widgetToken;
  const signed = signSession(sess);
  return {
    session: sess,
    signed,
    response: { success: true, address, walletHash, expiresAt: new Date(sess.exp).toISOString(), capabilities: sess.caps, mode: 'wander-bridge', widgetToken }
  };
}

module.exports = { verifyWander };
