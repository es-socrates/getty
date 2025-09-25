const fs = require('fs');
const path = require('path');

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function main() {
  try {
    const src = path.join(__dirname, '..', 'admin-frontend', 'src', 'assets', 'odysee.png');
    const dest = path.join(__dirname, '..', 'public', 'assets', 'odysee.png');
    if (!fs.existsSync(src)) {
      console.warn('[copy-landing-assets] source not found:', src);
      return;
    }
    copyFile(src, dest);
    console.warn('[copy-landing-assets] copied to', dest);
  } catch (err) {
    console.error('[copy-landing-assets] failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
