import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clickDesign, events, loadContent } from './helpers';

/**
 * 三十六计的真实指针操作：从五个**共享场景**各挑一计，用点/拖/等走一遍。
 *
 * 在这之前 36 部三十六计**一条真实操作用例都没有**（只有 `?autoplay=1` 通关）：
 * 玩法坏在"点不到、拖不上、等不对"时，机器人照样通关，回归集全绿。
 * 这 5 条补的是指针路径，断言都落在**中间态事件**上 ——
 * 起头 / 第几环点亮 / 点错 / 被看见 / 送错 —— 不是只看 level:complete。
 *
 * 覆盖的 5 个场景（每个场景另有 2–4 部计策共用，共 15 部）：
 * - chain（连环）：连环计 35
 * - siege（打要害）：围魏救赵 2
 * - stillness（忍/calm）：空城计 32
 * - swap（换替身/shell）：金蝉脱壳 21
 * - lure（打动/lure favor）：美人计 31
 *
 *   pnpm exec playwright test e2e/stratagems.spec.ts
 *   pnpm exec playwright test e2e/stratagems.spec.ts -g "空城计"
 */

interface Point { x: number; y: number }

/** 读出某个游戏第 n 幕的关卡脚本（详情那半：<id>.game.json；读法在 helpers.loadContent） */
function levelScript<T>(id: string, stage = 0): T {
  return loadContent(id).game.stages[stage]!.levelScript as T;
}

/**
 * 点掉两幕故事、等玩法场景真的起来。
 * 故事页有 350ms 输入锁（防连点跳页），所以第一下要等锁过去 —— 与 smoke.spec.ts 同一套节拍。
 */
async function enterGame(page: Page, id: string, scene: string): Promise<void> {
  await page.goto('/?story=instant#/play/' + id);
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:' + scene);
}

/* ---------------- 连环计 35 / chain · domino（点亮一环接一环） ---------------- */

interface DominoLevel {
  ignite: Point & { radius: number };
  links: (Point & { id: string; radius: number })[];
  windowMs: number;
}

test(
  '连环计 · 连环：点火起头 → 按顺序一环一环接上（没起头、跳着点都不算数）',
  { tag: '@real' },
  async ({ page }) => {
    const level = levelScript<DominoLevel>('lianhuan-ji');
    await enterGame(page, 'lianhuan-ji', 'chain');

    // ① 还没起头：点第一环不算数，只收到一声"还轮不到"（零惩罚）
    const first = level.links[0]!;
    await clickDesign(page, first.x, first.y);
    await expect.poll(() => events(page)).toContain('beat:enter:chain:reject:' + first.id);
    expect(await events(page), '没起头不该点亮').not.toContain('beat:enter:chain:light:' + first.id);

    // ② 点岸边的火种起头：链子从第一环开始走
    await clickDesign(page, level.ignite.x, level.ignite.y);
    await expect.poll(() => events(page)).toContain('beat:enter:chain:ignite:1');

    // ③ 起头之后也要按顺序：跳到第三环上点不算数
    const third = level.links[2]!;
    await clickDesign(page, third.x, third.y);
    await expect.poll(() => events(page)).toContain('beat:enter:chain:reject:' + third.id);
    expect(await events(page), '跳着点不该点亮').not.toContain('beat:enter:chain:light:' + third.id);

    // ④ 按顺序一环一环接上（每环的时限 2.2 秒，点一下就接上；断了会从起头重来）
    for (const link of level.links) {
      await clickDesign(page, link.x, link.y);
      await expect.poll(() => events(page)).toContain('beat:enter:chain:light:' + link.id);
    }

    await expect.poll(() => events(page), { timeout: 20_000 }).toContain('beat:enter:chain:domino:done');
    await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
    await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');
  },
);

/* ---------------- 围魏救赵 2 / siege · vital（正面推不动，去打他要救的地方） ---------------- */

interface VitalLevel {
  front: Point & { radius: number };
  vital: (Point & { id: string; radius: number; relief: number })[];
  resistance: number;
  goal: number;
}

