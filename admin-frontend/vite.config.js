import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [vue()],
  root: __dirname,
  base: '/admin/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: path.resolve(__dirname, '../public/admin-dist'),
    emptyOutDir: true,
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
