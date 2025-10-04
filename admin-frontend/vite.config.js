import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let appVersion = 'dev';
try {
  const rootPkgPath = path.resolve(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
  appVersion = pkg.version || 'dev';
} catch {
  // ignore version read errors
}

export default defineConfig({
  plugins: [vue()],
  root: path.resolve(__dirname),
  base: '/admin/',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    __GETTY_CSRF_HEADER__: '"' + ((globalThis.process && globalThis.process.env && globalThis.process.env.VITE_GETTY_CSRF_HEADER) || '') + '"',
    __GETTY_VERBOSE_CSRF__: '"' + ((globalThis.process && globalThis.process.env && globalThis.process.env.VITE_GETTY_VERBOSE_CSRF) || '') + '"'
  },
  envPrefix: 'VITE_',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'shared-i18n': path.resolve(__dirname, '../shared-i18n')
    }
  },
  build: {
    outDir: path.resolve(__dirname, '..', 'dist'),
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        manualChunks: {
          'vue-core': ['vue', 'vue-router', 'vue-i18n'],
          'axios': ['axios']
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/widgets': 'http://localhost:3000',
      '/obs': 'http://localhost:3000'
    }
  }
});
