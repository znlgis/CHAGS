import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================================
// CHAGS 的 Toy 发布自检
//
// 四个项目（CHAGS / BambooBuddy / mathmindforge / shfr）共用同一份规则，
// 只有下面 CONFIG 这一段不同；改规则时四个仓库要一起改，并把 RULES_VERSION 对齐。
//
// 依据：《Toy 开发者 FAQ》2026-10-23「四、内容规范与合规」+ 发布页包体限制，
// 以及 2026-11 两次真实退件（内容审核 / 包体安全检查）暴露出来的判定点。
//
// 用法：pnpm toy:check（构建之后跑；本脚本不替你构建，免得读到上一轮的旧产物）
// ============================================================================
const RULES_VERSION = '2026-11-12';
const CONFIG = {
  name: 'CHAGS · 历史典故游戏',
  dist: 'apps/site/dist',
  zip: 'release/chags-toy-v0.1.0.zip',
  sourceRoots: ['apps/site/src'],
  allowHosts: ['www.w3.org', 'schema.org', 'bilibili.com', 'b23.tv'],
  urlTextAllow: ['vuejs.org', 'phaser.io', 'tailwindcss.com', 'json-schema.org', 'reactjs.org'],
  sensitiveWords: ['杀', '死', '血', '尸', '毒', '贼', '劫', '偷', '盗', '鬼', '毙', '砍', '打仗'],
  securityPatterns: [
    { name: 'eval', pattern: 'eval(' },
    { name: 'new Function', pattern: 'new Function' },
    { name: 'document.write', pattern: 'document.write' },
    { name: 'XHR', pattern: 'XMLHttpRequest' },
    { name: 'fetch', pattern: 'fetch(' },
    { name: 'WebSocket', pattern: 'WebSocket' },
    { name: 'atob', pattern: 'atob(' },
    { name: 'webdriver', pattern: 'webdriver' },
    { name: '__chags', pattern: '__chags' },
  ],
  requireMeta: true,
  /**
   * 已知第三方库命中基线：只豁免**已核实过来源与必要性**的库代码，
   * 精确到「文件 + 规则」，命中时降级为提示并打印原因；自有代码命中仍然失败。
   */
  knownVendorHits: [],
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, CONFIG.dist);

/** 平台硬上限 */
const LIMITS = { entryBytes: 1024 * 1024, packageBytes: 50 * 1024 * 1024 };

/** 平台会发布的白名单后缀（FAQ 七·1）；不在表里的会被静默过滤 */
const ALLOWED_EXT = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.json', '.txt', '.xml', '.webmanifest', '.md', '.csv', '.tsv', '.wasm', '.data', '.bin', '.glsl', '.vert', '.frag', '.atlas', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.bmp', '.avif', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.mp4', '.webm']);
const CODE_EXT = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.json']);

let errors = 0;
let warnings = 0;
const ok = (m) => console.log('  ✓ ' + m);
const fail = (m) => { console.error('  ✗ ' + m); errors += 1; };
const warn = (m) => { console.warn('  · ' + m); warnings += 1; };

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (entry.isFile()) out.push(path);
  }
  return out;
}

const kb = (n) => (n / 1024).toFixed(1);
const mb = (n) => (n / 1024 / 1024).toFixed(2);

console.log('Toy 发布自检（规则 ' + RULES_VERSION + '）· ' + CONFIG.name);

if (!existsSync(DIST)) {
  console.error('✗ 找不到 ' + CONFIG.dist + ' —— 先构建（本检查不替你构建）');
  process.exit(1);
}

const files = walk(DIST);
const relOf = (p) => relative(DIST, p).replace(/\\/g, '/');

/** ---------- 1. 包根与体积 ---------- */
const entryPath = join(DIST, 'index.html');
if (!existsSync(entryPath)) fail('包根没有 index.html（入口必须在压缩包根目录，不能多套一层）');
else {
  const bytes = statSync(entryPath).size;
  if (bytes <= LIMITS.entryBytes) ok('入口 index.html ' + kb(bytes) + ' KB / 上限 1024 KB');
  else fail('入口 index.html ' + kb(bytes) + ' KB 超过平台 1024 KB 硬上限');
}
const totalBytes = files.reduce((sum, p) => sum + statSync(p).size, 0);
if (totalBytes <= LIMITS.packageBytes) ok('整包 ' + mb(totalBytes) + ' MB（' + files.length + ' 个文件）/ 上限 50 MB');
else fail('整包 ' + mb(totalBytes) + ' MB 超过 50 MB（更大包体要单独申请）');

