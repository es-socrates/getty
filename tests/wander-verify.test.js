const { verifyWander } = require('../lib/wander-verify');

describe('verifyWander', () => {
  function baseWalletAuth(overrides = {}) {
    const store = { nonce: null };
    return Object.assign({
  issueNonce: (_addr)=>({}),
      buildLoginMessage: ({ address, nonce, issuedAt, expiresAt, domain }) => `Login\nAddress: ${address}\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpires At: ${expiresAt}\nDomain: ${domain}`,
      getNonceRecord: (addr) => store.nonce && store.nonce.address === addr ? store.nonce.rec : null,
      deleteNonce: (addr) => { if (store.nonce && store.nonce.address === addr) store.nonce = null; },
  addressFromOwnerPublicKey: (_pub) => overrides.fixedAddress || 'ADDR',
      verifySignature: async () => overrides.signatureOk !== false,
      deriveWalletHash: (addr) => 'hash_' + addr.slice(0,6),
      signSession: (s) => 'signed.' + s.sid,
      getSessionTtlMs: () => 60000,
      _seed(address, rec) { store.nonce = { address, rec }; }
    }, overrides);
  }

  test('invalid payload', async () => {
    await expect(verifyWander({}, { walletAuth: baseWalletAuth(), reqHost: 'h' })).rejects.toHaveProperty('code', 'invalid_payload');
  });

  test('nonce not found', async () => {
    const wa = baseWalletAuth();
    await expect(verifyWander({ address: 'ADDR', publicKey: 'PUB', signature: 'SIG' }, { walletAuth: wa, reqHost: 'h' })).rejects.toHaveProperty('code', 'nonce_not_found');
  });

  test('nonce expired', async () => {
    const wa = baseWalletAuth();
    const now = Date.now();
    wa._seed('ADDR', { nonce: 'N1', exp: now - 10, message: 'M', issuedAt: new Date(now-1000).toISOString(), domain: 'd' });
    await expect(verifyWander({ address: 'ADDR', publicKey: 'PUB', signature: 'SIG' }, { walletAuth: wa, reqHost: 'h' })).rejects.toHaveProperty('code', 'nonce_expired');
  });

  test('address mismatch', async () => {
    const wa = baseWalletAuth({ addressFromOwnerPublicKey: () => 'DIFF' });
    const now = Date.now();
    wa._seed('ADDR', { nonce: 'N1', exp: now + 10000, message: 'M', issuedAt: new Date(now).toISOString(), domain: 'd' });
    await expect(verifyWander({ address: 'ADDR', publicKey: 'PUB', signature: 'SIG' }, { walletAuth: wa, reqHost: 'h' })).rejects.toHaveProperty('code', 'address_mismatch');
  });

  test('bad signature', async () => {
    const wa = baseWalletAuth({
      verifySignature: async () => false,
      addressFromOwnerPublicKey: () => 'ADDR'
    });
    const now = Date.now();
    wa._seed('ADDR', { nonce: 'N1', exp: now + 10000, message: 'M', issuedAt: new Date(now).toISOString(), domain: 'd' });
    await expect(verifyWander({ address: 'ADDR', publicKey: 'PUB', signature: 'SIG' }, { walletAuth: wa, reqHost: 'h' })).rejects.toHaveProperty('code', 'bad_signature');
  });

  test('dummy signature allowed', async () => {
    const wa = baseWalletAuth({ addressFromOwnerPublicKey: () => 'ADDR', verifySignature: async () => { throw new Error('should not be called for TEST'); } });
    const now = Date.now();
    wa._seed('ADDR', { nonce: 'N1', exp: now + 10000, message: 'M', issuedAt: new Date(now).toISOString(), domain: 'd' });
    const out = await verifyWander({ address: 'ADDR', publicKey: 'PUB', signature: 'TEST' }, { walletAuth: wa, reqHost: 'h', allowDummy: true });
    expect(out.response.success).toBe(true);
    expect(out.response.address).toBe('ADDR');
  });

  test('success path', async () => {
    const wa = baseWalletAuth({ addressFromOwnerPublicKey: () => 'ADDR', verifySignature: async () => true });
    const now = Date.now();
    wa._seed('ADDR', { nonce: 'N1', exp: now + 10000, message: 'M', issuedAt: new Date(now).toISOString(), domain: 'd' });
    const out = await verifyWander({ address: 'ADDR', publicKey: 'PUB', signature: 'SIG' }, { walletAuth: wa, reqHost: 'h' });
    expect(out.response.success).toBe(true);
    expect(out.response.walletHash).toBeDefined();
    expect(out.session.addr).toBe('ADDR');
  });
});
