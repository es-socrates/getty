const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

function executeRuntime(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');

  const localStore = new Map();
  const sandbox = {
    window: {},
    document: {
      documentElement: { lang: 'en' },

      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: (ev, cb) => { if (ev === 'DOMContentLoaded') { try { cb(); } catch { /* ignore */ } } },
    },
    localStorage: {
      getItem: k => localStore.get(k) || null,
      setItem: (k, v) => { localStore.set(k, String(v)); },
      removeItem: k => { localStore.delete(k); },
    },
    console,
  };
  sandbox.window = sandbox.window || {};
  sandbox.window.document = sandbox.document;
  sandbox.window.localStorage = sandbox.localStorage;

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: path.basename(filePath) });
  if (!sandbox.window.__i18n) {
    throw new Error(`Runtime did not initialize window.__i18n for ${filePath}`);
  }
  return sandbox.window.__i18n;
}

describe('i18n runtime parity', () => {
  const jsDir = path.join(__dirname, '..', 'public', 'js', 'min');
  const readable = path.join(jsDir, 'i18n-runtime.js');
  const minified = path.join(jsDir, 'i18n-runtime.min.js');
  const buildScript = path.join(__dirname, '..', 'scripts', 'build-i18n.js');

  beforeAll(() => {
    if (!fs.existsSync(readable) || !fs.existsSync(minified)) {
      const result = spawnSync(process.execPath, [buildScript], { stdio: 'inherit' });
      if (result.status !== 0) {
        throw new Error('build-i18n.js failed to produce runtime files');
      }
    }
  });

  test('both runtime files export identical locale key sets', () => {
    const readableI18n = executeRuntime(readable);
    const minI18n = executeRuntime(minified);

    expect(new Set(readableI18n.locales)).toEqual(new Set(minI18n.locales));

    const extractLocalesObject = (codeStr) => {
      const marker = 'const locales = ';
      const idx = codeStr.indexOf(marker);
      if (idx === -1) throw new Error('Could not locate locales declaration');
      let start = idx + marker.length;

      while (/\s/.test(codeStr[start])) start++;
      if (codeStr[start] !== '{') throw new Error('Locales object does not start with {');
      let braceCount = 0;
      let i = start;
      for (; i < codeStr.length; i++) {
        const ch = codeStr[i];
        if (ch === '{') braceCount++;
        else if (ch === '}') {
          braceCount--;
          if (braceCount === 0) { i++; break; }
        }
      }
      const jsonLike = codeStr.slice(start, i);

      let jsonText = jsonLike
        .replace(/([,{\s])'(.*?)'(?=\s*:)/g, '$1"$2"')
        .replace(/: '(.*?)'/g, ': "$1"')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');

      const final = '{' + jsonText.replace(/^\{/, '').replace(/\}$/, '') + '}';
      return JSON.parse(final);
    };

    const readableSrc = fs.readFileSync(readable, 'utf8');
    const minifiedSrc = fs.readFileSync(minified, 'utf8');
    const readableLocalesObj = extractLocalesObject(readableSrc);
    const minifiedLocalesObj = extractLocalesObject(minifiedSrc);

    expect(Object.keys(readableLocalesObj).sort()).toEqual(Object.keys(minifiedLocalesObj).sort());
    Object.keys(readableLocalesObj).forEach(code => {
      expect(Object.keys(readableLocalesObj[code]).sort()).toEqual(Object.keys(minifiedLocalesObj[code]).sort());
    });
  });
});
