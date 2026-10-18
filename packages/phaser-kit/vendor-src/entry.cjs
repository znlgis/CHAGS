/**
 * CHAGS 的 Phaser 裁剪版入口（B 档）——由 `pnpm phaser:trim` 使用，产物见 ../vendor/。
 *
 * ⚠️ 这不是 Phaser 的公开 API（Phaser 的 exports 只暴露 "."，这里按内部模块路径逐个 require）：
 * - Phaser 升级（哪怕 minor）都可能改这些内部路径或模块结构，升级后必须重跑 `pnpm phaser:trim`；
 * - 改完本文件 / gameobjects-trim.cjs 后同样要重跑，然后跑 `pnpm build && pnpm size` 与全量 e2e；
 * - 特性开关（`typeof FEATURE_SOUND` 等）必须由 scripts/build-phaser-trim.mjs 里的 DefinePlugin 注入：
 *   直接用 esbuild/vite 打包本文件会得到错误结果（未定义时 `typeof FEATURE_SOUND` 是 truthy，声音系统会回来）。
 *
 * 裁剪依据（2026-10 全量 grep + Playwright 冒烟，见 .scratch/opt-audit/phaser-spike.md）：
 * 53 个游戏只用到 Container / Graphics / Text / Zone / Rectangle 与 Scene/Input/Tweens/Time/Cameras/Scale，
 * 没有任何 physics / tilemaps / sound / animations / particles / loader(image) 调用；
 * 声音与音乐由自研 WebAudio 负责（Game config 里 audio: { noAudio: true }）。
 */
/* global require, module */
/* eslint-disable @typescript-eslint/no-require-imports, no-constant-condition -- CJS 打包入口；`typeof FEATURE_SOUND` 是构建期 DefinePlugin 开关（webpack 会静态替换），这里的 if 不是运行时常量 */
require('phaser-src/polyfills/requestVideoFrame');

var CONST = require('phaser-src/const');
var Extend = require('phaser-src/utils/object/Extend');

var Phaser = {
  BlendModes: require('phaser-src/renderer/BlendModes'),
  Cache: require('phaser-src/cache'),
  Cameras: require('phaser-src/cameras'),
  Core: require('phaser-src/core'),
  Class: require('phaser-src/utils/Class'),
  Data: require('phaser-src/data'),
  Display: require('phaser-src/display'),
  Events: require('phaser-src/events'),
  Game: require('phaser-src/core/Game'),
  GameObjects: require('./gameobjects-trim.cjs'),
  Input: require('phaser-src/input'),
  Loader: require('phaser-src/loader'),
  Math: require('phaser-src/math'),
  Plugins: require('phaser-src/plugins'),
  Renderer: require('phaser-src/renderer'),
  Scale: require('phaser-src/scale'),
  ScaleModes: require('phaser-src/renderer/ScaleModes'),
  Scene: require('phaser-src/scene/Scene'),
  Scenes: require('phaser-src/scene'),
  Structs: require('phaser-src/structs'),
  Textures: require('phaser-src/textures'),
  Time: require('phaser-src/time'),
  TintModes: require('phaser-src/renderer/TintModes'),
  Tweens: require('phaser-src/tweens'),
  Utils: require('phaser-src/utils'),
  Geom: require('phaser-src/geom'),
};

// FEATURE_SOUND=false 由构建脚本的 DefinePlugin 注入：这一支会被静态消除，声音系统不参与打包。
// 若将来真的要用 Phaser 音频，改构建脚本里的开关，并接受 +6.2 KiB gzip 左右的回涨。
if (typeof FEATURE_SOUND) {
  Phaser.Sound = require('phaser-src/sound');
}

// 合并常量（AUTO / CANVAS / WEBGL / VERSION 等，与官方入口一致）
Phaser = Extend(false, Phaser, CONST);

module.exports = Phaser;
