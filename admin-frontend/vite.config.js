import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  root: path.resolve(__dirname),
  base: '/admin/',
  build: {
    outDir: path.resolve(__dirname, '../public/admin-dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-core': ['vue','vue-router','vue-i18n'],
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
