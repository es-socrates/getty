const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist-frontend');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

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

  const htmlFiles = fs.readdirSync(DIST_DIR).filter((file) => file.endsWith('.html'));
  if (htmlFiles.length === 0) {
    console.warn('[sync-frontend-dist] No HTML files found to sync');
  }

  for (const file of htmlFiles) {
    const srcPath = path.join(DIST_DIR, file);
    const destPath = path.join(PUBLIC_DIR, file);
    copyFile(srcPath, destPath);
  }

  const assetsSrc = path.join(DIST_DIR, 'assets');
  const assetsDest = path.join(PUBLIC_DIR, 'assets');
  if (fs.existsSync(assetsSrc)) {
    removeDirectory(assetsDest);
    copyDirectory(assetsSrc, assetsDest);
  }

  console.warn('[sync-frontend-dist] Synced HTML files:', htmlFiles.join(', ') || 'none');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('[sync-frontend-dist] Failed:', error);
    process.exit(1);
  }
}
