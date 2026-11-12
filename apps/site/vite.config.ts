import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

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

/**
 * pinia 的开发构建里带着 devtools 的时间线桥（file-saver 的 saveAs → XMLHttpRequest + Blob），
 * 生产包一个字节都用不到，而包体安全检查会把它当「动态下载」，所以直接指到 prod 构建。
 *
 * ★ 路径必须**运行时解析**：`node_modules/.pnpm/pinia@<版本>_<hash>/...` 里的 hash 因平台与
 * 依赖图而变（CI 与本地就不一样），写死会在 CI 上直接「No such file or directory」。
 */
function resolvePiniaProd(): string | null {
  try {
    const require = createRequire(import.meta.url);
    return join(dirname(require.resolve('pinia')), 'pinia.esm-browser.prod.js');
  } catch {
    return null;
  }
}
const piniaProd = resolvePiniaProd();


/**
 * Toy 发布形态（`--mode toy`，见 apps/site/.env.toy）：
 * 把「按条目动态加载内容」的两处 glob 改成**显式白名单**。
 *
 * 只过滤界面是不够的：`import.meta.glob('*')` 会让 Vite 把 53 条内容各切一个 chunk，
 * 三十六计的旁白照样躺在包里 —— 审核扫的是产物，不是界面。所以这里在 transform 阶段
 * 把 glob 的通配符换成 Toy 版实际要上的那些条目。
 *
 * ★ 白名单必须与 apps/site/src/shell/profile.ts 的 TOY_IDS 保持一致（两边各有注释互相指向）。
 */
const TOY_IDS = [
  'caochong-elephant', 'pangu', 'nuwa', 'jingwei', 'kuafu', 'yugong', 'shennong', 'qiren',
  'fenghuo', 'taigong', 'dayu', 'kezhou', 'zhaosanmusi', 'jiaotu',
];
/** 摘要变量的白名单：`rawMantian` → `mantian-guohai`，与 TOY_IDS 一一对应 */

function toyContentPlugin(): Plugin {
  let enabled = false;
  return {
    name: 'chags-toy-content',
    enforce: 'pre',
    configResolved(config) {
      enabled = config.mode === 'toy';
    },
    /**
     * Toy 版要动两处源码：
     * 1. `entries/loaders.ts` 的两处 `import.meta.glob` 换成显式白名单（否则 53 条内容照样各切一个 chunk）；
     * 2. `apps/site/src/registry.ts` 的静态 import 表只留典故那 14 行（否则 53 个游戏 chunk 一个不少）。
     * 只在前端做界面过滤是不够的 —— 审核员看得到的是产物。
     */
    transform(code, id) {
      if (!enabled) return null;
      if (id.includes('/entries/loaders.ts')) {
        const detail = TOY_IDS.map((entry) => "'./" + entry + ".game.json'").join(', ');
        const en = TOY_IDS.map((entry) => "'../i18n/en/" + entry + ".game.json'").join(', ');
        const next = code
          .replace("import.meta.glob<{ default: EntryDetail }>('./*.game.json')", 'import.meta.glob<{ default: EntryDetail }>([' + detail + '])')
          .replace("import.meta.glob<{ default: unknown }>('../i18n/en/*.game.json')", 'import.meta.glob<{ default: unknown }>([' + en + '])');
        if (next === code) this.error('toy 模式没能在 loaders.ts 里找到两处 glob —— 正则与源码对不上了');
        return { code: next, map: null };
      }
      if (id.includes('/packages/content/src/i18n/en.ts')) {
        // 英文摘要补丁同样是静态 import 表：不裁的话，三十六计的英文标题会跟着进产物。
        const kept = code.split('\n').filter((line) => {
          const imp = /^\s*import (en\w+) from '\.\/en\/([a-z0-9-]+)\.json';\s*$/.exec(line);
          if (imp === null) return true;
          return TOY_IDS.includes(imp[2]);
        });
        // patches 对象里对应的键也要一起去掉，否则构建期报未定义变量
        const dropped = new Set(
          code
            .split('\n')
            .map((line) => /^\s*import (en\w+) from '\.\/en\/([a-z0-9-]+)\.json';\s*$/.exec(line))
            .filter((m): m is RegExpExecArray => m !== null && !TOY_IDS.includes(m[2]))
            .map((m) => m[1]!),
        );
        const cleaned = kept.filter((line) => {
          if (!/^\s*\[?'?[a-z0-9-]+'?\]:\s*en/.test(line)) return true;
          return ![...dropped].some((name) => line.includes(name + ','));
        });
        return { code: cleaned.join('\n'), map: null };
      }
      if (id.includes('/packages/content/src/entries/index.ts')) {
        // 摘要表是静态 import：不裁的话，三十六计的标题与简介会一起进产物。
        // 变量名不是从 id 拼出来的（第一条就叫 `raw`），所以先从 import 行建 var → id 的表，再按表裁剪。
        const varToId = new Map();
        for (const line of code.split('\n')) {
          const imp = /^\s*import (raw\w*) from '\.\/([a-z0-9-]+)\.json';\s*$/.exec(line);
          if (imp !== null) varToId.set(imp[1], imp[2]);
        }
        const kept = code.split('\n').filter((line) => {
          const summary = /^\s*summaryOf\((\w+)\)/.exec(line)?.[1];
          const imp = /^\s*import (raw\w*) from '\.\/([a-z0-9-]+)\.json';\s*$/.exec(line);
          if (summary !== undefined) {
            const entryId = varToId.get(summary);
            return entryId === undefined || TOY_IDS.includes(entryId);
          }
          if (imp !== null) return TOY_IDS.includes(imp[2]);
          return true;
        });
        return { code: kept.join('\n'), map: null };
      }
      if (id.includes('/apps/site/src/registry.ts')) {
        const kept = code.split('\n').filter((line) => {
          const key = /^\s*'?([a-z0-9-]+)'?:\s*\(\)\s*=>\s*import\(/.exec(line)?.[1];
          return key === undefined || TOY_IDS.includes(key);
        });
        return { code: kept.join('\n'), map: null };
      }
      return null;
    },
  };
}
export default defineConfig({
  base: './',
  // pinia 会把 devtools 的桥一起打进来（里面用 XHR 同步时间线），生产包不需要它：
  // 定义成 false 后 Rollup 能把整段静态消除 —— 这是包里最后一处 XHR。
  define: { __VUE_PROD_DEVTOOLS__: 'false' },
  plugins: [vue(), tailwindcss(), toyContentPlugin()],
  resolve: {
    // 只替换裸 'phaser' 导入；TS 类型仍解析到 phaser 包（typecheck 不受影响）
    alias: [
      // pinia 指到 prod 构建：devtools 桥里的 file-saver（XHR + Blob）不进包。
      // 路径是运行时解析出来的（见 resolvePiniaProd），不能写死 .pnpm 里的 hash。
      ...(piniaProd === null ? [] : [{ find: /^pinia$/, replacement: piniaProd }]),
      ...(useFullPhaser ? [] : [{ find: /^phaser$/, replacement: phaserTrim }]),
    ],
  },
  server: { host: '127.0.0.1', port: 5183, strictPort: true },
  build: {
    target: 'es2022',
    // 关掉 modulepreload 的 polyfill：它内部用 XHR 探测与 fetch 预载，",
    // 而包里一条网络请求都不应该存在（包体安全检查会把 XHR / fetch 当「动态下载」退件）。
    // 目标浏览器（Chrome 105+ / WebView）都原生支持 modulepreload，polyfill 只是冗余代码。
    modulePreload: { polyfill: false },
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