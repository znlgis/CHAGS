import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clickDesign, dragDesign, events, holdDesign, tapDesign } from './helpers';
import { REWARD, SUB, SUB_PILES } from '../packages/templates/src/layout';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface StageScript { template: string; levelScript: unknown }

/** 内容目录就是典故清单 —— 别再手抄一份，抄漏一个不会有任何测试发现 */
function allAllusionIds(): string[] {
  const dir = fileURLToPath(new URL('../packages/content/src/allusions', import.meta.url));
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''))
    .sort();
}

/** Playwright 的 ESM 加载器不接受裸 JSON 导入，这里自己读 */
function loadContent(id: string): { game: { stages: StageScript[] } } {
  const path = fileURLToPath(new URL('../packages/content/src/allusions/' + id + '.json', import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as { game: { stages: StageScript[] } };
}

const panguJson = loadContent('pangu');
const houyiJson = loadContent('houyi');
const nuwaJson = loadContent('nuwa');

const BOAT = { x: SUB.boatX, y: 600 };

test('真实操作通关：拖大象上船 → 刻水痕 → 搬石头 → 称出重量', async ({ page }) => {
  await page.goto('/#/play/caochong-elephant');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');

  // 两幕故事：点哪都行。故事页有 350ms 输入锁（防连点跳页），第一下要等锁过去
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:substitution');

  // ① 试着直接上秤 —— 秤会垮，船才是出路
  await dragDesign(page, SUB.heavyHome, { x: SUB.scalePos.x, y: SUB.scalePos.y - 40 });
  await page.waitForTimeout(700);
  expect(await events(page)).toContain('choice:made:scale');
  expect(await events(page)).not.toContain('scene:enter:reward');

  // ② 把大象拖上船
  await dragDesign(page, SUB.heavyHome, BOAT);
  await page.waitForTimeout(900);

  // ③ 在水痕处刻一刀
  await clickDesign(page, SUB.boatX, SUB.waterTop - 60);
  await expect.poll(() => events(page)).toContain('choice:made:carve');

  // ④ 一块块搬石头，直到水痕回到水面（6 × 500 = 3000）
  await expect.poll(() => events(page)).toContain('beat:enter:substitute');
  await page.waitForTimeout(500);
  for (let i = 0; i < 6; i += 1) {
    await dragDesign(page, SUB_PILES[0], BOAT);
    await page.waitForTimeout(120);
  }

  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');

  await clickDesign(page, REWARD.done.x, REWARD.done.y);
  await expect.poll(() => events(page)).toContain('session:exit');
});

test('autoplay 全流程 + 刷新后进度还在', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/caochong-elephant');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');

  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByTestId('collected-count')).toHaveText('1');

  await page.reload();
  await expect(page.getByTestId('collected-count')).toHaveText('1');

  await page.getByRole('button', { name: '我的图鉴' }).click();
  await expect(page.getByTestId('album-card-caochong-elephant')).toBeVisible();
});
interface PlaceScript {
  slots: { id: string; x: number; y: number }[];
  orbs: { id: string; slotId: string; x: number; y: number }[];
}

const panguPlace = panguJson.game.stages[1]!.levelScript as unknown as PlaceScript;

test('盘古：点蛋 → 连点撑天 → 拖光球化身，真实操作通关', async ({ page }) => {
  await page.goto('/#/play/pangu');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');

  // 两幕故事。故事页有 350ms 输入锁（防连点跳页），第一下要等锁过去
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:chaos');

  // ① 连点蛋壳 4 次，混沌炸开
  for (let i = 0; i < 4; i += 1) {
    await clickDesign(page, 375, 700);
    await page.waitForTimeout(130);
  }
  await expect.poll(() => events(page), { timeout: 20_000 }).toContain('scene:enter:tap');

  // ② 连点 30 次，把天撑到一万八千年
  for (let i = 0; i < 30; i += 1) {
    await clickDesign(page, 375, 700);
    await page.waitForTimeout(55);
  }
  await expect.poll(() => events(page), { timeout: 30_000 }).toContain('scene:enter:place');

  // ③ 六个部位各归各位
  for (const orb of panguPlace.orbs) {
    const slot = panguPlace.slots.find((s) => s.id === orb.slotId);
    if (!slot) throw new Error('光球 ' + orb.id + ' 找不到槽位');
    await dragDesign(page, { x: orb.x, y: orb.y }, { x: slot.x, y: slot.y });
    await page.waitForTimeout(200);
  }

  await expect.poll(() => events(page), { timeout: 30_000 }).toContain('card:unlocked');
  await expect.poll(() => events(page), { timeout: 30_000 }).toContain('level:complete');

  await clickDesign(page, REWARD.done.x, REWARD.done.y);
  await expect.poll(() => events(page)).toContain('session:exit');
});

