import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clickDesign, dragDesign, events, holdDesign, tapDesign } from './helpers';
import { REWARD, SUB, SUB_PILES } from '../packages/templates/src/layout';
import { archerAt } from '../games/yangyouji/src/layout';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface StageScript { template: string; levelScript: unknown }

/** 内容目录就是典故清单 —— 别再手抄一份，抄漏一个不会有任何测试发现 */
function allEntryIds(): string[] {
  const dir = fileURLToPath(new URL('../packages/content/src/entries', import.meta.url));
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json') && !name.endsWith('.game.json'))
    .map((name) => name.replace(/\.json$/, ''))
    .sort();
}

/** 内容目录里某一组的内容 id —— 数量随时长，用例不写死 */
function entryIdsInGroup(group: string): string[] {
  const dir = fileURLToPath(new URL('../packages/content/src/entries', import.meta.url));
  return readdirSync(dir)
    // 内容拆成摘要（<id>.json）与详情（<id>.game.json）两半：这里只数摘要
    .filter((name) => name.endsWith('.json') && !name.endsWith('.game.json'))
    .filter((name) => {
      const raw = JSON.parse(readFileSync(join(dir, name), 'utf8')) as { group?: string };
      return raw.group === group;
    })
    .map((name) => name.replace(/\.json$/, ''))
    .sort();
}

/** Playwright 的 ESM 加载器不接受裸 JSON 导入，这里自己读 */
function loadContent(id: string): { game: { stages: StageScript[] } } {
  // 关卡脚本在"详情"那半：<id>.game.json（见 docs/技术方案.md §7.13）
  const path = fileURLToPath(new URL('../packages/content/src/entries/' + id + '.game.json', import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as { game: { stages: StageScript[] } };
}

const panguJson = loadContent('pangu');
const houyiJson = loadContent('houyi');
const nuwaJson = loadContent('nuwa');

const BOAT = { x: SUB.boatX, y: 600 };

test('真实操作通关：拖大象上船 → 刻水痕 → 搬石头 → 称出重量', async ({ page }) => {
  await page.goto('/?story=instant#/play/caochong-elephant');
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

  // ④ 一块块搬石头，直到水痕回到水面：6 块大石 = 3000 还差一点，
  //    再搭一块中石正好 3300 —— 新难度要求大小搭配，光搬大石头凑不出来
  await expect.poll(() => events(page)).toContain('beat:enter:substitute');
  await page.waitForTimeout(500);
  for (let i = 0; i < 6; i += 1) {
    await dragDesign(page, SUB_PILES[0], BOAT);
    await page.waitForTimeout(120);
  }
  await dragDesign(page, SUB_PILES[1], BOAT);
  await page.waitForTimeout(200);

  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');

  await clickDesign(page, REWARD.done.x, REWARD.done.y);
  await expect.poll(() => events(page)).toContain('session:exit');
});

/**
 * 故事是正片，不是可以点掉的过场：
 * 每一幕的旁白没念完之前，点哪都不翻页，也不会提前发 story:ready。
 * 无头设备上放不出声音时，按"读一遍"的时间兜底（见 packages/templates/src/story.logic.ts）。
 */
test('故事必须听完：旁白没念完之前，怎么点都不翻页', async ({ page }) => {
  await page.goto('/#/play/caochong-elephant');
  await expect(page.locator('canvas')).toBeVisible();

  // 一进来就猛点：这一幕的旁白至少 2.2 秒（story.logic 的 MIN_NARRATION_MS），
  // 现在点一定还没听完。**这里不要先等 beat:enter / story:ready 之类的条件** ——
  // 机器一慢，旁白可能已经念完，这条性质就变成假失败（负载高的机器上真的踩到过）。
  await page.waitForTimeout(420); // 故事页有 350ms 输入锁，等它过去，第一下点击才真的被接到
  await tapDesign(page, 375, 900, 4, 120);

  const early = await events(page);
  expect(early, '听不完就不该放行').not.toContain('story:ready:s1');
  expect(early, '听不完就不该进玩法').not.toContain('scene:enter:substitution');
  expect(early, '听不完就不该翻到第二幕').not.toContain('beat:enter:s2');

  // 听完第一幕，小手才出现；这时点一下才到第二幕
  await expect.poll(() => events(page), { timeout: 20_000 }).toContain('story:ready:s1');
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page), { timeout: 20_000 }).toContain('beat:enter:s2');
  expect(await events(page), '第二幕还没听就不该进玩法').not.toContain('scene:enter:substitution');

  // 第二幕同样要听完
  await expect.poll(() => events(page), { timeout: 20_000 }).toContain('story:ready:s2');
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page), { timeout: 20_000 }).toContain('scene:enter:substitution');
});

