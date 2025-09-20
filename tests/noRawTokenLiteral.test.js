const fs = require('fs');
const path = require('path');

const ADMIN_SRC = path.join(__dirname, '..', 'admin-frontend', 'src');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(js|vue|ts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const RAW_PATTERN = ['?tok','en='].join('');
describe('no raw ' + RAW_PATTERN + ' literals in admin src', () => {
  const files = walk(ADMIN_SRC);
  test('no disallowed literal present', () => {
    const offenders = [];
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');

  if (text.includes(RAW_PATTERN)) {
        const lines = text.split(/\n/);
        lines.forEach((ln, idx) => {
          if (ln.includes(RAW_PATTERN)) {
            const trimmed = ln.trim();
            const inComment = trimmed.startsWith('//') || /\/\*.*?\?token=.*?\*\//.test(trimmed);
            if (!inComment) offenders.push(`${f}:${idx + 1}`);
          }
        });
      }
    }
    if (offenders.length) {
  throw new Error('Raw ' + RAW_PATTERN + ' usage detected in admin src:\n' + offenders.join('\n'));
    }
  });
});
