import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { deflateRawSync } from 'node:zlib';

/**
 * 打「哔哩哔哩 Toy」能直接上传的 zip，并把平台的硬性要求当成门禁跑一遍。
 *
 * 依据《Toy 开发者 FAQ》（更新至 2026.10.23）与 Toy 发布页的常见问题：
 *   1. 压缩包**根目录**必须有 index.html（七·5），不能把 dist/ 整个目录打进去；
 *   2. **index.html ≤ 1 MB**（一·15），超了平台在页面加载阶段就失败；
 *   3. **整包 ≤ 50 MB**（一·6），更大包体要走「创作者设置」单独申请；
 *   4. 只有**白名单后缀**的文件会被发布，可执行文件 / 后端脚本会被自动过滤（七·1）；
 *   5. Toy 内不得跳转站外链接（四·4、四·12），所以产物里出现站外绝对地址要拦；
 *   6. 不发布 sourcemap：既浪费体积，也把源码直接摊开。
 *
 * 用 Node 自带 zlib 自己写 zip，不依赖系统 zip 命令（Windows 的 MSYS 里没有，CI 的 ubuntu 上却有，
 * 靠外部命令会变成「换台机器就挂」）。
 */

const DIST = 'apps/site/dist';
const OUT_DIR = 'release';
const ENTRY = 'index.html';

/** 平台入口文件上限：1 MB（FAQ 一·15） */
const MAX_ENTRY_BYTES = 1 * 1024 * 1024;
/** 整包上限：50 MB（FAQ 一·6） */
const MAX_PACKAGE_BYTES = 50 * 1024 * 1024;

/** 会被平台发布的白名单后缀（FAQ 七·1）。不在表里的直接判失败 —— 与其上传后被静默过滤，不如本地就红了 */
const ALLOWED = new Set([
  '.html', '.htm', '.js', '.mjs', '.cjs', '.css', '.json', '.txt', '.xml', '.webmanifest',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.bmp', '.avif',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac', '.mp4', '.webm',
  '.wasm', '.glsl', '.vert', '.frag', '.atlas', '.bin', '.data',
]);
/** 明确是「可执行 / 后端脚本」的后缀：出现就必须人工处理，不能只靠白名单兜底 */
const FORBIDDEN = new Set(['.exe', '.dll', '.so', '.dylib', '.sh', '.bat', '.cmd', '.ps1', '.php', '.cgi', '.py', '.rb', '.jar', '.msi', '.apk']);

let failure = 0;
function fail(message) {
  console.error('  ✗ ' + message);
  failure += 1;
}
function ok(message) {
  console.log('  ✓ ' + message);
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.isFile()) out.push(path);
  }
  return out;
}

if (!existsSync(join(DIST, ENTRY))) {
  console.error('找不到 ' + join(DIST, ENTRY) + '：先跑 pnpm build');
  process.exit(1);
}

console.log('Toy 打包检查：');
if (existsSync(join(DIST, 'dist')) || existsSync(join(DIST, 'src'))) {
  fail(DIST + ' 里还套着一层目录 —— zip 根目录必须**直接**是 index.html 与 assets/');
} else {
  ok('根目录结构正确（' + ENTRY + ' 与 assets/ 同级）');
}

const files = walk(DIST).sort();

const entryBytes = statSync(join(DIST, ENTRY)).size;
if (entryBytes > MAX_ENTRY_BYTES) fail(ENTRY + ' ' + (entryBytes / 1024).toFixed(1) + ' KB，超过 1 MB 入口上限（FAQ 一·15）');
else ok(ENTRY + ' ' + (entryBytes / 1024).toFixed(1) + ' KB / 上限 1024 KB');

const seenExt = new Set();
const blocked = [];
for (const path of files) {
  const name = relative(DIST, path).replace(/\\/g, '/');
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  seenExt.add(ext);
  if (name.endsWith('.map')) { blocked.push(name + '（sourcemap 不发布）'); continue; }
  if (FORBIDDEN.has(ext)) blocked.push(name + '（可执行 / 后端脚本，平台会过滤）');
  else if (!ALLOWED.has(ext)) blocked.push(name + '（后缀 ' + ext + ' 不在白名单内）');
}
if (blocked.length > 0) {
  for (const item of blocked.slice(0, 10)) fail(item);
  if (blocked.length > 10) fail('…… 还有 ' + (blocked.length - 10) + ' 个同类文件');
} else {
  ok('全部 ' + files.length + ' 个文件都在发布白名单内（' + [...seenExt].sort().join(' ') + '）');
}

