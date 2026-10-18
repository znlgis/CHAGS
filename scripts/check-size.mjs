import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * 体积守卫。
 *
 * 技术方案里把体积当硬指标写进了预算表，但一直没有东西真的守着它 ——
 * 这个脚本补上：改坏了直接让 pnpm verify / CI 失败。
 *
 * 五条口径，缺一不可：
 * 1. **首屏**：index.html 里实际引用的 js/css（含 modulepreload 的 href）+ 内联的脚本与样式文本。
 *    内联那一项是防止"把入口改成内联 bootstrap、真入口改成动态 import"
 *    这种把首屏偷换成懒加载 chunk 的改法。
 * 2. **单个懒加载 chunk**：点了某个游戏才会加载的 js/css（只比 js/css，
 *    图片字体等已经压缩过，拿 gzip 比会误报）。
 * 3. **整个 dist 的原始大小**：Tauri 桌面版与安卓版是本地文件加载，不过 gzip，
 *    原始字节才是它们的真实成本，所以首屏与 chunk 除了 gzip 也各有一条原始预算。
 * 4. **单个非代码资源**：图片/字体/音频没有 gzip 红利，单文件必须有上限
 *    （技术方案 §2.4 的"单图 ≤200 KB"以前只写在文档里）。
 * 5. **非代码资源总量**：防止"一张 900 KB 的 PNG 从 dist 总预算的余量里溜过去"。
 */
const DIST = 'apps/site/dist';

const BUDGETS = {
  /** 首屏 JS + CSS（gzip）—— 决定用户多久能看到典故馆（2026-10-18 实测 53.7 KB） */
  initialKb: 65,
  /** 首屏 JS + CSS（原始字节）—— 桌面 / 安卓壳是本地加载，省不掉 */
  initialRawKb: 180,
  /** 单个懒加载 js/css（gzip）—— 目前最大的是 Phaser 裁剪版（约 222 KB） */
  chunkKb: 260,
  /** 单个懒加载 js/css（原始字节）—— Phaser 裁剪版约 0.86 MB */
  chunkRawKb: 1000,
  /** 整个 dist 的原始大小 */
  distKb: 2900,
  /** 单个图片 / 字体 / 音频文件 */
  assetKb: 200,
  /** 非代码资源总量 */
  assetsKb: 600,
};

const CODE = /\.(?:js|css)$/;
const ASSET = /\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|mp3|ogg|wav|m4a|mp4)$/i;

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

/** index.html 里 src/href 指向的 js/css —— 这些首屏必须下载（modulepreload 的 href 同样算） */
const referenced = new Set(
  [...html.matchAll(/(?:src|href)="\.?\/?([^"]+\.(?:js|css))"/g)].map((m) =>
    join(DIST, m[1]).replace(/\\/g, '/'),
  ),
);
/** 内联的 <script>/<style> 文本 —— 它们同样属于首屏 */
const inlineBytes = [...html.matchAll(/<(script|style)[^>]*>([\s\S]*?)<\/\1>/g)]
  .filter((m) => m[2].trim().length > 0)
  .reduce((sum, m) => sum + Buffer.byteLength(m[2], 'utf8'), 0);

if (referenced.size === 0) {
  console.error('  ✗ index.html 里没有任何 js/css 引用 —— 产物结构可能变了，先人工确认再改这个脚本');
  failure += 1;
}

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

// ---------- 非代码资源：单文件上限 + 总量上限 ----------
const assets = files.filter((path) => ASSET.test(path));
if (assets.length > 0) {
  console.log('\n非代码资源：');
  let assetsTotal = 0;
  let biggestAsset = { name: '(无)', bytes: 0 };
  for (const path of assets) {
    const bytes = statSync(path).size;
    assetsTotal += bytes;
    if (bytes > biggestAsset.bytes) biggestAsset = { name: relative(DIST, path), bytes };
    if (bytes > BUDGETS.assetKb * 1024) {
      console.error('  ✗ ' + relative(DIST, path) + '：' + kb(bytes) + ' KB 超过单文件预算 ' + BUDGETS.assetKb + ' KB');
      failure += 1;
    }
  }
  console.log('  · ' + assets.length + ' 个文件，最大 ' + biggestAsset.name + ' ' + kb(biggestAsset.bytes) + ' KB');
  check('非代码资源合计', kb(assetsTotal), BUDGETS.assetsKb);
} else {
  console.log('\n非代码资源：无（目前全部是几何绘制 + WebAudio 合成）');
}

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