test('盘古 autoplay 全流程 + 进度落盘', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/pangu');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');

  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByTestId('collected-count')).toHaveText('1');
  await page.reload();
  await expect(page.getByTestId('collected-count')).toHaveText('1');
});
test('中英文切换：界面与典故内容都跟着变，并且记得住选择', async ({ page }) => {
  // ?lang=en 优先
  await page.goto('/?lang=en');
  await expect(page.getByTestId('hall')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Story Hall' })).toBeVisible();
  await expect(page.getByText('Cao Chong Weighs the Elephant')).toBeVisible();
  await expect(page.getByText('Pangu Splits Heaven and Earth')).toBeVisible();
  await expect(page.getByTestId('start-pangu')).toHaveText('Play');

  // 用英文内容玩一局，典故卡也应是英文
  await page.goto('/?lang=en&autoplay=1#/play/pangu');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
  await page.getByTestId('nav-album').click();
  await expect(page.getByTestId('album-card-pangu')).toContainText('Pangu Splits Heaven and Earth');
  await expect(page.getByTestId('album-card-pangu')).toContainText('Source');

  // 切回中文
  await page.getByTestId('nav-lang').click();
  await expect(page.getByRole('heading', { name: '我的典故图鉴' })).toBeVisible();

  // 不带 ?lang= 重新进入（会回到典故馆）：应该记得刚才选的"中文"
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '典故馆' })).toBeVisible();

  // 再切到英文，同样记得住
  await page.getByTestId('nav-lang').click();
  await expect(page.getByRole('heading', { name: 'Story Hall' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Story Hall' })).toBeVisible();
});
interface AimScript {
  targets: { id: string; x: number; y: number }[];
  goalCount: number;
}

const houyiAim = houyiJson.game.stages[0]!.levelScript as unknown as AimScript;
const ARCHER = { x: 340, y: 1030 };

/** 从后羿的位置朝目标拖出去，松手射箭 */
async function shootAt(page: Page, target: { x: number; y: number }): Promise<void> {
  await dragDesign(page, ARCHER, target);
  await page.waitForTimeout(240);
}

test('后羿射日：真实拖拽射箭，射九留一', async ({ page }) => {
  await page.goto('/#/play/houyi');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');

  // 故事页有 350ms 输入锁（防连点跳页），第一下要等锁过去
  await page.waitForTimeout(450);

  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:aim');

  // 从近到远射：箭会被前面的太阳挡住（这是刻意的"弹道上先碰到谁"语义），
  // 先把近的射下来，后面的弹道才不会被动挡。
  const byDistance = [...houyiAim.targets].sort(
    (a, b) =>
      Math.hypot(a.x - ARCHER.x, a.y - ARCHER.y) - Math.hypot(b.x - ARCHER.x, b.y - ARCHER.y),
  );
  for (const sun of byDistance.slice(0, houyiAim.goalCount)) {
    await shootAt(page, { x: sun.x, y: sun.y });
  }

  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');
});

test('后羿射日：把最后一个也射了，天黑之后太阳会自己回来（不会卡死）', async ({ page }) => {
  await page.goto('/#/play/houyi');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  // 故事页有 350ms 输入锁（防连点跳页），第一下要等锁过去
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:aim');

  // 十个全射下来
  for (const sun of houyiAim.targets) {
    await shootAt(page, { x: sun.x, y: sun.y });
  }

  // 关键：走到天黑分支之后，仍然必须能通关，绝不能卡死
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
});

test('后羿射日 autoplay 全流程', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/houyi');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
});
interface PlaceScript2 {
  slots: { id: string; x: number; y: number }[];
  orbs: { id: string; slotId: string; x: number; y: number }[];
}

