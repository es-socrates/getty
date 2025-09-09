#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function integrityFor(filePath) {
  const data = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha384').update(data).digest('base64');
  return `sha384-${hash}`;
}

function addSriToHtml(htmlPath, rootDir) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  let changed = false;
  html = html.replace(/<(script)\s+([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/gi, (m, tag, pre, src, post) => {
    if (!src.startsWith('/')) return m;
    const cleanPath = src.split('?')[0];
    const fileFs = path.join(rootDir, cleanPath.replace(/^\//, ''));
    if (!fs.existsSync(fileFs)) return m;
    const sri = integrityFor(fileFs);

    let newPre = pre.replace(/\s+integrity=["'][^"']+["']/i, '').replace(/\s+crossorigin=["'][^"']+["']/i, '');
    let newPost = post.replace(/\s+integrity=["'][^"']+["']/i, '').replace(/\s+crossorigin=["'][^"']+["']/i, '');
    changed = true;
    return `<script ${newPre}src="${src}" integrity="${sri}" crossorigin="anonymous"${newPost}></script>`;
  });
  html = html.replace(/<(link)\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi, (m, tag, pre, href, post) => {
    if (!/rel=["']stylesheet["']/i.test(m)) return m;
    if (!href.startsWith('/')) return m;
    const cleanPath = href.split('?')[0];
    const fileFs = path.join(rootDir, cleanPath.replace(/^\//, ''));
    if (!fs.existsSync(fileFs)) return m;
    const sri = integrityFor(fileFs);

    let newPre = pre.replace(/\s+integrity=["'][^"']+["']/i, '').replace(/\s+crossorigin=["'][^"']+["']/i, '');
    let newPost = post.replace(/\s+integrity=["'][^"']+["']/i, '').replace(/\s+crossorigin=["'][^"']+["']/i, '');
    changed = true;
    return `<link ${newPre}href="${href}" integrity="${sri}" crossorigin="anonymous"${newPost}>`;
  });
  if (changed) fs.writeFileSync(htmlPath, html);
  return changed;
}

function main() {
  const publicDir = path.join(process.cwd(), 'public');
  const htmlFiles = [];
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) scan(p);
      else if (e.isFile() && p.endsWith('.html')) htmlFiles.push(p);
    }
  }
  scan(publicDir);
  let count = 0;
  for (const f of htmlFiles) {
    const changed = addSriToHtml(f, publicDir);
    if (changed) count++;
  }
  console.log(`[SRI] Processed ${htmlFiles.length} HTML files, updated ${count} with integrity attributes.`);
}

if (require.main === module) main();
