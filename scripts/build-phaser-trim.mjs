#!/usr/bin/env node
/**
 * 构建 Phaser 裁剪版 ESM bundle（B 档：-36% gzip），供 Vite 以 alias 替换 `phaser` 使用。
 *
 * 背景 / 量化结论见 .scratch/opt-audit/phaser-spike.md（实验报告）；
 * 裁剪清单见 packages/phaser-kit/vendor-src/entry.cjs 与 gameobjects-trim.cjs。
 *
 * 用法：
 *   pnpm phaser:trim                          # 产物已是最新则直接跳过；否则重建
 *   WEBPACK_MODULE_PATH=<...>/webpack/lib/index.js pnpm phaser:trim   # 临时复用已装好的 webpack
 *
 * 依赖 webpack@5（仓库默认不装：只有升级 Phaser / 改 vendor-src 时才需要）：
 *   pnpm add -Dw webpack@5
 *
 * 产物：
 *   packages/phaser-kit/vendor/phaser-trim.esm.js           ← Vite alias 指向它
 *   packages/phaser-kit/vendor/phaser-trim.esm.js.LICENSE.txt ← webpack/terser 抽取的许可注释
 *   packages/phaser-kit/vendor/.version                     ← phaser 版本 + entry hash（跳过重建的依据）
 *
 * 验收：重建后必须 `pnpm build && pnpm size`，合并前再跑全量 `pnpm e2e`。
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_DIR = join(ROOT, 'packages/phaser-kit/vendor');
const SRC_DIR = join(ROOT, 'packages/phaser-kit/vendor-src');
const OUT_NAME = 'phaser-trim.esm.js';
const OUT_FILE = join(VENDOR_DIR, OUT_NAME);
const LICENSE_FILE = OUT_FILE + '.LICENSE.txt';
const VERSION_FILE = join(VENDOR_DIR, '.version');

/** 构建配方版本：改 DefinePlugin 开关 / webpack 关键选项时 +1，强制重建 */
const RECIPE = 'b-tier-v1';

/** 生成文件头：eslint-disable 让 lint 不去解析 minified 产物；同时标明出处（勿手改） */
const BANNER = [
  '/* eslint-disable */',
  '/* 本文件由 scripts/build-phaser-trim.mjs 从 phaser 源码生成，请勿手改；重新生成：pnpm phaser:trim */',
  '/* Phaser 采用 MIT License（Copyright 2013-2026 Phaser Studio Inc.），完整许可见同目录 LICENSE.phaser.md */',
  '',
].join('\n');

const require = createRequire(import.meta.url);

/** 解析 phaser 包位置与版本。Phaser 的 exports 只暴露 "."，所以先 resolve package.json 再拼 /src。 */
function resolvePhaser() {
  const pkgPath = require.resolve('phaser/package.json', { paths: [join(ROOT, 'packages/phaser-kit')] });
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return { version: pkg.version, srcDir: join(dirname(pkgPath), 'src') };
}

/** entry 文件 + phaser 版本 + 配方 的指纹：变了才重建 */
function computeEntryHash(phaserVersion) {
  const hash = createHash('sha256');
  hash.update(RECIPE);
  hash.update('\0' + phaserVersion);
  for (const name of ['entry.cjs', 'gameobjects-trim.cjs']) {
    hash.update('\0' + name + '\0');
    hash.update(readFileSync(join(SRC_DIR, name)));
  }
  return hash.digest('hex').slice(0, 16);
}

