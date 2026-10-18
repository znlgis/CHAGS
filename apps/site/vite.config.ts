import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

/**
 * 产物命名：以前 54 个 chunk 全叫 src-<hash>.js（含 1.6 MB 的 Phaser），
 * 排查"这个文件是什么、什么时候被下载"只能靠猜，体积报告也读不出信息。
 * 现在按"游戏 / 内容 / 第三方"分前缀，失败时一眼能看出是哪个 chunk 出问题。
 */
/**
 * Phaser 用自定义裁剪版（B 档，-36% gzip）：完整包里 physics / tilemaps / sound / animations 等
 * 系统对 53 个游戏是纯死重。产物由 `pnpm phaser:trim` 生成，
 * 说明见 packages/phaser-kit/vendor/README.md；PHASER_FULL=1 可临时回退完整包排查问题。
 */
const phaserTrim = fileURLToPath(new URL('../../packages/phaser-kit/vendor/phaser-trim.esm.js', import.meta.url));
const useFullPhaser = process.env.PHASER_FULL === '1';

export default defineConfig({
  base: './',
  plugins: [vue(), tailwindcss()],
  resolve: {
    // 只替换裸 'phaser' 导入；TS 类型仍解析到 phaser 包（typecheck 不受影响）
    alias: useFullPhaser ? [] : [{ find: /^phaser$/, replacement: phaserTrim }],
  },
  server: { host: '127.0.0.1', port: 5183, strictPort: true },
  build: {
    target: 'es2022',
    // 告警线贴着裁剪后的 Phaser（约 877 KB 原始）：它本来就是共享的大 chunk，
    // 而任何**新增**的大 chunk 都该在构建日志里出声（体积门禁见 scripts/check-size.mjs）。
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        // Phaser 单独成 chunk：体积预算、缓存与排障都需要它可辨认（同尺寸下也比混在一起好缓存）。
        // 默认命中裁剪版产物（packages/phaser-kit/vendor/）；PHASER_FULL=1 时命中完整 phaser 包。
        codeSplitting: {
          groups: [
            { name: 'vendor-phaser', test: /node_modules[\\/]phaser[\\/]|phaser-kit[\\/]vendor[\\/]phaser-trim/ },
          ],
        },
        chunkFileNames(chunk) {
          const id = chunk.facadeModuleId ?? '';
          const game = /[\\/]games[\\/]([^\\/]+)[\\/]src[\\/]index\.ts$/.exec(id);
          if (game) return 'assets/game-' + game[1] + '-[hash].js';
          const content = /[\\/]entries[\\/]([^\\/]+)\.game\.json$/.exec(id);
          if (content) return 'assets/content-' + content[1] + '-[hash].js';
          const en = /[\\/]i18n[\\/]en[\\/]([^\\/]+)\.game\.json$/.exec(id);
          if (en) return 'assets/content-' + en[1] + '-en-[hash].js';
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
});