test(
  '围魏救赵 · 打要害：正面推不动 → 点两处要害 → 正面才推得动',
  { tag: '@real' },
  async ({ page }) => {
    test.setTimeout(120_000);
    const level = levelScript<VitalLevel>('weiwei-jiuzhao');
    await enterGame(page, 'weiwei-jiuzhao', 'siege');

    // ① 正面硬推：阻力 8 时一下只加 0.2 —— 推得动，但推不满
    for (let i = 0; i < 5; i += 1) {
      await clickDesign(page, level.front.x, level.front.y);
      await page.waitForTimeout(90);
    }
    expect(await events(page), '光推正面不可能解围').not.toContain('beat:enter:siege:done');

    // ② 点要害：正面阻力减掉 relief（界面上的兵马回防）
    const firstVital = level.vital[0]!;
    const secondVital = level.vital[1]!;
    await clickDesign(page, firstVital.x, firstVital.y);
    await expect.poll(() => events(page)).toContain('beat:enter:siege:relieve:' + firstVital.id);

    // 同一个要害点第二次不会重复减阻力（点过了就原样返回）—— 事件只发一次
    await page.waitForTimeout(800); // 让上一次"回防"的 620ms 演出走完
    await clickDesign(page, firstVital.x, firstVital.y);
    await page.waitForTimeout(300);
    expect(
      (await events(page)).filter((e) => e === 'beat:enter:siege:relieve:' + firstVital.id),
      '同一个要害只能减一次阻力',
    ).toHaveLength(1);

    // ③ 点第二处要害：两处都回防，阻力归零
    await clickDesign(page, secondVital.x, secondVital.y);
    await expect.poll(() => events(page)).toContain('beat:enter:siege:relieve:' + secondVital.id);
    expect(await events(page), '要害点完还要自己推正面').not.toContain('beat:enter:siege:done');

    // ④ 正面推满 goal（阻力 0 之后一下 1）
    for (let i = 0; i < level.goal; i += 1) {
      await clickDesign(page, level.front.x, level.front.y);
      await page.waitForTimeout(90);
    }
    await expect.poll(() => events(page), { timeout: 20_000 }).toContain('beat:enter:siege:done');
    await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
    await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');
  },
);

/* ---------------- 空城计 32 / stillness · calm（他盯着的时候一下都别动） ---------------- */

interface CalmLevel {
  gate: Point & { radius: number };
  watches: { id: string; watchMs: number; gapMs: number }[];
  needed: number;
}

test(
  '空城计 · 忍：盯着时动一下只是白忍一轮，忍住两轮曹军自退',
  { tag: '@real' },
  async ({ page }) => {
    test.setTimeout(120_000);
    const level = levelScript<CalmLevel>('kongcheng-ji');
    await enterGame(page, 'kongcheng-ji', 'stillness');

    // ① 大开城门：开局唯一那个动作
    await clickDesign(page, level.gate.x, level.gate.y);
    await expect.poll(() => events(page)).toContain('beat:enter:stillness:gate');

    // ② 他盯过来的时候动一下：只记一笔"白忍"（零惩罚，不结束、不锁操作）
    const firstWatch = level.watches[0]!;
    await expect.poll(() => events(page)).toContain('beat:enter:stillness:watch:' + firstWatch.id);
    await clickDesign(page, 200, 1100);
    await expect.poll(() => events(page)).toContain('beat:enter:stillness:slip:' + firstWatch.id);
    expect(await events(page), '动一下不该直接判负').not.toContain('beat:enter:stillness:done');

    // ③ 之后两轮（他盯着 → 移开目光）一下都不动：忍够 needed 轮，他自己退走
    const secondWatch = level.watches[1]!;
    const thirdWatch = level.watches[2]!;
    await expect.poll(() => events(page), { timeout: 40_000 }).toContain(
      'beat:enter:stillness:gap:' + secondWatch.id,
    );
    await expect.poll(() => events(page), { timeout: 40_000 }).toContain(
      'beat:enter:stillness:gap:' + thirdWatch.id,
    );
    await expect.poll(() => events(page), { timeout: 40_000 }).toContain('beat:enter:stillness:done');
    expect(await events(page), '忍着的时候不该再有白忍').not.toContain(
      'beat:enter:stillness:slip:' + secondWatch.id,
    );
    expect(await events(page)).not.toContain('beat:enter:stillness:slip:' + thirdWatch.id);

    await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
    await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');
  },
);

