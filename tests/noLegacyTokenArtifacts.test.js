const fs = require('fs');
const path = require('path');

describe('legacy token artifacts removal', () => {
  const ROOT = path.resolve(__dirname, '..');
  const PUBLIC_JS = path.join(ROOT, 'public', 'js');

  function listFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) out.push(...listFiles(full));
      else if (full.endsWith('.js')) out.push(full);
    }
    return out;
  }

  test('no legacy helper function references in runtime sources', () => {
    const files = listFiles(PUBLIC_JS).filter(f => !/[/\\]min[/\\]/.test(f));
    const forbidden = ['legacyTokenSuffix', 'appendTokenIfNeeded', 'getLegacyToken'];
    const offenders = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const frag of forbidden) {
        if (content.includes(frag)) {
          offenders.push({ file: path.relative(ROOT, file), frag });
        }
      }
    }
    if (offenders.length) {
      const msg = offenders.map(o => `${o.file} -> ${o.frag}`).join('\n');
      throw new Error('Found forbidden legacy token references:\n' + msg);
    }
  });

  test('token-compat shim exposes only hasWalletSessionCookie', () => {
    const compatPath = path.join(PUBLIC_JS, 'lib', 'token-compat.js');
    const content = fs.readFileSync(compatPath, 'utf8');
    expect(content).toMatch(/hasWalletSessionCookie/);
    expect(content).not.toMatch(/legacyTokenSuffix|appendTokenIfNeeded|getLegacyToken/);
  });
});