/**
 * 分组：小游戏合集的第一层结构。
 * 分组表在 packages/content/src/groups.ts —— 这里守的是"用户真的看得见分组"：
 * 有内容的组正常列游戏，还没有内容的组显示"敬请期待"而不是消失。
 */
test('分组：典故与三十六计各占一块，数量跟内容目录对齐', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('hall')).toBeVisible();

  const allusionGroup = page.getByTestId('group-allusion');
  const stratagemGroup = page.getByTestId('group-stratagem');
  await expect(allusionGroup).toBeVisible();
  await expect(stratagemGroup).toBeVisible();
  await expect(allusionGroup.getByRole('heading', { level: 2 })).toHaveText('典故');
  await expect(stratagemGroup.getByRole('heading', { level: 2 })).toHaveText('三十六计');

  // 两组各自的入口数量都取自内容目录：三十六计从 0 长到 36，这条用例一行都不用改
  const allusionIds = entryIdsInGroup('allusion');
  const stratagemIds = entryIdsInGroup('stratagem');
  await expect(allusionGroup.getByRole('button', { name: '开始玩' })).toHaveCount(
    allusionIds.length,
  );
  await expect(page.getByTestId('start-pangu')).toBeVisible();

  if (stratagemIds.length === 0) {
    // 还没有计策：显示"敬请期待"和一句说明，而且没有任何入口
    await expect(stratagemGroup).toContainText('敬请期待');
    await expect(page.getByTestId('group-empty-stratagem')).toBeVisible();
    await expect(stratagemGroup.getByRole('button', { name: '开始玩' })).toHaveCount(0);
  } else {
    await expect(stratagemGroup.getByRole('button', { name: '开始玩' })).toHaveCount(
      stratagemIds.length,
    );
    // 每条计策都有"第 n 计"徽章；第一条永远是第 1 计（组内按登记顺序 = 计策序号）
    for (const id of stratagemIds) {
      await expect(page.getByTestId('stratagem-' + id)).toBeVisible();
    }
    await expect(stratagemGroup.getByText('第 1 计')).toBeVisible();
  }

  // 英文下分组名也跟着变；只有空组才有"Coming soon"
  await page.goto('/?lang=en');
  await expect(page.getByTestId('group-allusion').getByRole('heading', { level: 2 })).toHaveText(
    'Stories',
  );
  const enStratagem = page.getByTestId('group-stratagem');
  await expect(enStratagem.getByRole('heading', { level: 2 })).toHaveText('Thirty-Six Stratagems');
  if (stratagemIds.length === 0) {
    await expect(enStratagem).toContainText('Coming soon');
  } else {
    await expect(enStratagem.getByRole('button', { name: 'Play' })).toHaveCount(
      stratagemIds.length,
    );
  }
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
  await page.goto('/?story=instant#/play/pangu');
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

  // ② 连点 40 次，把天撑到一万八千年
  for (let i = 0; i < 40; i += 1) {
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
  await expect(page.getByRole('heading', { name: 'Games' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: '我的图鉴' })).toBeVisible();

  // 不带 ?lang= 重新进入（会回到游戏馆）：应该记得刚才选的"中文"
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '游戏馆' })).toBeVisible();

  // 再切到英文，同样记得住
  await page.getByTestId('nav-lang').click();
  await expect(page.getByRole('heading', { name: 'Games' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Games' })).toBeVisible();
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
  await page.goto('/?story=instant#/play/houyi');
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
  await page.goto('/?story=instant#/play/houyi');
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
  await page.goto('/?story=instant#/play/nuwa');
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
  await page.goto('/?story=instant#/play/jingwei');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  // 故事页有 350ms 输入锁（防连点跳页），第一下要等锁过去
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:tap');

  await tapDesign(page, 375, 1000, 44, 110);
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');
});

test('精卫填海 autoplay 全流程', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/jingwei');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
});

