import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [vue(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5183, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
