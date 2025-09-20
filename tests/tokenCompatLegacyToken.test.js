describe('tokenCompat legacy token retrieval removed', () => {
  function loadShim(cookie, search) {
    const code = require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'js', 'lib', 'token-compat.js'), 'utf8');
    const sandbox = { window: {}, document: { cookie }, location: { search } };
    const fn = new Function('window','document','location', code + ';return window.tokenCompat;');
    return fn(sandbox.window, sandbox.document, sandbox.location);
  }

  test('getLegacyToken no longer defined', () => {
    const compat = loadShim('', '');
    expect(compat.getLegacyToken).toBeUndefined();
  });

  test('legacy query token ignored (no helper)', () => {
    const compat = loadShim('', '?token=abc');
    expect(compat.getLegacyToken).toBeUndefined();
  });

  test('wallet cookie presence still detectable', () => {
    const compat = loadShim('getty_wallet_session=xyz', '');
    expect(compat.hasWalletSessionCookie()).toBe(true);
  });
});