test('夸父追日：按住奔跑，追到河渭喝一口再接着追', async ({ page }) => {
  await page.goto('/?story=instant#/play/kuafu');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  // 故事页有 350ms 输入锁（防连点跳页），第一下要等锁过去
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:tap');

  // 跑到河渭（45%）：按住约 3.3 秒就到了（1800 里 ÷ 250 里每秒）
  await holdDesign(page, 375, 1000, 4200);

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
  await page.goto('/?story=instant#/play/yugong');
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
// ---------------- 第二辑：神农 / 杞人 / 烽火 ----------------

test('神农尝百草：没尝过就分不了类，会被送回嘴边先尝一口', async ({ page }) => {
  await page.goto('/?story=instant#/play/shennong');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:sort');

  const herbs = (loadContent('shennong').game.stages[0]!.levelScript as {
    items: { id: string; x: number; y: number }[];
    bins: { id: string; x: number; y: number }[];
  });
  const liquorice = herbs.items.find((i) => i.id === 'liquorice')!;
  const poisonBin = herbs.bins.find((b) => b.id === 'poison')!;
  const cureBin = herbs.bins.find((b) => b.id === 'cure')!;

  // 甘草还没尝过就拖到"有毒别吃"上：不算错，会被送回嘴边尝一口
  await dragDesign(page, { x: liquorice.x, y: liquorice.y }, { x: poisonBin.x, y: poisonBin.y });
  await expect.poll(() => events(page), { timeout: 15_000 }).toContain('beat:enter:taste:liquorice');
  expect(await events(page)).not.toContain('beat:enter:liquorice');

  // 等它飞回原位、带着"尝过"的牌子，再拖到"能治病"上才算数
  await page.waitForTimeout(2600);
  await dragDesign(page, { x: liquorice.x, y: liquorice.y }, { x: cureBin.x, y: cureBin.y });
  await expect.poll(() => events(page), { timeout: 15_000 }).toContain('beat:enter:liquorice');
});

test('神农尝百草 autoplay 全流程（八株草先尝后分）', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/shennong');
  await expect.poll(() => events(page), { timeout: 90_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
});

test('杞人忧天：把"想明白"送到担忧上，泡泡就破了', async ({ page }) => {
  await page.goto('/?story=instant#/play/qiren');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:place');

  await dragDesign(page, { x: 105, y: 1226 }, { x: 200, y: 245 });
  await expect.poll(() => events(page), { timeout: 15_000 }).toContain('beat:enter:slot-sky');
});

test('杞人忧天 autoplay 全流程', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/qiren');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
});

test('烽火戏诸侯：三次点火把信用用完，真的来了一个人也没来', async ({ page }) => {
  test.setTimeout(120_000);
  const towers = (loadContent('fenghuo').game.stages[0]!.levelScript as {
    towers: { x: number; y: number }[];
  }).towers;
  const first = towers[0]!;
  await page.goto('/?story=instant#/play/fenghuo');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:beacon');

  // 第一次：火光传向天边，诸侯赶来，她笑了
  await clickDesign(page, first.x, first.y);
  await expect.poll(() => events(page), { timeout: 20_000 }).toContain('beat:enter:relay:1');
  await expect.poll(() => events(page), { timeout: 20_000 }).toContain('beat:enter:laugh:1');

  // 第二、三次：信任一格一格用完（每轮约 6 秒）
  await expect.poll(() => events(page), { timeout: 30_000 }).toContain('beat:enter:ready:1');
  await clickDesign(page, first.x, first.y);
  await expect.poll(() => events(page), { timeout: 30_000 }).toContain('beat:enter:laugh:2');
  await expect.poll(() => events(page), { timeout: 30_000 }).toContain('beat:enter:ready:2');
  await clickDesign(page, first.x, first.y);
  await expect.poll(() => events(page), { timeout: 30_000 }).toContain('beat:enter:laugh:3');
  // 信用用完：天边真的起了烟
  await expect.poll(() => events(page), { timeout: 20_000 }).toContain('beat:enter:smoke');

  // 第四次点火是真的 —— 火光还是传了出去，什么也没有回来
  await clickDesign(page, first.x, first.y);
  await expect.poll(() => events(page), { timeout: 20_000 }).toContain('beat:enter:relay:4');
  await expect.poll(() => events(page), { timeout: 30_000 }).toContain('beat:enter:empty');
});

test('烽火戏诸侯 autoplay 全流程', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/fenghuo');
  await expect.poll(() => events(page), { timeout: 90_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
});

test('大禹治水：先堵到决口，再划三段河道（真实操作，三次路过家门都不卡）', async ({ page }) => {
  const trace = loadContent('dayu').game.stages[1]!.levelScript as {
    segments: { start: { x: number; y: number }; anchors: { x: number; y: number }[]; end: { x: number; y: number } }[];
  };
  test.setTimeout(150_000);
  await page.goto('/?story=instant#/play/dayu');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:tap');

  // 堵：点满十四下，堤垮，水冲回来，然后进入"疏"
  await tapDesign(page, 375, 1000, 15, 150);
  await expect.poll(() => events(page), { timeout: 30_000 }).toContain('scene:enter:trace');

  // 疏：一段一段划过去（每一段结束都有"路过家门"的演出）
  for (const segment of trace.segments) {
    let from = segment.start;
    for (const point of [...segment.anchors, segment.end]) {
      await dragDesign(page, from, point);
      from = point;
      await page.waitForTimeout(180);
    }
  }
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');
});

test('大禹治水 autoplay 全流程（决口 → 三段河道 → 三过家门）', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/dayu');
  await expect.poll(() => events(page), { timeout: 120_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
});

test('太公钓鱼：点了诱惑要多等，但永远等得到 —— 等到文王，收起直钩', async ({ page }) => {
  const level = loadContent('taigong').game.stages[0]!.levelScript as {
    temptations: { id: string; x: number; y: number }[];
    finale: { x: number; y: number };
  };
  const bend = level.temptations[0]!;
  test.setTimeout(180_000);
  await page.goto('/?story=instant#/play/taigong');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:wait');

  // 诱惑：不算错，只是把日影往后推一点
  await clickDesign(page, bend.x, bend.y);
  await expect.poll(() => events(page), { timeout: 15_000 }).toContain('beat:enter:tempt:bend');
  expect(await events(page), '点了诱惑不该直接通关').not.toContain('level:complete');

  // 主线仍然只有一件事：等（45 秒 + 5 秒延后）
  await expect.poll(() => events(page), { timeout: 120_000 }).toContain('beat:enter:wait:arrived');
  // 等到之后要做最后一件事：把直钩收起来
  await clickDesign(page, level.finale.x, level.finale.y);
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
});

test('太公钓鱼 autoplay 全流程（等待被压缩，仍然走完整条线）', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/taigong');
  await expect.poll(() => events(page), { timeout: 90_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
});

test('中英双语下每个典故都能载入 —— 关卡数据在两种语言下都必须过 schema', async ({ page }) => {
  // 英文的 unit 曾经写成 "baskets"，超出上限导致整个游戏打不开，而且构建期没拦住。
  // 这条用例专门守它：只要 schema 校验失败，页面就不会出现 canvas。
  const ids = allEntryIds();
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
test('刻舟求剑：刻在船帮上一定捞空，改刻在岸上就捞到了', async ({ page }) => {
  const level = loadContent('kezhou').game.stages[0]!.levelScript as {
    surfaces: { id: string; x: number; y: number }[];
  };
  const boat = level.surfaces.find((s) => s.id === 'boat')!;
  const tree = level.surfaces.find((s) => s.id === 'tree')!;
  test.setTimeout(120_000);

  await page.goto('/?story=instant#/play/kezhou');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:mark');

  // ① 照故事里的做法：刻在船帮上
  await clickDesign(page, boat.x, boat.y);
  await expect.poll(() => events(page)).toContain('beat:enter:mark:carve:boat');
  // 船漂走 → 从记号处下水 → 只摸到水草
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('beat:enter:mark:result:miss');
  expect(await events(page), '捞空不是通关').not.toContain('level:complete');

  // ② 船回到上游，这次刻在岸边的树上
  await expect.poll(() => events(page), { timeout: 20_000 }).toContain('beat:enter:mark:retry');
  await page.waitForTimeout(1600);
  await clickDesign(page, tree.x, tree.y);
  await expect.poll(() => events(page)).toContain('beat:enter:mark:carve:tree');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('beat:enter:mark:result:found');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');
});

test('刻舟求剑 autoplay 全流程（先刻船帮捞空一次，再从岸上捞到）', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/kezhou');
  await expect.poll(() => events(page), { timeout: 90_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
});

test('朝三暮四：挪一格就从发怒变高兴，绳上一直是七颗', async ({ page }) => {
  const level = loadContent('zhaosanmusi').game.stages[0]!.levelScript as {
    total: number;
    initialLeft: number;
    bins: { id: string; x: number; y: number }[];
  };
  const left = level.bins[0]!;
  const right = level.bins[1]!;
  const gap = (right.x - left.x) / level.total;
  test.setTimeout(120_000);

  await page.goto('/?story=instant#/play/zhaosanmusi');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:split');

  // 开局朝三暮四：猴子在闹，还没通关
  expect(await events(page)).not.toContain('split:mood:happy');
  expect(await events(page)).not.toContain('level:complete');

  // 把木牌往右挪一格：早上三颗 → 四颗
  await dragDesign(
    page,
    { x: left.x + gap * level.initialLeft, y: left.y },
    { x: left.x + gap * (level.initialLeft + 1), y: left.y },
  );
  await expect.poll(() => events(page), { timeout: 20_000 }).toContain('beat:enter:split:mood:happy');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');
  // 只是换了分法，没有把一头分空
  expect(await events(page)).not.toContain('beat:enter:split:greedy');
});

test('朝三暮四 autoplay 全流程（一步一格挪到让猴子高兴）', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/zhaosanmusi');
  await expect.poll(() => events(page), { timeout: 90_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
});
test('狡兔三窟：一个洞被狐狸守住，挖到三窟才躲得过', async ({ page }) => {
  const level = loadContent('jiaotu').game.stages[0]!.levelScript as {
    spots: { id: string; x: number; y: number }[];
    digsNeeded: number;
  };
  const dig = async (spot: { x: number; y: number }): Promise<void> => {
    // 每个洞挖几铲是难度参数，写死会在调难度时静默失效
    for (let i = 0; i < level.digsNeeded; i += 1) {
      await clickDesign(page, spot.x, spot.y);
      await page.waitForTimeout(220);
    }
  };
  test.setTimeout(180_000);

  await page.goto('/?story=instant#/play/jiaotu');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:burrow');

  // 只挖一个洞：狐狸一来就把它守住
  await dig(level.spots[0]!);
  await expect.poll(() => events(page), { timeout: 30_000 }).toContain('beat:enter:burrow:open:left');
  await expect.poll(() => events(page), { timeout: 30_000 }).toContain('beat:enter:burrow:wave:fox:trapped');
  expect(await events(page), '被守住不是通关').not.toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 30_000 }).toContain('beat:enter:burrow:passed:fox:trapped');

  // 第二个洞：躲得过狐狸；可猎人和老鹰一起来，两个洞口还是不够
  await dig(level.spots[1]!);
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('beat:enter:burrow:wave:fox:safe');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('beat:enter:burrow:wave:hunter:trapped');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('beat:enter:burrow:passed:hunter:trapped');

  // 第三个洞：三窟已就
  await dig(level.spots[2]!);
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('beat:enter:burrow:wave:hunter:safe');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');
});

/**
 * 三十六计 · 第一辑（胜战计 1–6）。
 * 每条计策一条 autoplay：模板层必须实现 runAutoplay()，否则这里就挂。
 */
for (const [id, title] of [
  ['mantian-guohai', '瞒天过海'],
  ['weiwei-jiuzhao', '围魏救赵'],
  ['jiedao-sharen', '借刀杀人'],
  ['yiyi-dailao', '以逸待劳'],
  ['chenhuo-dajie', '趁火打劫'],
  ['shengdong-jixi', '声东击西'],
  // 第二辑（敌战计 7–12）
  ['wuzhong-shengyou', '无中生有'],
  ['andu-chencang', '暗度陈仓'],
  ['gean-guanhuo', '隔岸观火'],
  ['xiaoli-cangdao', '笑里藏刀'],
  ['lidai-taojiang', '李代桃僵'],
  ['shunshou-qianyang', '顺手牵羊'],
  // 第三辑（攻战计 13–18）
  ['dacao-jingshe', '打草惊蛇'],
  ['jieshi-huanhun', '借尸还魂'],
  ['diaohu-lishan', '调虎离山'],
  ['yuqin-guzong', '欲擒故纵'],
  ['paozhuan-yinyu', '抛砖引玉'],
  ['qinzei-qinwang', '擒贼擒王'],
  // 第四辑（混战计 19–24）
  ['fudi-chouxin', '釜底抽薪'],
  ['hunshui-moyu', '混水摸鱼'],
  ['jinchan-tuoqiao', '金蝉脱壳'],
  ['guanmen-zhuozei', '关门捉贼'],
  ['yuanjiao-jingong', '远交近攻'],
  ['jiadao-faguo', '假道伐虢'],
] as const) {
  test('三十六计 · ' + title + ' autoplay 全流程', async ({ page }) => {
    await page.goto('/?autoplay=1#/play/' + id);
    await expect.poll(() => events(page), { timeout: 120_000 }).toContain('level:complete');
    await expect.poll(() => events(page), { timeout: 60_000 }).toContain('card:unlocked');
    await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
  });
}

test('狡兔三窟 autoplay 全流程（一窟被堵 → 三窟脱身）', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/jiaotu');
  await expect.poll(() => events(page), { timeout: 120_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
});

test('百步穿杨：一档一档往后退，五片柳叶全中', async ({ page }) => {
  const level = loadContent('yangyouji').game.stages[0]!.levelScript as {
    targets: { id: string; x: number; y: number }[];
    ladder: { rungs: { id: string; targetId: string }[]; advance: { x: number; y: number } };
  };
  test.setTimeout(180_000);

  await page.goto('/?story=instant#/play/yangyouji');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:aim');

  for (let rung = 0; rung < level.ladder.rungs.length; rung += 1) {
    const target = level.targets.find((t) => t.id === level.ladder.rungs[rung]!.targetId)!;
    await dragDesign(page, archerAt(rung), { x: target.x, y: target.y });
    await expect.poll(() => events(page), { timeout: 20_000 }).toContain('beat:enter:hit-' + target.id);
    if (rung < level.ladder.rungs.length - 1) {
      // 射中了要自己把木牌往后挪一档，下一片叶子才露面
      await clickDesign(page, level.ladder.advance.x, level.ladder.advance.y);
      await expect.poll(() => events(page), { timeout: 20_000 }).toContain(
        'beat:enter:aim:advance:' + (rung + 1),
      );
    }
  }
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');
});

test('百步穿杨 autoplay 全流程（五档一档一档练上去）', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/yangyouji');
  await expect.poll(() => events(page), { timeout: 120_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
});
test('庖丁解牛：先砍一刀留下缺口，再顺着缝一块块推出去', async ({ page }) => {
  const level = loadContent('paoding').game.stages[0]!.levelScript as {
    pieces: { id: string; x: number; y: number; grooveDeg: number }[];
  };
  /** 顺势拖一段（端点夹回画布里，别把手指拖到画布外面去） */
  const pushAlong = async (piece: { x: number; y: number; grooveDeg: number }): Promise<void> => {
    const rad = (piece.grooveDeg * Math.PI) / 180;
    const to = {
      x: Math.min(720, Math.max(30, piece.x + Math.cos(rad) * 170)),
      y: Math.min(1300, Math.max(190, piece.y + Math.sin(rad) * 170)),
    };
    await dragDesign(page, { x: piece.x, y: piece.y }, to);
  };
  test.setTimeout(180_000);

  await page.goto('/?story=instant#/play/paoding');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => events(page)).toContain('session:start');
  await page.waitForTimeout(450);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await expect.poll(() => events(page)).toContain('scene:enter:butcher');

  // 第一刀砍在骨头上：刀口多一个缺口（不失败、不扣分）
  await clickDesign(page, 375, 700);
  await expect.poll(() => events(page), { timeout: 20_000 }).toContain('beat:enter:butcher:blind:1');
  expect(await events(page), '砍一刀不是通关').not.toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 20_000 }).toContain('beat:enter:butcher:phase:grain');

  // 顺着每一块的缝推出去
  for (const piece of level.pieces) {
    await pushAlong(piece);
    await expect.poll(() => events(page), { timeout: 20_000 }).toContain(
      'beat:enter:butcher:open:' + piece.id,
    );
  }
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 40_000 }).toContain('card:unlocked');
});

test('庖丁解牛 autoplay 全流程（先撞一次，再顺缝解完）', async ({ page }) => {
  await page.goto('/?autoplay=1#/play/paoding');
  await expect.poll(() => events(page), { timeout: 120_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
});
