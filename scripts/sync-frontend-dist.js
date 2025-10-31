const fs = require('fs');
const path = require('path');
const { addSriToHtml } = require('./add-sri');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist-frontend');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DIST_WIDGETS_DIR = path.join(DIST_DIR, 'widgets');
const PUBLIC_WIDGETS_DIR = path.join(PUBLIC_DIR, 'widgets');

function mkdirp(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(src, dest) {
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDirectory(src, dest) {
  mkdirp(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      copyFile(srcPath, destPath);
    }
  }
}

function listHtmlFiles(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const srcPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listHtmlFiles(srcPath, base));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(path.relative(base, srcPath));
    }
  }
  return results;
}

function removeDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('[sync-frontend-dist] Missing dist-frontend build artifacts');
    process.exit(1);
  }

  const htmlFiles = listHtmlFiles(DIST_DIR);
  if (htmlFiles.length === 0) {
    console.warn('[sync-frontend-dist] No HTML files found to sync');
  }

  const widgetPrefix = `widgets${path.sep}`;
  const widgetHtmlFiles = htmlFiles.filter((file) => file.startsWith(widgetPrefix));
  const nonWidgetHtmlFiles = htmlFiles.filter((file) => !file.startsWith(widgetPrefix));

  const syncedHtmlAbsolute = [];

  for (const file of nonWidgetHtmlFiles) {
    const srcPath = path.join(DIST_DIR, file);
    const destPath = path.join(PUBLIC_DIR, file);
    copyFile(srcPath, destPath);
    syncedHtmlAbsolute.push(destPath);
  }

  if (fs.existsSync(DIST_WIDGETS_DIR)) {
    removeDirectory(PUBLIC_WIDGETS_DIR);
    copyDirectory(DIST_WIDGETS_DIR, PUBLIC_WIDGETS_DIR);
    for (const file of widgetHtmlFiles) {
      syncedHtmlAbsolute.push(path.join(PUBLIC_DIR, file));
    }
  } else if (widgetHtmlFiles.length > 0) {
    for (const file of widgetHtmlFiles) {
      const srcPath = path.join(DIST_DIR, file);
      const destPath = path.join(PUBLIC_DIR, file);
      copyFile(srcPath, destPath);
      syncedHtmlAbsolute.push(destPath);
    }
  }

  const assetsSrc = path.join(DIST_DIR, 'assets');
  const assetsDest = path.join(PUBLIC_DIR, 'assets');
  if (fs.existsSync(assetsSrc)) {
    removeDirectory(assetsDest);
    copyDirectory(assetsSrc, assetsDest);
  }

  let sriUpdates = 0;
  for (const htmlPath of syncedHtmlAbsolute) {
    if (!fs.existsSync(htmlPath)) continue;
    const changed = addSriToHtml(htmlPath, PUBLIC_DIR);
    if (changed) sriUpdates += 1;
  }
  const syncedHtml = nonWidgetHtmlFiles.concat(widgetHtmlFiles).sort();
  console.warn('[sync-frontend-dist] Synced HTML files:', syncedHtml.join(', ') || 'none');
  if (syncedHtmlAbsolute.length > 0) {
    console.warn(`[sync-frontend-dist] Applied SRI to ${sriUpdates} of ${syncedHtmlAbsolute.length} synced HTML files.`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('[sync-frontend-dist] Failed:', error);
    process.exit(1);
  }
}
