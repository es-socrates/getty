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
  root: __dirname,
  base: '/admin/',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    __GETTY_CSRF_HEADER__: '"' + ((globalThis.process && globalThis.process.env && globalThis.process.env.VITE_GETTY_CSRF_HEADER) || '') + '"',
    __GETTY_VERBOSE_CSRF__: '"' + ((globalThis.process && globalThis.process.env && globalThis.process.env.VITE_GETTY_VERBOSE_CSRF) || '') + '"'
  },
  envPrefix: 'VITE_',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: path.resolve(__dirname, '../public/admin-dist'),
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
    workerThreads: false,
    minify: 'esbuild',
    rollupOptions: {
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