/* ---------------- 金蝉脱壳 21 / swap · shell（样子不对放不上去，全换好才走得掉） ---------------- */

interface ShellLevel {
  posts: (Point & { id: string; radius: number; kind: string })[];
  spares: (Point & { id: string; radius: number; kind: string })[];
  peekMs: number;
  exit: Point & { radius: number };
}

test(
  '金蝉脱壳 · 换替身：样子不对放不上去，五个岗位全换好才走得掉',
  { tag: '@real' },
  async ({ page }) => {
    test.setTimeout(120_000);
    const level = levelScript<ShellLevel>('jinchan-tuoqiao');
    const post = (id: string) => level.posts.find((p) => p.id === id)!;
    const spare = (id: string) => level.spares.find((s) => s.id === id)!;
    await enterGame(page, 'jinchan-tuoqiao', 'swap');

    // ① 从草堆里拿起一个替身（旗）
    await clickDesign(page, spare('s1').x, spare('s1').y);
    await expect.poll(() => events(page)).toContain('beat:enter:swap:carry:s1');

    // ② 样子不对放不上去：鼓的岗位上放旗子替身 → 只提示"样子不对"，替身还在手上
    await clickDesign(page, post('p1').x, post('p1').y);
    await expect.poll(() => events(page)).toContain('beat:enter:swap:wrong:p1:s1');
    expect(await events(page), '样子不对却放上去了').not.toContain('beat:enter:swap:place:p1');

    // ③ 放到样子对得上的岗位上（旗 → 旗）
    await clickDesign(page, post('p2').x, post('p2').y);
    await expect.poll(() => events(page)).toContain('beat:enter:swap:place:p2');

    // ④ 余下四个岗位一个不落：鼓 / 火把 / 枪 / 号各有同 kind 的替身
    const pairs: [string, string][] = [
      ['s3', 'p1'],
      ['s5', 'p3'],
      ['s4', 'p4'],
      ['s2', 'p5'],
    ];
    for (const [spareId, postId] of pairs) {
      await clickDesign(page, spare(spareId).x, spare(spareId).y);
      await clickDesign(page, post(postId).x, post(postId).y);
      await expect.poll(() => events(page)).toContain('beat:enter:swap:place:' + postId);
    }

    // ⑤ 五个岗位全换成替身了：院门开着小手在招手，从院门走掉才算脱壳
    await expect.poll(() => events(page)).toContain('beat:enter:swap:ready');
    await clickDesign(page, level.exit.x, level.exit.y);
    await expect.poll(() => events(page)).toContain('beat:enter:swap:done');
    await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
    await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');
  },
);

/* ---------------- 美人计 31 / lure · favor（看他目光停在哪儿，送对那一样） ---------------- */

interface FavorLevel {
  gifts: (Point & { id: string; radius: number; kind: string })[];
  target: Point & { radius: number; wants: string };
  needOffers: number;
}

test(
  '美人计 · 送对那一样：送错只是白送，送去他一直在看的那一样才打动他',
  { tag: '@real' },
  async ({ page }) => {
    test.setTimeout(120_000);
    const level = levelScript<FavorLevel>('meiren-ji');
    const gift = (id: string) => level.gifts.find((g) => g.id === id)!;
    await enterGame(page, 'meiren-ji', 'lure');

    // ① 送一样他没在看的：东西被退回来（零惩罚，还能接着送）
    const refused = level.gifts.find((g) => g.id !== level.target.wants)!;
    await clickDesign(page, refused.x, refused.y);
    await expect.poll(() => events(page)).toContain('beat:enter:lure:favor:' + refused.id);
    expect(await events(page), '送错不该直接打动他').not.toContain('beat:enter:lure:done');

    // ② 送他目光一直停着的那一样：收下，一局就打动他了
    const wanted = gift(level.target.wants);
    await clickDesign(page, wanted.x, wanted.y);
    await expect.poll(() => events(page)).toContain('beat:enter:lure:favor:' + wanted.id);
    await expect.poll(() => events(page), { timeout: 20_000 }).toContain('beat:enter:lure:done');
    await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
    await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');
  },
);
