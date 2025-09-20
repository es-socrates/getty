const fs = require('fs');
const path = require('path');

function loadTokenCompat() {
  const file = path.join(__dirname, '..', 'public', 'js', 'lib', 'token-compat.js');
  const src = fs.readFileSync(file, 'utf8');
  const sandbox = { window: {}, document: { cookie: '' } };
  const fn = new Function('window', 'document', src + '\nreturn window.tokenCompat;');
  return (cookie) => {
    sandbox.document.cookie = cookie || '';
    return fn(sandbox.window, sandbox.document);
  };
}

describe('tokenCompat wallet-only shim', () => {
  const factory = loadTokenCompat();

  test('exposes hasWalletSessionCookie', () => {
    const compat = factory('');
    expect(typeof compat.hasWalletSessionCookie).toBe('function');
    expect(compat.hasWalletSessionCookie()).toBe(false);
    const withCookie = factory('getty_wallet_session=abc');
    expect(withCookie.hasWalletSessionCookie()).toBe(true);
  });

  test('legacy helpers removed', () => {
    const compat = factory('');
    expect(compat.getLegacyToken).toBeUndefined();
    expect(compat.legacyTokenSuffix).toBeUndefined();
    expect(compat.appendTokenIfNeeded).toBeUndefined();
  });
});