// 站外链接（FAQ 四·4 / 四·12）：Vue 的报错文案里带 vuejs.org、Phaser 里带自己的文档地址，
// 那些是字符串常量，不会发起请求；这里只拦「看起来会被真的加载」的写法。
const EXTERNAL_LOAD = /(?:src|href)\s*=\s*["']https?:\/\//i;
const ABS_FETCH = /(?:fetch\(|import\s*\(|new\s+Worker\(|url\()\s*["'\x60]https?:\/\//;
const external = [];
for (const path of files) {
  const name = relative(DIST, path).replace(/\\/g, '/');
  if (!/\.(?:html|css|js|mjs)$/.test(name)) continue;
  const text = readFileSync(path, 'utf8');
  if (EXTERNAL_LOAD.test(text) || ABS_FETCH.test(text)) external.push(name);
}
if (external.length > 0) {
  for (const name of external.slice(0, 5)) fail(name + ' 里有站外绝对地址（Toy 内不得跳转站外）');
} else {
  ok('没有站外加载（src/href/fetch 全部相对路径）');
}


// ---------- 6. 审核用词门禁（2026-11 内容审核被退后加回）----------
// 平台只看得到打包产物里的文本，所以按「孩子看得见的字面词」扫一遍。
// 这一条只拦**正文文案**：`source.quote` 里的古文已经做了节引，命中即说明新写的内容又带回来了。
const RISKY = ['杀', '死', '血', '尸', '毒', '贼', '劫', '偷', '盗', '鬼', '毙', '砍', '打仗'];
const riskyHits = [];
for (const path of files) {
  const name = relative(DIST, path).replace(/\\/g, '/');
  if (!/\.(?:html|css|js)$/.test(name)) continue;
  const text = readFileSync(path, 'utf8');
  for (const word of RISKY) {
    if (text.includes(word)) riskyHits.push(name + ' 含「' + word + '」');
  }
}
if (riskyHits.length > 0) {
  for (const hit of riskyHits.slice(0, 8)) fail(hit + '（内容审核会按字面词退件，改成中性说法）');
} else {
  ok('审核用词：' + RISKY.length + ' 个敏感词在产物里都没有出现');
}
mkdirSync(OUT_DIR, { recursive: true });
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = String(pkg.version ?? '0.0.0');
const zipPath = join(OUT_DIR, 'chags-toy-v' + version + '.zip');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();
function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

const chunks = [];
const central = [];
let offset = 0;
function push(buffer) {
  chunks.push(buffer);
  offset += buffer.length;
}

const now = new Date();
const stampTime = ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | ((now.getSeconds() / 2) & 0x1f);
const stampDate = (((now.getFullYear() - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0xf) << 5) | (now.getDate() & 0x1f);

for (const path of files) {
  const name = relative(DIST, path).replace(/\\/g, '/');
  const raw = readFileSync(path);
  const deflated = deflateRawSync(raw, { level: 9 });
  const useDeflate = deflated.length < raw.length;
  const body = useDeflate ? deflated : raw;
  const method = useDeflate ? 8 : 0;
  const nameBytes = Buffer.from(name, 'utf8');
  const crc = crc32(raw);
  const localOffset = offset;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(stampTime, 10);
  local.writeUInt16LE(stampDate, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(0, 28);
  push(local);
  push(nameBytes);
  push(body);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(method, 10);
  entry.writeUInt16LE(stampTime, 12);
  entry.writeUInt16LE(stampDate, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(body.length, 20);
  entry.writeUInt32LE(raw.length, 24);
  entry.writeUInt16LE(nameBytes.length, 28);
  entry.writeUInt16LE(0, 30);
  entry.writeUInt16LE(0, 32);
  entry.writeUInt16LE(0, 34);
  entry.writeUInt16LE(0, 36);
  entry.writeUInt32LE(0o644 << 16, 38);
  entry.writeUInt32LE(localOffset, 42);
  central.push(Buffer.concat([entry, nameBytes]));
}

const centralBuffer = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(0, 4);
end.writeUInt16LE(0, 6);
end.writeUInt16LE(central.length, 8);
end.writeUInt16LE(central.length, 10);
end.writeUInt32LE(centralBuffer.length, 12);
end.writeUInt32LE(offset, 16);
end.writeUInt16LE(0, 20);

const zip = Buffer.concat([...chunks, centralBuffer, end]);
writeFileSync(zipPath, zip);

const kb = (bytes) => (bytes / 1024).toFixed(1);
if (zip.length > MAX_PACKAGE_BYTES) fail('整包 ' + kb(zip.length) + ' KB，超过 50 MB 上限（FAQ 一·6）');
else ok('整包 ' + kb(zip.length) + ' KB / 上限 51200 KB');

if (failure > 0) {
  console.error('');
  console.error('Toy 打包检查未通过：' + failure + ' 项。修完再上传，别把会被静默过滤的东西塞进包里。');
  process.exit(1);
}

console.log('');
console.log('→ ' + zipPath);
console.log('  上传时选「文件包」，根目录就是 index.html —— 不要再套一层目录。');