/** ---------- 2. 后缀白名单 / 多余文件 ---------- */
/** 打包产物本身（dist 里顺手放的分发 zip）不参与「要发布哪些文件」的判定 */
const ARTIFACT_SKIP = /\.zip$/i;
const shipped = files.filter((p) => !ARTIFACT_SKIP.test(relOf(p)));
const badExt = shipped.map((p) => ({ p: relOf(p), ext: extname(p).toLowerCase() })).filter((x) => !ALLOWED_EXT.has(x.ext));
if (badExt.length === 0) ok('所有文件后缀都在平台白名单内');
else for (const x of badExt.slice(0, 8)) fail('白名单外的后缀：' + x.p);
const junk = files.map(relOf).filter((n) => /(\.map$)|(^|\/)(\.DS_Store|\.Thumbs\.db)$/.test(n));
if (junk.length === 0) ok('没有 sourcemap / 系统垃圾文件');
else for (const n of junk.slice(0, 8)) fail('不该发布的文件：' + n);

/** ---------- 3. 相对路径：Toy 跑在 /toy/<slug>/ 子路径下 ---------- */
const textFiles = files.filter((p) => CODE_EXT.has(extname(p).toLowerCase()));
const texts = new Map(textFiles.map((p) => [relOf(p), readFileSync(p, 'utf8')]));
const absHits = [];
for (const [name, text] of texts) {
  if (!/\.(?:html|htm|css)$/.test(name)) continue;
  for (const m of text.matchAll(/(?:src|href)\s*=\s*["']\/(?!\/)[^"']*/g)) absHits.push(name + ' -> ' + m[0]);
  for (const m of text.matchAll(/url\(\s*["']?\/(?!\/)[^"')]+/g)) absHits.push(name + ' -> ' + m[0]);
}
if (absHits.length === 0) ok('资源引用全是相对路径');
else for (const hit of absHits.slice(0, 6)) fail('站根绝对路径会白屏：' + hit);

/** ---------- 4. 站外链接 ---------- */
const hostAllowed = (url) => CONFIG.allowHosts.some((host) => url.includes(host));
const externalLoads = [];
for (const [name, text] of texts) {
  if (!/\.(?:html|htm|css)$/.test(name)) continue;
  for (const m of text.matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)/g)) {
    if (!hostAllowed(m[1])) externalLoads.push(name + ' -> ' + m[1]);
  }
}
if (externalLoads.length === 0) ok('没有站外资源加载');
else for (const hit of externalLoads.slice(0, 6)) fail('页面在加载站外资源：' + hit);

/** ---------- 5. 代码安全（包体安全退件的直接原因）---------- */
const securityHits = [];
for (const [name, text] of texts) {
  if (!/\.(?:js|mjs|html)$/.test(name)) continue;
  for (const rule of CONFIG.securityPatterns) {
    if (text.includes(rule.pattern)) securityHits.push(name + ' 命中 ' + rule.name);
  }
}
const vendorBaseline = CONFIG.knownVendorHits.filter((entry) => securityHits.some((hit) => hit.includes(entry.file) && hit.endsWith(entry.rule)));
const realHits = securityHits.filter((hit) => !vendorBaseline.some((entry) => hit.includes(entry.file) && hit.endsWith(entry.rule)));
if (realHits.length === 0) ok('代码安全：自有代码 0 命中（第三方基线 ' + vendorBaseline.length + ' 条见下）');
else for (const hit of realHits.slice(0, 8)) fail(hit + '（包体安全检查会按「代码安全风险」退件）');
for (const entry of vendorBaseline) warn('第三方基线豁免：' + entry.file + ' 的 ' + entry.rule + ' —— ' + entry.why);

/** ---------- 6. 内容审核用词 ---------- */
if (CONFIG.sensitiveWords.length === 0) ok('未配置敏感词表');
else {
  const wordHits = [];
  for (const [name, text] of texts) {
    for (const word of CONFIG.sensitiveWords) if (text.includes(word)) wordHits.push(name + ' 含「' + word + '」');
  }
  if (wordHits.length === 0) ok('内容审核：' + CONFIG.sensitiveWords.length + ' 个敏感词都没出现');
  else for (const hit of wordHits.slice(0, 8)) fail(hit + '（内容审核会按字面词退件）');
}

/** ---------- 7. 站外 URL 文本（不可点击，只提示）---------- */
const urlText = [];
for (const [name, text] of texts) {
  for (const m of text.matchAll(/https?:\/\/[^\s"'<>)\\]+/g)) {
    if (hostAllowed(m[0])) continue;
    if (CONFIG.urlTextAllow.some((allow) => m[0].includes(allow))) continue;
    urlText.push(name + ' -> ' + m[0].slice(0, 90));
  }
}
if (urlText.length === 0) ok('产物里没有站外 URL 文本');
else for (const hit of urlText.slice(0, 6)) warn('站外 URL 文本（确认不会真的跳转）：' + hit);

/** ---------- 8. index.html 元信息与引用落地 ---------- */
const html = texts.get('index.html') ?? '';
if (CONFIG.requireMeta) {
  if (/<title>[^<]*\S[^<]*<\/title>/i.test(html)) ok('index.html 有非空 <title>');
  else fail('index.html 缺 <title> —— 平台列表页会显示成空白');
  if (/name=["']viewport["']/i.test(html)) ok('index.html 有 viewport meta');
  else fail('index.html 缺 viewport meta —— 手机上会按桌面宽度渲染');
}
const present = new Set(files.map(relOf));
const missingRefs = [];
for (const m of html.matchAll(/(?:src|href)\s*=\s*["'](\.\/[^"'?#]+)(?:[?#][^"']*)?["']/g)) {
  const target = m[1].replace(/^\.\//, '');
  if (!present.has(target)) missingRefs.push(target);
}
if (missingRefs.length === 0) ok('index.html 引用的资源都在包里');
else for (const ref of missingRefs.slice(0, 8)) fail('index.html 引用了不存在的文件：' + ref);

/** ---------- 9. 源码里的 UGC 原语（内容安全红线）---------- */
const UGC_RULES = [
  [/<textarea\b/i, '<textarea>（自由文本输入）'],
  [/contenteditable\s*=\s*["']?true/i, 'contenteditable（可编辑区域）'],
  [/<input[^>]*\btype\s*=\s*["']?file\b/i, '<input type=file>（用户上传）'],
  [/\bgetUserMedia\b/, 'getUserMedia（摄像头 / 麦克风）'],
  [/\bMediaRecorder\b/, 'MediaRecorder（录音 / 录像）'],
];
const SOURCE_EXT = /\.(?:vue|ts|tsx|js|jsx|html)$/;
const sourceFiles = [];
for (const root of CONFIG.sourceRoots) {
  const abs = join(ROOT, root);
  if (!existsSync(abs)) continue;
  for (const path of walk(abs)) {
    if (!SOURCE_EXT.test(path)) continue;
    if (/\.(?:test|spec)\./.test(path)) continue;
    sourceFiles.push(path);
  }
}
const ugcHits = [];
for (const path of sourceFiles) {
  const text = readFileSync(path, 'utf8');
  for (const [re, label] of UGC_RULES) if (re.test(text)) ugcHits.push(relative(ROOT, path).replace(/\\/g, '/') + ' -> ' + label);
}
if (ugcHits.length === 0) ok('源码里没有 UGC 能力（扫了 ' + sourceFiles.length + ' 个文件）');
else for (const hit of ugcHits.slice(0, 8)) fail('源码里有 Toy 明令禁止的 UGC 能力：' + hit);

/** ---------- 10. 源码里的站外链接 ---------- */
const srcExternal = [];
for (const path of sourceFiles) {
  if (!/\.(?:vue|ts|tsx|js|jsx|html)$/.test(path)) continue;
  const text = readFileSync(path, 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s"'<>)\\]+/g)) {
    if (hostAllowed(m[0])) continue;
    if (CONFIG.urlTextAllow.some((allow) => m[0].includes(allow))) continue;
    srcExternal.push(relative(ROOT, path).replace(/\\/g, '/') + ' -> ' + m[0].slice(0, 80));
  }
}
if (srcExternal.length === 0) ok('源码里没有站外链接');
else for (const hit of srcExternal.slice(0, 6)) warn('源码里的站外 URL（确认不会真的跳转）：' + hit);

/** ---------- 11. zip 包根（项目产出 zip 时）---------- */
if (CONFIG.zip === null) ok('本项目不产出 zip，跳过包根检查');
else {
  const zipPath = join(ROOT, CONFIG.zip);
  if (!existsSync(zipPath)) warn('没找到 ' + CONFIG.zip + '（先打包）');
  else {
    const buf = readFileSync(zipPath);
    const names = readZipNames(buf);
    if (buf.length > LIMITS.packageBytes) fail('zip ' + mb(buf.length) + ' MB 超过 50 MB');
    else ok('zip ' + mb(buf.length) + ' MB / 上限 50 MB');
    if (names.includes('index.html')) ok('zip 包根就是 index.html');
    else fail('zip 包根没有 index.html（不要多套一层目录）');
    const unsafe = names.filter((n) => n.startsWith('/') || n.split('/').includes('..'));
    if (unsafe.length === 0) ok('zip 内没有绝对路径 / 越界路径');
    else for (const n of unsafe.slice(0, 6)) fail('zip 里有越界路径：' + n);
    const badZipExt = names.filter((n) => !n.endsWith('/') && !ALLOWED_EXT.has(extname(n).toLowerCase()));
    if (badZipExt.length === 0) ok('zip 内后缀都在白名单内');
    else for (const n of badZipExt.slice(0, 6)) fail('zip 里有白名单外的文件：' + n);
  }
}

function readZipNames(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return [];
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const names = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    names.push(buf.toString('utf8', p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

if (errors > 0) {
  console.error('');
  console.error('Toy 自检失败：' + errors + ' 个问题' + (warnings > 0 ? '，' + warnings + ' 条提示' : ''));
  process.exit(1);
}
console.log('');
console.log('Toy 自检通过' + (warnings > 0 ? '（' + warnings + ' 条提示，建议过一眼）' : '') + ' —— 分类 / 封面 / 图标 / 可见状态仍需在发布页人工确认');