function readVersionFile() {
  try {
    return JSON.parse(readFileSync(VERSION_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function kb(bytes) {
  return (bytes / 1024).toFixed(1);
}

/** 加载 webpack：先看 WEBPACK_MODULE_PATH（临时借用已有安装），再走正常解析；缺失时给安装提示 */
async function loadWebpack() {
  const candidates = [];
  if (process.env.WEBPACK_MODULE_PATH) {
    candidates.push(pathToFileURL(resolve(process.env.WEBPACK_MODULE_PATH)).href);
  }
  candidates.push('webpack');
  for (const specifier of candidates) {
    try {
      const mod = await import(specifier);
      const webpack = typeof mod.default === 'function' ? mod.default : mod;
      if (typeof webpack === 'function' && webpack.DefinePlugin) return webpack;
    } catch {
      // 换下一个候选
    }
  }
  console.error('✗ 需要 webpack@5 才能重建 Phaser 裁剪版（只有升级 Phaser 或改 vendor-src 时才需要）。');
  console.error('  安装：pnpm add -Dw webpack@5');
  console.error('  或临时复用已有安装：WEBPACK_MODULE_PATH=<path-to>/webpack/lib/index.js pnpm phaser:trim');
  process.exit(1);
}

function buildConfig(webpack, phaserSrcDir, outDir) {
  return {
    mode: 'production',
    entry: join(SRC_DIR, 'entry.cjs'),
    output: {
      path: outDir,
      filename: OUT_NAME,
      library: { type: 'module' },
    },
    experiments: { outputModule: true },
    devtool: false,
    performance: { hints: false },
    // vendor-src 里的 require('phaser-src/...') 指向真实 phaser 源码目录（不改 node_modules）
    resolve: { alias: { 'phaser-src': phaserSrcDir } },
    plugins: [
      new webpack.DefinePlugin({
        // 与 Phaser 自带 config/webpack.dist.config.js 同一套开关语义（typeof X 必须被替换成布尔值）
        'typeof CANVAS_RENDERER': JSON.stringify(true),
        'typeof WEBGL_RENDERER': JSON.stringify(true),
        'typeof WEBGL_DEBUG': JSON.stringify(false),
        'typeof FEATURE_SOUND': JSON.stringify(false),
        'typeof EXPERIMENTAL': JSON.stringify(false),
      }),
    ],
    optimization: { minimize: true, splitChunks: false, runtimeChunk: false },
    stats: 'errors-warnings',
  };
}

async function runWebpack(webpack, phaserSrcDir, outDir) {
  const config = buildConfig(webpack, phaserSrcDir, outDir);
  await new Promise((resolvePromise, rejectPromise) => {
    webpack(config, (err, stats) => {
      if (err) return rejectPromise(err);
      if (stats.hasErrors()) {
        return rejectPromise(new Error(stats.toString({ all: false, errors: true, warnings: false })));
      }
      const json = stats.toJson({ all: false, warnings: true });
      for (const warning of json.warnings ?? []) console.warn('⚠ ' + (warning.message ?? String(warning)));
      resolvePromise(undefined);
    });
  });
}

async function main() {
  const phaser = resolvePhaser();
  const entryHash = computeEntryHash(phaser.version);
  const current = readVersionFile();

  if (current && current.recipe === RECIPE && current.entryHash === entryHash && existsSync(OUT_FILE)) {
    console.log('✓ Phaser 裁剪版已是最新，跳过重建（' + relative(ROOT, OUT_FILE) + '）');
    console.log('  phaser ' + current.phaser + ' / entry ' + entryHash + ' / ' + kb(statSync(OUT_FILE).size) + ' KiB');
    return;
  }

  const webpack = await loadWebpack();
  const tmpDir = join(VENDOR_DIR, '.tmp');
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  try {
    console.log('· 正在用 webpack 构建 Phaser 裁剪版（phaser ' + phaser.version + '）…');
    await runWebpack(webpack, phaser.srcDir, tmpDir);

    const tmpOut = join(tmpDir, OUT_NAME);
    if (!existsSync(tmpOut)) throw new Error('webpack 没有产出 ' + OUT_NAME);

    const body = readFileSync(tmpOut);
    const artifact = Buffer.concat([Buffer.from(BANNER, 'utf8'), body]);
    const gzipBytes = gzipSync(artifact).length;

    // 防呆：如果开关失效 / 误用了完整包，体积会明显跑偏
    if (gzipBytes < 180 * 1024 || gzipBytes > 260 * 1024) {
      throw new Error(
        '产物体积异常：' + kb(gzipBytes) + ' KiB gzip（预期 180–260 KiB）。' +
          '检查 DefinePlugin 开关是否失效、vendor-src 是否被误改（完整 Phaser 约 347 KiB gzip）。',
      );
    }

    writeFileSync(OUT_FILE, artifact);
    const tmpLicense = tmpOut + '.LICENSE.txt';
    if (existsSync(tmpLicense)) {
      copyFileSync(tmpLicense, LICENSE_FILE);
    } else {
      console.warn('⚠ webpack 没有抽取 LICENSE.txt —— 许可注释可能仍在 bundle 内，发布前确认一次');
    }

    writeFileSync(
      VERSION_FILE,
      JSON.stringify(
        {
          phaser: phaser.version,
          recipe: RECIPE,
          entryHash,
          artifact: OUT_NAME,
          bytes: artifact.length,
          gzipBytes,
          builtAt: new Date().toISOString(),
        },
        null,
        2,
      ) + '\n',
    );

    console.log('✓ 已生成 ' + relative(ROOT, OUT_FILE) + '：' + kb(artifact.length) + ' KiB 原始 / ' + kb(gzipBytes) + ' KiB gzip');
    console.log('  下一步必须：pnpm build && pnpm size；合并前再跑一次全量 pnpm e2e');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('✗ 构建 Phaser 裁剪版失败：' + (error && error.message ? error.message : error));
  process.exitCode = 1;
});
