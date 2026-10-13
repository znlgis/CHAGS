# CHAGS · 中国历史典故儿童游戏合集

Chinese Historical Anecdotes Game Series —— 一个典故一个小游戏，让小朋友在"做"故事的过程中记住典故。

**中文** · [English](README.en.md) ｜ 应用内可一键切换中英文（界面 / 典故内容 / 语音全部跟随）

## 技术栈

Phaser 4.2（游戏）· Vue 3.5 + Pinia（外壳）· Vite 8 · TypeScript 5.9.3 · pnpm workspace · Vitest · Playwright

> ⚠️ TypeScript 刻意锁在 **5.9.3**：最新的 7.x 移除了 `./lib/tsc` 子路径导出，
> `vue-tsc@3.3.13` 会直接报 `ERR_PACKAGE_PATH_NOT_EXPORTED`（已实测）。等 vue-tsc 跟进后再升级。

## 快速开始

```bash
pnpm install
pnpm dev            # 开发服务器 http://127.0.0.1:5183
pnpm verify         # typecheck + lint + test + content:check + build（提交前必须全绿）
pnpm e2e            # Playwright 端到端（需先 npx playwright install chromium）
pnpm e2e:dist       # 针对生产构建产物再跑一遍（验证 chunk 懒加载）
pnpm audit:i18n     # 双语版面巡检：把两种语言下的每个画面截图到 .scratch/i18n-audit/
pnpm dist:win       # 打包 Windows 便携 exe（约 3.3 MB，双击即玩，不用安装）
pnpm dist:apk       # 打包安卓 apk（直接安装）
```

调试直达链接：`/?autoplay=1#/play/caochong-elephant`（自动通关，用于无头验证）

## 当前进度

两个典故已完整跑通，`pnpm verify` 全绿，端到端 **6 项通过**（每部游戏都有真实鼠标操作的通关用例）。
首屏 shell **60.6 KB gzip**（不含 Phaser）；两部游戏各自的业务 chunk 只有 3 KB / 7 KB，
Phaser 是共享 chunk，只在进入游戏时加载。

### 一、曹冲称象（信史 · 等量代换）

不再有「下一幕」按钮，也没有文字选择题。玩家亲手走完曹冲的四步：
拖大象上秤（压垮）→ 拖上船（沉下去）→ 点船身刻水痕 → 一块块搬石头直到水痕回到水面 → 石头过秤得出 3000。

| 分幕绘本 | 秤被压垮 | 刻水痕 | 搬石头代换 | 水痕对上 | 大象 = 3000 |
|---|---|---|---|---|---|
| ![绘本](docs/screenshots/02-story.png) | ![压垮](docs/screenshots/04-scale-fails.png) | ![刻痕](docs/screenshots/05-mark.png) | ![搬石头](docs/screenshots/06-substitute.png) | ![对上](docs/screenshots/07-matched.png) | ![称重](docs/screenshots/08-weighed.png) |

### 二、盘古开天辟地（神话 · 创造与化身）

五段式，由三个模板 + 一个专属场景拼成：

1. **开** — 连点蛋壳 4 次，混沌炸开，亮粒子上升、暗块下沉（专属场景）
2. **撑** — 连点 30 次，天升一丈、地降一丈、**盘古在画面里被真的拉长**，点满一万八千年
3. **化** — 拖 6 团光归位：左眼→太阳、右眼→月亮、头发→星辰、气息→风云、血液→江河、汗毛→草木

拿起一团光时，它该去的位置会自己发光——零失败、零文字；归位时用**语音**念出原文。
全程没有死亡表现：盘古是「躺下 → 化成光 → 光一件件回到世界」。

| 混沌之蛋 | 裂缝 | 撑天（一万四千年） | 拖光球归位 | 世界成形 |
|---|---|---|---|---|
| ![混沌](docs/screenshots/13-chaos.png) | ![裂缝](docs/screenshots/14-cracked.png) | ![撑天](docs/screenshots/17-sky-high.png) | ![归位](docs/screenshots/19-sun-placed.png) | ![成形](docs/screenshots/20-world-complete.png) |

## 设计原则：少写字，多动手

两部游戏加起来，屏幕上出现的教学文字只有开场那两句话。其余全靠图形、动画、音效与语音。
孩子是「做」出这个办法，而不是被告知。

## 目录结构

```
apps/site                  Vue 3.5 外壳：典故馆 / 游戏宿主 / 图鉴
packages/game-kit          契约层（GameModule / GameContext / 事件），不含 Phaser
packages/content           典故数据 + zod schema
packages/templates         玩法模板：story / balance / quiz / reward
packages/phaser-kit        Phaser 启动器、主题、基础场景
packages/platform          Web 实现：IndexedDB / WebAudio / TTS / 生命周期
packages/progress          存档、复习调度（纯函数，可单测）
games/caochong-elephant    曹冲称象（等量代换：substitution 模板）
games/pangu                盘古开天辟地（撑天 grow + 化身 place + 专属开蛋场景）
e2e                        Playwright 冒烟
```

## 三条架构铁律

1. **逻辑与渲染分离**：规则写在纯 TS 里，不 import Phaser，可脱离浏览器单测。
2. **游戏不碰环境**：存档 / 音频 / 生命周期一律走 `GameContext.services`，禁止直接 `localStorage` / `fetch`。
3. **每个游戏可无头直达**：支持 `?seed=&autoplay=1`，否则无法自动化验证。

详见 [docs/技术方案.md](docs/技术方案.md)。
