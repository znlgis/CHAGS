import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * 体积守卫。
 *
 * 技术方案里把体积当硬指标写进了预算表，但一直没有东西真的守着它 ——
 * 这个脚本补上：改坏了直接让 pnpm verify / CI 失败。
 *
 * 三条口径，缺一不可：
 * 1. **首屏**：index.html 里实际引用的 js/css + 内联的脚本与样式文本。
 *    内联那一项是防止"把入口改成内联 bootstrap、真入口改成动态 import"
 *    这种把首屏偷换成懒加载 chunk 的改法。
 * 2. **单个懒加载 chunk**：点了某个游戏才会加载的 js/css（只比 js/css，
 *    图片字体等已经压缩过，拿 gzip 比会误报）。
 * 3. **整个 dist 的原始大小**：Tauri 桌面版与安卓版是本地文件加载，不过 gzip，
 *    原始字节才是它们的真实成本，所以首屏与 chunk 除了 gzip 也各有一条原始预算。
 */
const DIST = 'apps/site/dist';

const BUDGETS = {
  /** 首屏 JS + CSS（gzip）—— 决定用户多久能看到典故馆 */
  initialKb: 150,
  /** 首屏 JS + CSS（原始字节）—— 桌面 / 安卓壳是本地加载，省不掉 */
  initialRawKb: 500,
  /** 单个懒加载 js/css（gzip）—— 目前最大的是 Phaser */
  chunkKb: 450,
  /** 单个懒加载 js/css（原始字节）—— Phaser 约 1.7 MB */
  chunkRawKb: 1800,
  /** 整个 dist 的原始大小 */
  distKb: 3500,
};

const CODE = /\.(?:js|css)$/;

function kb(bytes) {
  return Math.round((bytes / 1024) * 10) / 10;
}

function gzipKb(path) {
  return kb(gzipSync(readFileSync(path)).length);
}

/** dist 下所有文件（递归；目录必须跳过，否则 readFileSync 会 EISDIR） */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.isFile()) out.push(path);
  }
  return out;
}

let failure = 0;

function check(label, actualKb, budgetKb) {
  const ok = actualKb <= budgetKb;
  if (!ok) failure += 1;
  console.log((ok ? '  ✓ ' : '  ✗ ') + label + '：' + actualKb + ' KB / 预算 ' + budgetKb + ' KB');
}

const files = walk(DIST);
const html = readFileSync(join(DIST, 'index.html'), 'utf8');

/** index.html 里 src/href 指向的 js/css —— 这些首屏必须下载 */
const referenced = new Set(
  [...html.matchAll(/(?:src|href)="\.?\/?([^"]+\.(?:js|css))"/g)].map((m) =>
    join(DIST, m[1]).replace(/\\/g, '/'),
  ),
);
/** 内联的 <script>/<style> 文本 —— 它们同样属于首屏 */
const inlineBytes = [...html.matchAll(/<(script|style)[^>]*>([\s\S]*?)<\/\1>/g)]
  .filter((m) => m[2].trim().length > 0)
  .reduce((sum, m) => sum + Buffer.byteLength(m[2], 'utf8'), 0);

console.log('\n首屏必须下载的：');
let initialGzip = 0;
let initialRaw = inlineBytes;
if (inlineBytes > 0) console.log('  · index.html 内联脚本/样式  ' + kb(inlineBytes) + ' KB');
for (const path of files) {
  if (!referenced.has(path.replace(/\\/g, '/'))) continue;
  const raw = statSync(path).size;
  const gz = gzipKb(path);
  initialGzip += gz;
  initialRaw += raw;
  console.log('  · ' + relative(DIST, path) + '  ' + gz + ' KB (gzip) / ' + kb(raw) + ' KB');
}
check('首屏 JS+CSS 合计（gzip）', Math.round(initialGzip * 10) / 10, BUDGETS.initialKb);
check('首屏 JS+CSS 合计（原始）', kb(initialRaw), BUDGETS.initialRawKb);

// modulepreload 会让浏览器提前拉某个懒加载 chunk：那也算首屏 —— 但 Vite 目前不生成，
// 真生成了会在下面按"懒加载"统计，所以这里显式提醒一句。
const preloaded = [...html.matchAll(/rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
if (preloaded.length > 0) {
  console.log('\n注意：index.html 预加载了 ' + preloaded.length + ' 个 chunk（会进首屏预算）');
}

console.log('\n按需加载的 chunk：');
let biggestGzip = { name: '(无)', size: 0 };
let biggestRaw = { name: '(无)', bytes: 0 };
for (const path of files) {
  const posix = path.replace(/\\/g, '/');
  if (!CODE.test(path) || referenced.has(posix)) continue;
  const raw = statSync(path).size;
  const gz = gzipKb(path);
  if (gz > biggestGzip.size) biggestGzip = { name: relative(DIST, path), size: gz };
  if (raw > biggestRaw.bytes) biggestRaw = { name: relative(DIST, path), bytes: raw };
  console.log('  · ' + relative(DIST, path) + '  ' + gz + ' KB (gzip) / ' + kb(raw) + ' KB');
}
check('最大的懒加载 chunk（' + biggestGzip.name + '）', biggestGzip.size, BUDGETS.chunkKb);
check('最大的懒加载 chunk 原始大小（' + biggestRaw.name + '）', kb(biggestRaw.bytes), BUDGETS.chunkRawKb);

const distTotal = files.reduce((sum, path) => sum + statSync(path).size, 0);
console.log('\ndist 共 ' + files.length + ' 个文件');
check('dist 原始大小', kb(distTotal), BUDGETS.distKb);

if (failure > 0) {
  console.error(
    '\n体积超预算：' + failure + ' 项。要么优化，要么在 scripts/check-size.mjs 里调整预算并说明原因。',
  );
  process.exit(1);
}
console.log('\n体积在预算内 ✅');
