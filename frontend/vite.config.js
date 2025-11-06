import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = path.resolve(__dirname);

const pageEntries = {
  landing: path.resolve(rootDir, 'landing.html'),
  index: path.resolve(rootDir, 'index.html'),
  welcome: path.resolve(rootDir, 'welcome.html'),
  dashboard: path.resolve(rootDir, 'dashboard.html'),
  profile: path.resolve(rootDir, 'profile.html'),
  notFound: path.resolve(rootDir, '404.html')
};

const widgetEntries = {
  'widgets/announcement': path.resolve(rootDir, 'widgets/announcement.html'),
  'widgets/liveviews': path.resolve(rootDir, 'widgets/liveviews.html'),
  'widgets/achievements': path.resolve(rootDir, 'widgets/achievements.html'),
  'widgets/chat': path.resolve(rootDir, 'widgets/chat.html'),
  'widgets/events': path.resolve(rootDir, 'widgets/events.html'),
  'widgets/last-tip': path.resolve(rootDir, 'widgets/last-tip.html'),
  'widgets/persistent-notifications': path.resolve(rootDir, 'widgets/persistent-notifications.html'),
  'widgets/raffle': path.resolve(rootDir, 'widgets/raffle.html'),
  'widgets/socialmedia': path.resolve(rootDir, 'widgets/socialmedia.html'),
  'widgets/tip-goal': path.resolve(rootDir, 'widgets/tip-goal.html'),
  'widgets/tip-notification': path.resolve(rootDir, 'widgets/tip-notification.html')
};

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
  root: rootDir,
  base: '/',
  envPrefix: 'VITE_',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    __GETTY_CSRF_HEADER__: '"' + ((globalThis.process && globalThis.process.env && globalThis.process.env.VITE_GETTY_CSRF_HEADER) || '') + '"',
    __GETTY_VERBOSE_CSRF__: '"' + ((globalThis.process && globalThis.process.env && globalThis.process.env.VITE_GETTY_VERBOSE_CSRF) || '') + '"'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'shared-i18n': path.resolve(__dirname, '../shared-i18n')
    }
  },
  build: {
    outDir: path.resolve(__dirname, '..', 'dist-frontend'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        ...pageEntries,
        ...widgetEntries
      }
    }
  },
  publicDir: path.resolve(__dirname, '../public'),
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3000',
      '/widgets': 'http://localhost:3000',
      '/obs': 'http://localhost:3000',
      '/css': 'http://localhost:3000',
      '/js': 'http://localhost:3000',
      '/assets': 'http://localhost:3000',
      '/vendor': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
      '/favicon.ico': 'http://localhost:3000',
      '/robots.txt': 'http://localhost:3000',
      '/sitemap.xml': 'http://localhost:3000'
    }
  }
});
