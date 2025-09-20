/* eslint-env node */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
const fs = require('fs');
const os = require('os');
const path = require('path');

function setupConfigSandbox(copyFiles = []) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'getty-config-'));
  process.env.GETTY_CONFIG_DIR = tmpDir;
  const baseDir = path.join(process.cwd(), 'config');
  copyFiles.forEach(name => {
    try {
      const src = path.join(baseDir, name);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(tmpDir, name));
      }
    } catch (e) { /* ignore copy error */ }
  });
  return {
    dir: tmpDir,
    cleanup() {
      try {
        fs.readdirSync(tmpDir).forEach(f => {
          try { fs.unlinkSync(path.join(tmpDir, f)); } catch (e) { /* ignore unlink */ }
        });
        fs.rmdirSync(tmpDir);
      } catch (e) { /* ignore cleanup */ }
    }
  };
}

module.exports = { setupConfigSandbox };