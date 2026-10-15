import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clickDesign, dragDesign, events, holdDesign, tapDesign } from './helpers';
import { archerAt } from '../games/yangyouji/src/layout';
import { SUB, SUB_PILES } from '../packages/templates/src/layout';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * 双语版面巡检：把两部游戏在两种语言下的**每一个画面**都截下来，写进 .scratch/i18n-audit/。
 * 改文案、加语言、调版面之后跑一次，人眼扫一遍即可。
 *
 *   pnpm audit:i18n
 */
const panguJson = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../packages/content/src/allusions/pangu.json', import.meta.url)),
    'utf8',
  ),
) as { game: { stages: { levelScript: unknown }[] } };
const place = panguJson.game.stages[1]!.levelScript as {
  slots: { id: string; x: number; y: number }[];
  orbs: { id: string; slotId: string; x: number; y: number }[];
};

const BOAT = { x: SUB.boatX, y: 600 };

/** 其余十部典故：手动走一遍看版面，再用 autoplay 直接冲到典故卡 */
/**
 * driver = "怎么把这局玩到典故卡"。
 * 第二辑的玩法不是连点（要尝、要划、要等），所以每部各给一个驱动方式；
 * 没有 driver 的走默认的连点分支。
 */
type Driver =
  | 'place' | 'sort' | 'trace' | 'wait' | 'beacon'
  | 'mark' | 'split' | 'burrow' | 'practice' | 'butcher';

const NEW_GAMES: {
  id: string;
  taps?: number;
  hold?: number;
  shoot?: number;
  driver?: Driver;
}[] = [
  { id: 'nuwa', driver: 'place' },
  { id: 'houyi', shoot: 3 },
  { id: 'jingwei', taps: 12 },
  { id: 'kuafu', hold: 2400 },
  { id: 'yugong', taps: 12 },
  // 第二辑
  { id: 'shennong', driver: 'sort' },
  { id: 'dayu', taps: 4, driver: 'trace' },
  { id: 'taigong', driver: 'wait' },
  { id: 'fenghuo', driver: 'beacon' },
  { id: 'qiren', driver: 'place' },
  // 第三辑
  { id: 'kezhou', driver: 'mark' },
  { id: 'zhaosanmusi', driver: 'split' },
  { id: 'jiaotu', driver: 'burrow' },
  { id: 'yangyouji', driver: 'practice' },
  { id: 'paoding', driver: 'butcher' },
];

interface Point { x: number; y: number }
/** 把一部典故的关卡脚本读出来（版面巡检要按真实坐标点） */
function levelOf(id: string, stage = 0): Record<string, unknown> {
  const path = fileURLToPath(
    new URL('../packages/content/src/allusions/' + id + '.json', import.meta.url),
  );
  const json = JSON.parse(readFileSync(path, 'utf8')) as {
    game: { stages: { levelScript: Record<string, unknown> }[] };
  };
  return json.game.stages[stage]!.levelScript;
}

const nuwaScript = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../packages/content/src/allusions/nuwa.json', import.meta.url)),
    'utf8',
  ),
) as { game: { stages: { levelScript: { slots: { id: string; x: number; y: number }[]; orbs: { slotId: string; x: number; y: number }[] } }[] } };
const nuwaPlace = nuwaScript.game.stages[0]!.levelScript;

const houyiScript = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../packages/content/src/allusions/houyi.json', import.meta.url)),
    'utf8',
  ),
) as { game: { stages: { levelScript: { targets: { x: number; y: number }[] } }[] } };
const houyiTargets = houyiScript.game.stages[0]!.levelScript.targets;
const LOCALES = ['zh-CN', 'en'] as const;

/**
 * 巡检是"给画面截图"用的，不该因为一次点击没抓住就整轮失败。
 * 这几个小工具都按**事件**判断有没有真的做到，最多重试几次。
 */
async function waitEvent(
  page: Page,
  needle: string,
  tries = 60,
  gap = 400,
): Promise<boolean> {
  for (let i = 0; i < tries; i += 1) {
    if ((await events(page)).includes(needle)) return true;
    await page.waitForTimeout(gap);
  }
  return false;
}

