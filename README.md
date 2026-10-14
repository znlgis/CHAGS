# CHAGS · 中国历史典故儿童游戏合集

Chinese Historical Anecdotes Game Series —— 一个典故一个小游戏，让小朋友在"做"故事的过程中记住典故。

**中文** · [English](README.en.md) ｜ 应用内可一键切换中英文（界面 / 典故内容 / 语音全部跟随）

![Release](https://github.com/znlgis/CHAGS/actions/workflows/release.yml/badge.svg)

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

**十二个典故**全部跑通，`pnpm verify` 全绿，端到端里每部游戏都有真实鼠标操作的通关用例。
首屏 shell 仍然很小（不含 Phaser）；每部游戏自己的业务 chunk 只有几 KB，
Phaser 是共享 chunk，只在进入游戏时加载 —— 具体数字看 `pnpm size`。

### 一、曹冲称象（信史 · 等量代换）

不再有「下一幕」按钮，也没有文字选择题。玩家亲手走完曹冲的四步：
拖大象上秤（压垮）→ 拖上船（沉下去）→ 点船身刻水痕 → 一块块搬石头直到水痕回到水面 → 石头过秤得出 3000。

| 分幕绘本 | 秤被压垮 | 刻水痕 | 搬石头代换 | 水痕对上 | 大象 = 3000 |
|---|---|---|---|---|---|
| ![绘本](docs/screenshots/02-story.png) | ![压垮](docs/screenshots/04-scale-fails.png) | ![刻痕](docs/screenshots/05-mark.png) | ![搬石头](docs/screenshots/06-substitute.png) | ![对上](docs/screenshots/07-matched.png) | ![称重](docs/screenshots/08-weighed.png) |

### 二、女娲补天（神话 · 修补）

天上破了五个洞，一个洞一种形状。把五色石拖进对应的洞里 —— **判定靠形状，不靠颜色**（色弱的孩子也能玩）。
补完一个，天就亮一分；五个都补好，五色霞光洒向大地。

| 天上五个洞 | 一块块补上 | 天补好了 |
|---|---|---|
| ![破洞](docs/screenshots/31-nuwa-holes.png) | ![补洞](docs/screenshots/32-nuwa-one.png) | ![补好](docs/screenshots/33-nuwa-mended.png) |

### 三、后羿射日（神话 · 精准与分寸）

拖出去瞄准，松手射箭。十个太阳烤焦了大地，但**不能全射下来**。

射下九个之后，大地返绿、最后一个太阳变得温暖 —— 这时孩子如果把它也射了，**天会一下子黑下来**，
太阳自己回来，屏幕上一句「要留一个太阳」。零惩罚，自己撞一次就懂了。

| 十日并出 | 拉弓瞄准 | 射九留一 |
|---|---|---|
| ![十日](docs/screenshots/35-houyi-ten-suns.png) | ![瞄准](docs/screenshots/36-houyi-aiming.png) | ![返绿](docs/screenshots/37-houyi-nine.png) |

### 四、精卫填海（神话 · 微小的坚持）

点一下，精卫就衔一块石头飞过海面投下去。**它很小，海很大** —— 这种不成比例，正是这个典故的分量。
填到最后，海上浮起一小片陆地，它还在飞。

| 一只小鸟，一片大海 | 填到一半 | 海上多了块陆地 |
|---|---|---|
| ![起手](docs/screenshots/41-jingwei-start.png) | ![一半](docs/screenshots/42-jingwei-half.png) | ![小岛](docs/screenshots/43-jingwei-island.png) |

### 五、夸父追日（神话 · 奔跑）

**按住就跑**，松手就慢下来，太阳越跑越远。追到河渭时停下喝一口，再接着追。
他没能追上太阳 —— 但结局画面里没有他，只有一片开花的桃林。

| 一直追 | 河渭喝水 | 手杖化成的桃林 |
|---|---|---|
| ![奔跑](docs/screenshots/45-kuafu-running.png) | ![喝水](docs/screenshots/46-kuafu-drinking.png) | ![桃林](docs/screenshots/47-kuafu-peach.png) |

### 六、愚公移山（寓言 · 传承）

点一下挖一担。挖到三成，**河曲智叟出现**，抱着胳膊摇头嘲笑；
挖到六成，愚公老了，**把锄头交给下一代** —— 画面上的挖山人从一代变成两代、三代。

| 两座大山 | 智叟来了 | 子子孙孙 |
|---|---|---|
| ![大山](docs/screenshots/49-yugong-mountains.png) | ![智叟](docs/screenshots/50-yugong-zhisou.png) | ![三代](docs/screenshots/52-yugong-done.png) |

### 七、盘古开天辟地（神话 · 创造与化身）

五段式，由三个模板 + 一个专属场景拼成：

1. **开** — 连点蛋壳 4 次，混沌炸开，亮粒子上升、暗块下沉（专属场景）
2. **撑** — 连点 30 次，天升一丈、地降一丈、**盘古在画面里被真的拉长**，点满一万八千年
3. **化** — 拖 6 团光归位：左眼→太阳、右眼→月亮、头发→星辰、气息→风云、血液→江河、汗毛→草木

拿起一团光时，它该去的位置会自己发光——零失败、零文字；归位时用**语音**念出原文。
全程没有死亡表现：盘古是「躺下 → 化成光 → 光一件件回到世界」。

| 混沌之蛋 | 裂缝 | 撑天（一万四千年） | 拖光球归位 | 世界成形 |
|---|---|---|---|---|
| ![混沌](docs/screenshots/13-chaos.png) | ![裂缝](docs/screenshots/14-cracked.png) | ![撑天](docs/screenshots/17-sky-high.png) | ![归位](docs/screenshots/19-sun-placed.png) | ![成形](docs/screenshots/20-world-complete.png) |

### 八、神农尝百草（传说 · 先尝后分）

六株草摆在田垄上，每株草都顶着一个问号 —— **不尝一口，就不知道它是什么**。
把草拖到神农嘴边，他尝过之后，草上会多出一枚小牌子：能吃、能治病，还是不能吃；
牌子上的图案和木牍上的一模一样，不用认字。

没尝过就往木牍上放？草会被送回嘴边先尝一口 —— 不判错、不扣分。想分类，先自己试一口。

| 不知道是什么 | 先尝一口 | 分进木牍 |
|---|---|---|
| ![问号](docs/screenshots/54-shennong-unknown.png) | ![尝](docs/screenshots/55-shennong-tasting.png) | ![分类](docs/screenshots/56-shennong-sorted.png) |

尝到毒草只是皱皱眉头、冒会儿金星，喝口水就过去了 —— **有毒的也要记下来**，别人就不用再尝。

### 九、大禹治水（传说 · 堵不如疏）

先让他亲手"堵"一次：点一下加一筐土，堤高一寸，水也涨一寸（涨得慢一点点，看起来真的有用）。
点到第十下，水漫过堤顶 —— **堤垮了**。

然后才给他"疏"：手指在洪水上划出一条河道，水顺着走，水位一格格退下去，露出来的地上长出绿苗。
三段河道，每划完一段，他就路过一次家门口 —— 窗里亮着灯，他都没有进去。

| 一筐一筐筑堤 | 水漫过堤顶 | 划出一条河道 |
|---|---|---|
| ![筑堤](docs/screenshots/58-dayu-dike.png) | ![决口](docs/screenshots/59-dayu-breach.png) | ![疏](docs/screenshots/60-dayu-channel.png) |

### 十、太公钓鱼（信史 · 等）

一屏渭水，主线只有一件事：**等**。
太阳在画面上方慢慢走，就是进度条；天边极远处的车马，一点一点近。

换弯钩、加鱼饵、换地方 —— 点了就得多等一会儿（最多三次，永远不会等不到头），而且**永远钓不到鱼**。
水下的鱼群游来游去，直钩悬在水面之上三尺。等文王到了跟前，要自己把直钩收起来 —— 不然这一场白等。

| 直钩悬在水上三尺 | 点他，听一句 | 点了诱惑 |
|---|---|---|
| ![等](docs/screenshots/62-taigong-waiting.png) | ![说话](docs/screenshots/63-taigong-listener.png) | ![诱惑](docs/screenshots/64-taigong-tempted.png) |

### 十一、烽火戏诸侯（信史 · 信用）

点一次火，火光一座座传向天边，诸侯的兵马赶来，**她笑了**。
信任有三格：点一次，少一格。第二次来的兵马少了一半，走的时候有人在摇头；第三次，**他们连城门都没到**。

第四次点火是真的 —— 天边真的起了烟。火光还是传了出去，**一个人也没有来**。
孩子是自己把信任点完的，全篇没有一句说教；出处注明"后世学者多存疑"，教训落在信用上，不落在褒姒身上。

| 夜里的烽火 | 火光传向天边 | 她笑了 | 一个人也没来 |
|---|---|---|---|
| ![夜](docs/screenshots/66-fenghuo-night.png) | ![点火](docs/screenshots/67-fenghuo-relay.png) | ![笑](docs/screenshots/68-fenghuo-laugh.png) | ![没人来](docs/screenshots/69-fenghuo-nobody.png) |

### 十二、杞人忧天（寓言 · 想明白）

他头顶飘着四个担忧泡泡：天会塌、地会陷、日月会掉、星星会坠。
托盘里是四个"想明白"：一团气、一块土、日月、一颗小石子。

拖过去，泡泡里演一小段"看一看"（气托着鸟和云、跺一跺脚土地稳稳的、太阳落下第二天又升起来、流星掉下来只是小石子），
泡泡「啵」地破掉，屋里亮一点。四个都破了，黑云散开，他在星光下睡着 —— **怕，是因为还没想明白**。

| 四个担忧 | 想通一个 | 睡着了 |
|---|---|---|
| ![担忧](docs/screenshots/71-qiren-worries.png) | ![破掉](docs/screenshots/72-qiren-one-less.png) | ![睡着](docs/screenshots/73-qiren-asleep.png) |

## 设计原则：少写字，多动手

十二部游戏加起来，屏幕上几乎没有教学文字：开场的两句话，加上卡住时才出现的一句短提示。
其余全靠图形、动画、音效与语音。孩子是「做」出这个办法，而不是被告知。

## 目录结构

```
apps/site                  Vue 3.5 外壳：典故馆 / 游戏宿主 / 图鉴
packages/game-kit          契约层（GameModule / GameContext / 事件），不含 Phaser
packages/content           典故数据 + zod schema
packages/templates         玩法模板：story / substitution / tap / place / aim / sort / trace / wait / quiz / reward
packages/phaser-kit        Phaser 启动器、主题、基础场景
packages/platform          Web 实现：IndexedDB / WebAudio / TTS / 生命周期
packages/progress          存档、复习调度（纯函数，可单测）
games/caochong-elephant    曹冲称象（等量代换：substitution 模板）
games/pangu                盘古开天辟地（撑天 tap + 化身 place + 专属开蛋场景）
games/houyi / nuwa / jingwei / kuafu / yugong   后羿射日 / 女娲补天 / 精卫填海 / 夸父追日 / 愚公移山
games/shennong / dayu / taigong / fenghuo / qiren  神农尝百草 / 大禹治水 / 太公钓鱼 / 烽火戏诸侯 / 杞人忧天
e2e                        Playwright 冒烟 + 真实操作 + 截图
```

## 三条架构铁律

1. **逻辑与渲染分离**：规则写在纯 TS 里，不 import Phaser，可脱离浏览器单测。
2. **游戏不碰环境**：存档 / 音频 / 生命周期一律走 `GameContext.services`，禁止直接 `localStorage` / `fetch`。
3. **每个游戏可无头直达**：支持 `?seed=&autoplay=1`，否则无法自动化验证。

详见 [docs/技术方案.md](docs/技术方案.md)。
