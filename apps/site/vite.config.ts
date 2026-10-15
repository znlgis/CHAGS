import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [vue(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5183, strictPort: true },
  // 告警线贴着 Phaser（约 1.65 MB 原始）之上：它本来就是共享的大 chunk，
  // 而任何**新增**的大 chunk 都该在构建日志里出声（体积门禁见 scripts/check-size.mjs）。
  build: { target: 'es2022', chunkSizeWarningLimit: 1800 },
});
