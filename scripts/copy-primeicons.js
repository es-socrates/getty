const fs = require('fs');
const path = require('path');

const srcCss = path.join(__dirname, '..', 'node_modules', 'primeicons', 'primeicons.css');
const srcFontsDir = path.join(__dirname, '..', 'node_modules', 'primeicons', 'fonts');
const destDir = path.join(__dirname, '..', 'public', 'vendor', 'primeicons');
const destCss = path.join(destDir, 'primeicons.css');
const destFontsDir = path.join(destDir, 'fonts');

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  mkdirp(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      copyFile(srcPath, destPath);
    }
  }
}

function main() {
  try {
    mkdirp(destDir);
    copyFile(srcCss, destCss);
    copyDir(srcFontsDir, destFontsDir);

    const cssContent = fs.readFileSync(destCss, 'utf8');
    const normalized = cssContent.replace(/\r?\n/g, '\n');
    fs.writeFileSync(destCss, normalized, 'utf8');

    console.warn('PrimeIcons assets copied to public/vendor/primeicons');
  } catch (err) {
    console.error('Failed to copy PrimeIcons assets:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
