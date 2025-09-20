#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

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

const files = listFiles(PUBLIC_JS).filter(f => !/[/\\]min[/\\]/.test(f));
const forbidden = [];
const pattern = /(new\s+WebSocket\([^\n]*\?token=)|((ws|wss):\/\/[^\n]*\?token=)/g;

for (const file of files) {
  if (file.endsWith(path.join('lib', 'token-compat.js'))) continue;
  const rel = path.relative(ROOT, file).replace(/\\/g,'/');
  const content = fs.readFileSync(file, 'utf8');

  if (!content.includes('?token=')) continue;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const lineStart = content.lastIndexOf('\n', match.index) + 1;
    const lineEnd = content.indexOf('\n', match.index);
    const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    if (/tokenCompat\.legacyTokenSuffix/.test(line)) continue;
    forbidden.push({ file: rel, line });
  }
}

if (forbidden.length) {
  console.error('\n[guard-ws-token] Forbidden raw ?token= WebSocket usage detected:');
  for (const f of forbidden) {
    console.error(`  - ${f.file}: ${f.line.trim()}`);
  }
  console.error('\nUse window.tokenCompat.legacyTokenSuffix() instead.');
  process.exit(1);
} else {
  if (process.env.GETTY_VERBOSE_GUARDS === '1') {
    try { console.warn('[guard-ws-token] OK: no forbidden WebSocket ?token= patterns found.'); } catch {}
  }
}