const nuwaPlace = nuwaJson.game.stages[0]!.levelScript as unknown as PlaceScript2;

test('女娲补天：真实拖拽把五色石补进天上的洞', async ({ page }) => {
  await page.goto('/#/play/nuwa');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');

  // 故事页有 350ms 输入锁（防连点跳页），第一下要等锁过去
  await page.waitForTimeout(450);

  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:place');

  for (const orb of nuwaPlace.orbs) {
    const slot = nuwaPlace.slots.find((s) => s.id === orb.slotId);
    if (!slot) throw new Error('石头 ' + orb.id + ' 找不到对应的洞');
    await dragDesign(page, { x: orb.x, y: orb.y }, { x: slot.x, y: slot.y });
    await page.waitForTimeout(220);
  }

  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
});

test('女娲补天 autoplay 全流程', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/nuwa');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
});
test('精卫填海：连点投石，一块一块把海填出小岛', async ({ page }) => {
  await page.goto('/#/play/jingwei');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  // 故事页有 350ms 输入锁（防连点跳页），第一下要等锁过去
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:tap');

  await tapDesign(page, 375, 1000, 32, 110);
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');
});

test('精卫填海 autoplay 全流程', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/jingwei');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
});

test('夸父追日：按住奔跑，追到河渭喝一口再接着追', async ({ page }) => {
  await page.goto('/#/play/kuafu');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  // 故事页有 350ms 输入锁（防连点跳页），第一下要等锁过去
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:tap');

  // 跑到河渭（45%）：按住约 2.7 秒就到了
  await holdDesign(page, 375, 1000, 3400);

  // 里程碑必须发事件 —— 否则"暂停有没有生效"只能靠肉眼，把 pause 删掉都不会红。
  // 顺序也很重要：到河边是**暂停**，不该直接通关。
  await expect.poll(() => events(page), { timeout: 20_000 }).toContain('beat:enter:milestone:river');
  expect(await events(page)).not.toContain('level:complete');

  // 停下喝一口 —— 松手之后再按下去
  await page.waitForTimeout(200);
  await holdDesign(page, 375, 1000, 5000);

  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
});

test('夸父追日 autoplay 全流程（中途喝水不能卡死）', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/kuafu');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
});

test('愚公移山：连点挖山，智叟与两次代际交接都能接着往下走', async ({ page }) => {
  await page.goto('/#/play/yugong');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  // 故事页有 350ms 输入锁（防连点跳页），第一下要等锁过去
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:tap');

  // 30 担挖平，中途三个里程碑各要点一下才继续，所以多给一些
  await tapDesign(page, 375, 1000, 44, 150);

  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');

  // 智叟先来，然后是两次代际交接，顺序与次数都要对
  const seen = await events(page);
  const marks = seen.filter((e) => e.startsWith('beat:enter:milestone:'));
  expect(marks).toEqual([
    'beat:enter:milestone:zhisou',
    'beat:enter:milestone:gen-2',
    'beat:enter:milestone:gen-3',
  ]);
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');
});

test('愚公移山 autoplay 全流程（三个里程碑都不能卡死）', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/yugong');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
});
test('中英双语下每个典故都能载入 —— 关卡数据在两种语言下都必须过 schema', async ({ page }) => {
  // 英文的 unit 曾经写成 "baskets"，超出上限导致整个游戏打不开，而且构建期没拦住。
  // 这条用例专门守它：只要 schema 校验失败，页面就不会出现 canvas。
  const ids = allAllusionIds();
  for (const locale of ['zh-CN', 'en'] as const) {
    for (const id of ids) {
      await page.goto('/?lang=' + locale + '#/play/' + id);
      await expect(page.locator('canvas'), locale + ' / ' + id + ' 打不开').toBeVisible({
        timeout: 15_000,
      });
      await page.waitForTimeout(180);
    }
  }
});