/** 点到这个事件出现为止（挖洞、点火这类"点一下推一格"的玩法都靠它） */
async function tapUntil(
  page: Page,
  x: number,
  y: number,
  needle: string,
  tries = 5,
  gap = 260,
): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    if ((await events(page)).includes(needle)) return;
    await clickDesign(page, x, y);
    await page.waitForTimeout(gap);
  }
}

/** 拖到这块/这一箭真的成了为止 */
async function dragUntil(
  page: Page,
  from: Point,
  to: Point,
  needle: string,
  tries = 4,
): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    if ((await events(page)).includes(needle)) return;
    await dragDesign(page, from, to);
    await page.waitForTimeout(320);
  }
}

for (const locale of LOCALES) {
  const out = '.scratch/i18n-audit/' + locale;

  test('audit ' + locale + ' — caochong', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto('/?lang=' + locale + '&story=instant#/play/caochong-elephant');
    await page.waitForSelector('canvas');
    await page.waitForTimeout(800);
    await page.screenshot({ path: out + '/01-story.png' });

    await clickDesign(page, 375, 900);
    await page.waitForTimeout(520);
    await page.screenshot({ path: out + '/02-story2.png' });
    await clickDesign(page, 375, 900);
    await page.waitForTimeout(600);
    await page.screenshot({ path: out + '/03-try.png' });

    await dragDesign(page, SUB.heavyHome, BOAT);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: out + '/04-mark.png' });

    await clickDesign(page, SUB.boatX, SUB.waterTop - 60);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: out + '/05-substitute.png' });

    for (let i = 0; i < 6; i += 1) {
      await dragDesign(page, SUB_PILES[0], BOAT);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: out + '/06-matched.png' });

    await page.waitForTimeout(5200);
    await page.screenshot({ path: out + '/07-weighed.png' });
    await page.waitForTimeout(2600);
    await page.screenshot({ path: out + '/08-card.png' });
  });

  test('audit ' + locale + ' — pangu', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto('/?lang=' + locale + '&story=instant#/play/pangu');
    await page.waitForSelector('canvas');
    await page.waitForTimeout(800);
    await page.screenshot({ path: out + '/09-story.png' });

    await clickDesign(page, 375, 900);
    await page.waitForTimeout(520);
    await page.screenshot({ path: out + '/10-story2.png' });
    await clickDesign(page, 375, 900);
    await page.waitForTimeout(700);
    await page.screenshot({ path: out + '/11-chaos.png' });

    for (let i = 0; i < 4; i += 1) {
      await clickDesign(page, 375, 700);
      await page.waitForTimeout(140);
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: out + '/12-grow-start.png' });

    for (let i = 0; i < 40; i += 1) {
      await clickDesign(page, 375, 700);
      await page.waitForTimeout(45);
    }
    await page.waitForTimeout(2600);
    await page.screenshot({ path: out + '/13-place.png' });

    const first = place.orbs[0]!;
    const firstSlot = place.slots.find((s) => s.id === first.slotId)!;
    await dragDesign(page, { x: first.x, y: first.y }, { x: firstSlot.x, y: firstSlot.y });
    await page.waitForTimeout(400);
    await page.screenshot({ path: out + '/14-placed.png' });

    for (const orb of place.orbs.slice(1)) {
      const slot = place.slots.find((s) => s.id === orb.slotId)!;
      await dragDesign(page, { x: orb.x, y: orb.y }, { x: slot.x, y: slot.y });
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: out + '/15-world.png' });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: out + '/16-reveal.png' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: out + '/17-card.png' });
  });
}
for (const locale of LOCALES) {
  test('audit ' + locale + ' — 其余十部典故（版面 + 典故卡）', async ({ page }) => {
    test.setTimeout(1_800_000);
    await page.setViewportSize({ width: 430, height: 932 });
    const out = '.scratch/i18n-audit/' + locale;

    // 每次都用不同的查询参数打开。
    // 只改 hash 的导航不会重新加载页面，window.__chags.events 会跨游戏残留 ——
    // 上一个游戏留下的 card:unlocked 会让下一个游戏的循环一进去就跳过。
    let nav = 0;
    const open = (id: string, autoplay = false) => {
      nav += 1;
      return page.goto(
        '/?lang=' + locale + '&r=' + nav + (autoplay ? '&autoplay=1' : '&story=instant') + '#/play/' + id,
      );
    };

    // 单个典故没走完不算"整轮巡检失败"：记下来继续跑，
    // 这样后面的截图照旧产出，失败信息也点名到具体是哪一部。
    const unfinished: string[] = [];

    for (const game of NEW_GAMES) {
      // 一、手动走一遍：故事 → 玩法 → 玩到一半
      await open(game.id);
      await page.waitForSelector('canvas');
      await page.waitForTimeout(700);
      await page.screenshot({ path: out + '/' + game.id + '-1-story.png' });

      await clickDesign(page, 375, 900);
      await page.waitForTimeout(520);
      await clickDesign(page, 375, 900);
      await page.waitForTimeout(700);
      await page.screenshot({ path: out + '/' + game.id + '-2-play.png' });

      if (game.id === 'nuwa') {
        const orb = nuwaPlace.orbs[0]!;
        const slot = nuwaPlace.slots.find((s) => s.id === orb.slotId)!;
        await dragDesign(page, { x: orb.x, y: orb.y }, { x: slot.x, y: slot.y });
      }
      if (game.id === 'kezhou') {
        const level = levelOf('kezhou') as { surfaces: Point[] };
        await clickDesign(page, level.surfaces[0]!.x, level.surfaces[0]!.y);
        await page.waitForTimeout(1800);
      }
      if (game.id === 'zhaosanmusi') {
        const level = levelOf('zhaosanmusi') as { total: number; initialLeft: number; bins: Point[] };
        const gap = (level.bins[1]!.x - level.bins[0]!.x) / level.total;
        await dragDesign(
          page,
          { x: level.bins[0]!.x + gap * level.initialLeft, y: level.bins[0]!.y },
          { x: level.bins[0]!.x + gap * (level.initialLeft + 1), y: level.bins[0]!.y },
        );
      }
      if (game.id === 'jiaotu') {
        const level = levelOf('jiaotu') as { spots: Point[]; digsNeeded: number };
        for (let i = 0; i < level.digsNeeded; i += 1) {
          await clickDesign(page, level.spots[0]!.x, level.spots[0]!.y);
          await page.waitForTimeout(180);
        }
        await page.waitForTimeout(1200);
      }
      if (game.id === 'yangyouji') {
        const level = levelOf('yangyouji') as { targets: Point[] };
        await dragDesign(page, archerAt(0), { x: level.targets[0]!.x, y: level.targets[0]!.y });
        await page.waitForTimeout(600);
      }
      if (game.id === 'paoding') {
        await clickDesign(page, 375, 700);
        await page.waitForTimeout(1800);
      }
      if (game.taps) await tapDesign(page, 375, 1000, game.taps, 110);
      if (game.hold) await holdDesign(page, 375, 1000, game.hold);
      if (game.shoot) {
        for (let i = 0; i < game.shoot; i += 1) {
          const target = houyiTargets[i]!;
          await dragDesign(page, { x: 340, y: 1030 }, { x: target.x, y: target.y });
          await page.waitForTimeout(240);
        }
      }
      await page.waitForTimeout(450);
      await page.screenshot({ path: out + '/' + game.id + '-3-mid.png' });

      // 二、手动玩到典故卡。
      // 这里**不能**用 autoplay：自动通关下卡片只停 200ms 就被跳过了，截到的是游戏馆。
      // 也不能批量连点：卡片出现后剩下的几下正好把「收下」也点了，同样截不到卡片。
      await open(game.id);
      await page.waitForSelector('canvas');
      await page.waitForTimeout(600);
      await clickDesign(page, 375, 900);
      await page.waitForTimeout(520);
      await clickDesign(page, 375, 900);
      await page.waitForTimeout(600);

      if (game.id === 'nuwa') {
        for (const orb of nuwaPlace.orbs) {
          const slot = nuwaPlace.slots.find((s) => s.id === orb.slotId)!;
          await dragDesign(page, { x: orb.x, y: orb.y }, { x: slot.x, y: slot.y });
          await page.waitForTimeout(200);
        }
      } else if (game.id === 'qiren') {
        // 归位：四个"想明白"送回四个担忧泡泡
        const level = levelOf('qiren') as { orbs: ({ slotId: string } & Point)[]; slots: ({ id: string } & Point)[] };
        for (const orb of level.orbs) {
          const slot = level.slots.find((s) => s.id === orb.slotId)!;
          await dragDesign(page, { x: orb.x, y: orb.y }, { x: slot.x, y: slot.y });
          await page.waitForTimeout(220);
        }
      } else if (game.id === 'shennong') {
        // 先尝后分：每株草先送到嘴边，再放进它该去的木牍
        const level = levelOf('shennong') as {
          probe: Point;
          items: ({ binId: string } & Point)[];
          bins: ({ id: string } & Point)[];
        };
        for (const item of level.items) {
          if ((await events(page)).includes('card:unlocked')) break;
          await dragDesign(page, { x: item.x, y: item.y }, { x: level.probe.x, y: level.probe.y });
          await page.waitForTimeout(1800);
          const bin = level.bins.find((b) => b.id === item.binId)!;
          await dragDesign(page, { x: item.x, y: item.y }, { x: bin.x, y: bin.y });
          await page.waitForTimeout(300);
        }
      } else if (game.id === 'dayu') {
        // 堵到决口，再一段一段把河道划出来
        const level = levelOf('dayu', 1) as {
          segments: { start: Point; anchors: Point[]; end: Point }[];
        };
        for (let i = 0; i < 15; i += 1) {
          await clickDesign(page, 375, 1000);
          await page.waitForTimeout(140);
        }
        await page.waitForTimeout(3200);
        for (const segment of level.segments) {
          let from = segment.start;
          for (const point of [...segment.anchors, segment.end]) {
            await dragDesign(page, from, point);
            from = point;
            await page.waitForTimeout(260);
          }
        }
      } else if (game.id === 'fenghuo') {
        // 点四次火：三次戏弄 + 一次真的
        const level = levelOf('fenghuo') as { towers: Point[] };
        const tower = level.towers[0]!;
        for (let round = 0; round < 4; round += 1) {
          await clickDesign(page, tower.x, tower.y);
          for (let i = 0; i < 40; i += 1) {
            const seen = await events(page);
            if (seen.includes('card:unlocked')) break;
            if (seen.includes('beat:enter:ready:' + (round + 1)) || seen.includes('beat:enter:smoke')) break;
            await page.waitForTimeout(300);
          }
          await page.waitForTimeout(200);
        }
      } else if (game.id === 'taigong') {
        // 等满 45 秒（不加诱惑），他来了就把直钩收起来
        const level = levelOf('taigong') as { finale: Point };
        for (let i = 0; i < 200; i += 1) {
          const seen = await events(page);
          if (seen.includes('card:unlocked') || seen.includes('beat:enter:wait:arrived')) break;
          await page.waitForTimeout(500);
        }
        await clickDesign(page, level.finale.x, level.finale.y);
      } else if (game.id === 'kezhou') {
        // 刻在船帮上 → 捞空 → 回到上游 → 改刻在岸边的树上
        const level = levelOf('kezhou') as { surfaces: ({ id: string } & Point)[] };
        const boat = level.surfaces.find((s) => s.id === 'boat')!;
        const tree = level.surfaces.find((s) => s.id === 'tree')!;
        await tapUntil(page, boat.x, boat.y, 'beat:enter:mark:carve:boat', 3);
        await waitEvent(page, 'beat:enter:mark:retry', 80, 400);
        await page.waitForTimeout(1700);
        await tapUntil(page, tree.x, tree.y, 'beat:enter:mark:carve:tree', 3, 400);
      } else if (game.id === 'zhaosanmusi') {
        // 木牌往右挪一格：朝三暮四 → 朝四暮三
        const level = levelOf('zhaosanmusi') as { total: number; initialLeft: number; bins: Point[] };
        const gap = (level.bins[1]!.x - level.bins[0]!.x) / level.total;
        await dragUntil(
          page,
          { x: level.bins[0]!.x + gap * level.initialLeft, y: level.bins[0]!.y },
          { x: level.bins[0]!.x + gap * (level.initialLeft + 1), y: level.bins[0]!.y },
          'beat:enter:split:mood:happy',
        );
      } else if (game.id === 'jiaotu') {
        // 一个洞一个洞地挖，每挖通一个就等这一趟危险过去
        const level = levelOf('jiaotu') as { spots: ({ id: string } & Point)[] };
        const passed = async (): Promise<number> =>
          (await events(page)).filter((e) => e.startsWith('beat:enter:burrow:passed')).length;
        for (const spot of level.spots) {
          if ((await events(page)).includes('card:unlocked')) break;
          const before = await passed();
          await tapUntil(page, spot.x, spot.y, 'beat:enter:burrow:open:' + spot.id, 6, 240);
          for (let i = 0; i < 60; i += 1) {
            if ((await events(page)).includes('card:unlocked')) break;
            if ((await passed()) > before) break;
            await page.waitForTimeout(300);
          }
        }
      } else if (game.id === 'yangyouji') {
        // 一档一档：射中 → 退十步 → 再射
        const level = levelOf('yangyouji') as {
          targets: ({ id: string } & Point)[];
          ladder: { rungs: { targetId: string }[]; advance: Point };
        };
        for (let rung = 0; rung < level.ladder.rungs.length; rung += 1) {
          if ((await events(page)).includes('card:unlocked')) break;
          const target = level.targets.find((t) => t.id === level.ladder.rungs[rung]!.targetId)!;
          await dragUntil(page, archerAt(rung), { x: target.x, y: target.y }, 'beat:enter:hit-' + target.id);
          if (rung < level.ladder.rungs.length - 1) {
            await tapUntil(
              page,
              level.ladder.advance.x,
              level.ladder.advance.y,
              'beat:enter:aim:advance:' + (rung + 1),
              4,
              400,
            );
          }
        }
      } else if (game.id === 'paoding') {
        // 先砍一刀（缝立刻亮起来，中间没有"点了没反应"的空档），再顺着每一块的缝推出去
        const level = levelOf('paoding') as { pieces: ({ id: string; grooveDeg: number } & Point)[] };
        await tapUntil(page, 375, 700, 'beat:enter:butcher:phase:grain', 3, 400);
        for (const piece of level.pieces) {
          if ((await events(page)).includes('card:unlocked')) break;
          const rad = (piece.grooveDeg * Math.PI) / 180;
          await dragUntil(
            page,
            { x: piece.x, y: piece.y },
            {
              x: Math.min(720, Math.max(30, piece.x + Math.cos(rad) * 170)),
              y: Math.min(1300, Math.max(190, piece.y + Math.sin(rad) * 170)),
            },
            'beat:enter:butcher:open:' + piece.id,
          );
        }
      } else if (game.id === 'houyi') {
        for (let i = 0; i < 14; i += 1) {
          if ((await events(page)).includes('card:unlocked')) break;
          const target = houyiTargets[i % houyiTargets.length]!;
          await dragDesign(page, { x: 340, y: 1030 }, { x: target.x, y: target.y });
          await page.waitForTimeout(240);
        }
      } else if (game.hold) {
        // 河渭在 45%（1800 里 ÷ 250 里每秒 ≈ 3.3 秒），喝完再接着追
        await holdDesign(page, 375, 1000, 4200);
        await holdDesign(page, 375, 1000, 5600);
      } else {
        // 连点类：点一下查一次，卡片一出现就立刻停手
        for (let i = 0; i < 80; i += 1) {
          if ((await events(page)).includes('card:unlocked')) break;
          await clickDesign(page, 375, 1000);
          await page.waitForTimeout(110);
        }
      }

      try {
        await expect.poll(() => events(page), { timeout: 120_000 }).toContain('card:unlocked');
      } catch (error) {
        unfinished.push(game.id + '：' + String((error as Error).message).split('\n')[0]);
      }
      await page.waitForTimeout(1600);
      await page.screenshot({ path: out + '/' + game.id + '-4-card.png' });
    }

    expect(unfinished, '这些典故没能走到典故卡 —— 它们的 -2/-3/-4 截图就是卡住的样子').toEqual([]);
  });
}
