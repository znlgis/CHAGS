import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * 体积守卫。
 *
 * 技术方案里把体积当硬指标写进了预算表，但一直没有东西真的守着它 ——
 * 这个脚本补上：改坏了直接让 pnpm verify 失败。
 *
 * 判定依据是 index.html 里实际引用的资源 = 首屏必须下载的；
 * assets 里其余文件 = 点了某个游戏才会加载的。
 */
const DIST = 'apps/site/dist';
const ASSETS = join(DIST, 'assets');

const BUDGETS = {
  /** 首屏 JS + CSS（gzip）—— 决定用户多久能看到典故馆 */
  initialKb: 150,
  /** 单个懒加载 chunk（gzip）—— 目前最大的是 Phaser */
  chunkKb: 450,
  /** assets 目录原始大小 */
  totalKb: 3500,
};

function kb(bytes) {
  return Math.round((bytes / 1024) * 10) / 10;
}

function gzipKb(path) {
  return kb(gzipSync(readFileSync(path)).length);
}

let failure = 0;

function check(label, actualKb, budgetKb) {
  const ok = actualKb <= budgetKb;
  if (!ok) failure += 1;
  console.log(
    (ok ? '  ✓ ' : '  ✗ ') + label + '：' + actualKb + ' KB / 预算 ' + budgetKb + ' KB',
  );
}

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const referenced = [...html.matchAll(/(?:src|href)="\.?\/?([^"]+\.(?:js|css))"/g)].map(
  (m) => m[1],
);

let initialTotal = 0;
console.log('\n首屏必须下载的：');
for (const rel of referenced) {
  const path = join(DIST, rel);
  const size = gzipKb(path);
  initialTotal += size;
  console.log('  · ' + rel + '  ' + size + ' KB (gzip)');
}
check('首屏 JS+CSS 合计', Math.round(initialTotal * 10) / 10, BUDGETS.initialKb);

console.log('\n按需加载的 chunk：');
let assetTotal = 0;
let biggest = { name: '', size: 0 };
for (const name of readdirSync(ASSETS)) {
  const path = join(ASSETS, name);
  assetTotal += statSync(path).size;
  if (referenced.some((r) => r.endsWith(name))) continue;
  const size = gzipKb(path);
  if (size > biggest.size) biggest = { name, size };
  console.log('  · ' + name + '  ' + size + ' KB (gzip)');
}
check('最大的懒加载 chunk（' + biggest.name + '）', biggest.size, BUDGETS.chunkKb);
check('assets 目录原始大小', kb(assetTotal), BUDGETS.totalKb);

if (failure > 0) {
  console.error('\n体积超预算：' + failure + ' 项。要么优化，要么在 scripts/check-size.mjs 里调整预算并说明原因。');
  process.exit(1);
}
console.log('\n体积在预算内 ✅');
