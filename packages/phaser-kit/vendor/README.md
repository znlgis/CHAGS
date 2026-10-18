# Phaser 裁剪版 bundle（B 档）

本目录的 `phaser-trim.esm.js` 是 **Phaser 的裁剪修改版**，由 `pnpm phaser:trim` 从 `phaser` 源码生成，
通过 `apps/site/vite.config.ts` 的 resolve.alias 替换 `phaser` 包。**不要手改。**

## 为什么裁剪

完整 Phaser 打出来是 vendor-phaser chunk 1341.9 KiB 原始 / 347.3 KiB gzip；53 个游戏实际只用到
Scene / GameObjects(Container/Graphics/Text/Zone/Rectangle) / Input / Tweens / Time / Cameras / Scale，
physics / tilemaps / sound / animations / particles 等系统是纯死重。裁剪后约 859.7 KiB 原始 / 221.4 KiB gzip
（-36% gzip，-482 KiB 原始，桌面 / 安卓壳本地加载同样受益）。

实验报告（方法、量化、冒烟、风险）：`.scratch/opt-audit/phaser-spike.md`。

## 许可

- Phaser 采用 **MIT License**，Copyright (c) 2013-2026 Phaser Studio Inc.，完整文本见 [LICENSE.phaser.md](./LICENSE.phaser.md)。
- 本目录产物是 Phaser 的修改版（裁剪 + 压缩），同样按 MIT License 分发，保留原版权与许可声明。
- `phaser-trim.esm.js.LICENSE.txt` 是 webpack/terser 从源码里抽取出的许可注释，**必须与 bundle 一起分发**，不要删。

## 升级 / 重新生成

1. 升级 `phaser` 依赖（`packages/phaser-kit/package.json`）后，先 `pnpm install`；
2. 需要 webpack：`pnpm add -Dw webpack@5`（仅重建时需要；也可以 `WEBPACK_MODULE_PATH=<path-to>/webpack/lib/index.js` 临时复用）；
3. `pnpm phaser:trim`（未变更时自动跳过；entry hash / phaser 版本变了才重建）；
4. `pnpm build && pnpm size` 必须通过（体积预算见 `scripts/check-size.mjs`）；
5. 合并前跑全量 `pnpm e2e`——裁剪掉的对象如果在某个游戏里被用到，只会在运行时炸，TS 类型查不出来。
6. 回退：删掉 `apps/site/vite.config.ts` 里的 alias，或临时 `PHASER_FULL=1` 用完整 phaser。

## 文件

- `vendor-src/entry.cjs`：Phaser 命名空间入口（裁剪清单 + 为什么）。
- `vendor-src/gameobjects-trim.cjs`：GameObjects 收窄聚合（只保留实际用到的对象类型）。
- `scripts/build-phaser-trim.mjs`：构建脚本（webpack + DefinePlugin，与 Phaser 官方构建方式一致）。
- `.version`：phaser 版本 + entry 指纹 + 产物大小，用于跳过重建。
