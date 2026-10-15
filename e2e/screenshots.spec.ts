import { test } from '@playwright/test';
import { expect } from '@playwright/test';
import { clickDesign, dragDesign, events, holdDesign, tapDesign } from './helpers';
import { archerAt } from '../games/yangyouji/src/layout';
import { REWARD, SUB, SUB_PILES } from '../packages/templates/src/layout';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface StageScript { template: string; levelScript: unknown }

/** Playwright 的 ESM 加载器不接受裸 JSON 导入，这里自己读 */
function loadContent(id: string): { game: { stages: StageScript[] } } {
  const path = fileURLToPath(new URL('../packages/content/src/entries/' + id + '.json', import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as { game: { stages: StageScript[] } };
}

const panguJson = loadContent('pangu');

const BOAT = { x: SUB.boatX, y: 600 };

test('capture screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?story=instant');
  await page.waitForSelector('[data-testid="hall"]');
  await page.screenshot({ path: 'docs/screenshots/01-hall.png' });

  await page.getByTestId('start-caochong-elephant').click();
  await page.waitForSelector('canvas');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/02-story.png' });

  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await page.screenshot({ path: 'docs/screenshots/03-try-scale.png' });

  // 直接上秤 → 压垮
  await dragDesign(page, SUB.heavyHome, { x: SUB.scalePos.x, y: SUB.scalePos.y - 40 });
  await page.waitForTimeout(520);
  await page.screenshot({ path: 'docs/screenshots/04-scale-fails.png' });

  // 上船 → 刻水痕
  await dragDesign(page, SUB.heavyHome, BOAT);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/05-mark.png' });

  await clickDesign(page, SUB.boatX, SUB.waterTop - 60);
  await page.waitForTimeout(1700);
  await page.screenshot({ path: 'docs/screenshots/06-substitute.png' });

  for (let i = 0; i < 6; i += 1) {
    await dragDesign(page, SUB_PILES[0], BOAT);
    await page.waitForTimeout(120);
  }
  // 六块大石还差一点：再搭一块中石才是大象的重量（3300）
  await dragDesign(page, SUB_PILES[1], BOAT);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/screenshots/07-matched.png' });

  await page.waitForTimeout(4200);
  await page.screenshot({ path: 'docs/screenshots/08-weighed.png' });

  await page.waitForTimeout(2400);
  await page.screenshot({ path: 'docs/screenshots/09-card.png' });

  await clickDesign(page, REWARD.done.x, REWARD.done.y);
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '我的图鉴' }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'docs/screenshots/10-album.png' });
});
interface PlaceScript2 {
  slots: { id: string; x: number; y: number }[];
  orbs: { id: string; slotId: string; x: number; y: number }[];
}

const panguPlaceScript = panguJson.game.stages[1]!.levelScript as unknown as PlaceScript2;

test('capture hall group screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  // 给 README 的"分组"一节用：滚到最底，看还没有游戏的"三十六计"那一组长什么样
  await page.goto('/');
  await page.waitForSelector('[data-testid="hall"]');
  await page.locator('main').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screenshots/91-hall-groups.png' });
});

test('capture story gate screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  // 这一条刻意**不带** ?story=instant：要拍的就是"听完才能继续"那一刻的样子
  await page.goto('/#/play/caochong-elephant');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/89-story-listening.png' });

  // 提前点一下：不翻页，只出现"先听完这个故事"
  await page.mouse.click(215, 500);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screenshots/90-story-keep-listening.png' });
});

test('capture pangu screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?story=instant');
  await page.waitForSelector('[data-testid="hall"]');
  await page.screenshot({ path: 'docs/screenshots/11-hall-two.png' });

  await page.getByTestId('start-pangu').click();
  await page.waitForSelector('canvas');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/12-pangu-story.png' });

  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/13-chaos.png' });

  await clickDesign(page, 375, 700);
  await page.waitForTimeout(150);
  await clickDesign(page, 375, 700);
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'docs/screenshots/14-cracked.png' });

  await clickDesign(page, 375, 700);
  await page.waitForTimeout(160);
  await clickDesign(page, 375, 700);
  await page.waitForTimeout(420);
  await page.screenshot({ path: 'docs/screenshots/15-burst.png' });

  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'docs/screenshots/16-push-start.png' });

  for (let i = 0; i < 30; i += 1) {
    await clickDesign(page, 375, 700);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'docs/screenshots/17-sky-high.png' });

  for (let i = 0; i < 12; i += 1) {
    await clickDesign(page, 375, 700);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(2400);
  await page.screenshot({ path: 'docs/screenshots/18-world.png' });

  // 拖第一件：左眼 → 太阳
  const first = panguPlaceScript.orbs[0]!;
  const firstSlot = panguPlaceScript.slots.find((s) => s.id === first.slotId)!;
  await dragDesign(page, { x: first.x, y: first.y }, { x: firstSlot.x, y: firstSlot.y });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screenshots/19-sun-placed.png' });

  for (const orb of panguPlaceScript.orbs.slice(1)) {
    const slot = panguPlaceScript.slots.find((s) => s.id === orb.slotId)!;
    await dragDesign(page, { x: orb.x, y: orb.y }, { x: slot.x, y: slot.y });
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(420);
  await page.screenshot({ path: 'docs/screenshots/20-world-complete.png' });

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'docs/screenshots/21-pangu-reveal.png' });

  await page.waitForTimeout(2400);
  await page.screenshot({ path: 'docs/screenshots/22-pangu-card.png' });
});
test('capture english screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=en&story=instant');
  await page.waitForSelector('[data-testid="hall"]');
  await page.screenshot({ path: 'docs/screenshots/23-en-hall.png' });

  await page.getByTestId('start-pangu').click();
  await page.waitForSelector('canvas');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/24-en-story.png' });

  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(600);
  for (let i = 0; i < 4; i += 1) {
    await clickDesign(page, 375, 700);
    await page.waitForTimeout(130);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'docs/screenshots/25-en-push.png' });

  for (let i = 0; i < 40; i += 1) {
    await clickDesign(page, 375, 700);
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'docs/screenshots/26-en-place.png' });

  for (const orb of panguPlaceScript.orbs) {
    const slot = panguPlaceScript.slots.find((s) => s.id === orb.slotId)!;
    await dragDesign(page, { x: orb.x, y: orb.y }, { x: slot.x, y: slot.y });
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(2800);
  await page.screenshot({ path: 'docs/screenshots/27-en-card.png' });
});
const nuwaScript = loadContent('nuwa').game.stages[0]!.levelScript as unknown as {
  slots: { id: string; x: number; y: number }[];
  orbs: { id: string; slotId: string; x: number; y: number }[];
};
const houyiScript = loadContent('houyi').game.stages[0]!.levelScript as unknown as {
  targets: { id: string; x: number; y: number }[];
};

test('capture nuwa screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN&story=instant#/play/nuwa');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/30-nuwa-story.png' });

  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/screenshots/31-nuwa-holes.png' });

  const first = nuwaScript.orbs[0]!;
  const firstSlot = nuwaScript.slots.find((s) => s.id === first.slotId)!;
  await dragDesign(page, { x: first.x, y: first.y }, { x: firstSlot.x, y: firstSlot.y });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/32-nuwa-one.png' });

  for (const orb of nuwaScript.orbs.slice(1)) {
    const slot = nuwaScript.slots.find((s) => s.id === orb.slotId)!;
    await dragDesign(page, { x: orb.x, y: orb.y }, { x: slot.x, y: slot.y });
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/33-nuwa-mended.png' });
});

test('capture houyi screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN&story=instant#/play/houyi');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/34-houyi-story.png' });

  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/screenshots/35-houyi-ten-suns.png' });

  // 拉弓瞄准的样子
  await page.mouse.move(195, 720);
  await page.mouse.down();
  await page.mouse.move(260, 300, { steps: 10 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'docs/screenshots/36-houyi-aiming.png' });
  await page.mouse.up();
  await page.waitForTimeout(500);

  for (const sun of houyiScript.targets.slice(0, 8)) {
    await dragDesign(page, { x: 340, y: 1030 }, { x: sun.x, y: sun.y });
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screenshots/37-houyi-nine.png' });
});
test('capture jingwei screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN&story=instant#/play/jingwei');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/40-jingwei-story.png' });
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/41-jingwei-start.png' });

  await tapDesign(page, 375, 1000, 20, 110);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screenshots/42-jingwei-half.png' });

  await tapDesign(page, 375, 1000, 24, 110);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/screenshots/43-jingwei-island.png' });
});

test('capture kuafu screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN&story=instant#/play/kuafu');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/44-kuafu-story.png' });
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/45-kuafu-running.png' });

  // 跑到河渭，喝水那一刻（1800 里 ÷ 250 里每秒，河渭在 45%）
  await holdDesign(page, 375, 1000, 3600);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/46-kuafu-drinking.png' });

  await holdDesign(page, 375, 1000, 5200);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/47-kuafu-peach.png' });
});

// ---------------- 第二辑：神农 / 大禹 / 太公 / 烽火 / 杞人 ----------------

test('capture shennong screenshots', async ({ page }) => {
  const level = loadContent('shennong').game.stages[0]!.levelScript as {
    items: { id: string; x: number; y: number }[];
    bins: { id: string; x: number; y: number }[];
  };
  const herb = level.items.find((i) => i.id === 'liquorice')!;
  const cure = level.bins.find((b) => b.id === 'cure')!;

  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN&story=instant#/play/shennong');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/53-shennong-story.png' });
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/54-shennong-unknown.png' });

  // 先尝一口：拖到嘴边
  await dragDesign(page, { x: herb.x, y: herb.y }, { x: 375, y: 330 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/55-shennong-tasting.png' });
  await page.waitForTimeout(2200);

  // 尝过了，分进"能治病"的木牍
  await dragDesign(page, { x: herb.x, y: herb.y }, { x: cure.x, y: cure.y });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/56-shennong-sorted.png' });
});

test('capture dayu screenshots', async ({ page }) => {
  const stages = loadContent('dayu').game.stages;
  const trace = stages[1]!.levelScript as {
    segments: { start: { x: number; y: number }; anchors: { x: number; y: number }[]; end: { x: number; y: number } }[];
  };

  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN&story=instant#/play/dayu');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/57-dayu-story.png' });
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(800);

  // 堵：一筐一筐往上筑，水也跟着涨（十四筐才漫过堤顶）
  await tapDesign(page, 375, 1000, 6, 140);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screenshots/58-dayu-dike.png' });

  // 再点几下：堤垮，水冲回来
  await tapDesign(page, 375, 1000, 9, 140);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'docs/screenshots/59-dayu-breach.png' });
  await page.waitForTimeout(2600);

  // 疏：划出第一段河道
  const first = trace.segments[0]!;
  let from = first.start;
  for (const point of [...first.anchors, first.end]) {
    await dragDesign(page, from, point);
    from = point;
    await page.waitForTimeout(160);
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/60-dayu-channel.png' });
});

test('capture taigong screenshots', async ({ page }) => {
  const level = loadContent('taigong').game.stages[0]!.levelScript as {
    temptations: { id: string; x: number; y: number }[];
    finale: { x: number; y: number };
    listener: { x: number; y: number };
  };
  const bend = level.temptations[0]!;

  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN&story=instant#/play/taigong');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/61-taigong-story.png' });
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/62-taigong-waiting.png' });

  // 点一下老人：听他说一句
  await clickDesign(page, level.listener.x, level.listener.y);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/63-taigong-listener.png' });

  // 点诱惑：日影退回一点，弯钩收起来
  await clickDesign(page, bend.x, bend.y);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/screenshots/64-taigong-tempted.png' });
});

test('capture fenghuo screenshots', async ({ page }) => {
  const level = loadContent('fenghuo').game.stages[0]!.levelScript as {
    towers: { x: number; y: number }[];
  };
  const first = level.towers[0]!;

  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN&story=instant#/play/fenghuo');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/65-fenghuo-story.png' });
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'docs/screenshots/66-fenghuo-night.png' });

  // 点火：火光一座座传向天边
  await clickDesign(page, first.x, first.y);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'docs/screenshots/67-fenghuo-relay.png' });

  // 诸侯赶来，她笑了
  await page.waitForTimeout(3600);
  await page.screenshot({ path: 'docs/screenshots/68-fenghuo-laugh.png' });

  // 点到第三次，信用用完；第四次是真的，一个人也没来
  await page.waitForTimeout(2400);
  await clickDesign(page, first.x, first.y);
  await page.waitForTimeout(6500);
  await clickDesign(page, first.x, first.y);
  await page.waitForTimeout(6500);
  await clickDesign(page, first.x, first.y);
  await page.waitForTimeout(5200);
  await page.screenshot({ path: 'docs/screenshots/69-fenghuo-nobody.png' });
});

test('capture qiren screenshots', async ({ page }) => {
  const level = loadContent('qiren').game.stages[0]!.levelScript as {
    orbs: { id: string; x: number; y: number; slotId: string }[];
    slots: { id: string; x: number; y: number }[];
  };
  const orb = level.orbs[0]!;
  const slot = level.slots.find((s) => s.id === orb.slotId)!;

  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN&story=instant#/play/qiren');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/70-qiren-story.png' });
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/71-qiren-worries.png' });

  await dragDesign(page, { x: orb.x, y: orb.y }, { x: slot.x, y: slot.y });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'docs/screenshots/72-qiren-one-less.png' });

  // 四个泡泡都破掉：黑云散开，他在星光下睡着
  for (const rest of level.orbs.slice(1)) {
    const target = level.slots.find((s) => s.id === rest.slotId)!;
    await dragDesign(page, { x: rest.x, y: rest.y }, { x: target.x, y: target.y });
    await page.waitForTimeout(320);
  }
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'docs/screenshots/73-qiren-asleep.png' });
});

test('capture yugong screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN&story=instant#/play/yugong');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/48-yugong-story.png' });
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/49-yugong-mountains.png' });

  // 挖到智叟出现：里程碑在 30%，3000 担的 30% 是第 12 下（每下 75 担）
  await tapDesign(page, 375, 1000, 14, 130);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/50-yugong-zhisou.png' });

  // 继续挖到第一次交接（60%）
  await tapDesign(page, 375, 1000, 14, 130);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/51-yugong-handover.png' });

  await tapDesign(page, 375, 1000, 26, 130);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/52-yugong-done.png' });
});
// ---------------- 第三辑：刻舟求剑 / 朝三暮四 / 狡兔三窟 / 百步穿杨 / 庖丁解牛 ----------------

test('capture kezhou screenshots', async ({ page }) => {
  const level = loadContent('kezhou').game.stages[0]!.levelScript as {
    surfaces: { id: string; x: number; y: number }[];
  };
  const boat = level.surfaces.find((s) => s.id === 'boat')!;
  const tree = level.surfaces.find((s) => s.id === 'tree')!;

  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN&story=instant#/play/kezhou');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/74-kezhou-story.png' });
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(900);

  // 刻在船帮上 → 船一漂，刻痕就跟着走（剑还在上游的水底 —— 这张就是签名画面）
  await clickDesign(page, boat.x, boat.y);
  await page.waitForTimeout(5900);
  await page.screenshot({ path: 'docs/screenshots/75-kezhou-drifted.png' });

  // 回到上游，改刻在岸边的树上 → 捞到剑
  await page.waitForTimeout(4200);
  await clickDesign(page, tree.x, tree.y);
  await page.waitForTimeout(7600);
  await page.screenshot({ path: 'docs/screenshots/76-kezhou-found.png' });
});

test('capture zhaosanmusi screenshots', async ({ page }) => {
  const level = loadContent('zhaosanmusi').game.stages[0]!.levelScript as {
    total: number;
    initialLeft: number;
    bins: { x: number; y: number }[];
  };
  const gap = (level.bins[1]!.x - level.bins[0]!.x) / level.total;
  const divider = (left: number) => ({ x: level.bins[0]!.x + gap * left, y: level.bins[0]!.y });

  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN&story=instant#/play/zhaosanmusi');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/77-zhaosanmusi-story.png' });
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(900);

  // 朝三暮四：猴子全在闹
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/screenshots/78-zhaosanmusi-angry.png' });

  // 木牌挪一格：朝四暮三 —— 绳上还是那七颗，猴子却笑了（签名画面）。
  // 拖一次不一定抓得到（手指粗细、落点差几像素），所以按事件确认，最多再试两次。
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await events(page)).includes('beat:enter:split:mood:happy')) break;
    await dragDesign(page, divider(level.initialLeft), divider(level.initialLeft + 1));
    await page.waitForTimeout(500);
  }
  await expect.poll(() => events(page), { timeout: 15_000 }).toContain('beat:enter:split:mood:happy');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screenshots/79-zhaosanmusi-happy.png' });
});

test('capture jiaotu screenshots', async ({ page }) => {
  const level = loadContent('jiaotu').game.stages[0]!.levelScript as {
    spots: { x: number; y: number }[];
    digsNeeded: number;
  };
  const dig = async (spot: { x: number; y: number }): Promise<void> => {
    // 每个洞挖几铲是难度参数，写死会在调难度时静默失效
    for (let i = 0; i < level.digsNeeded; i += 1) {
      await clickDesign(page, spot.x, spot.y);
      await page.waitForTimeout(220);
    }
  };
  const waitFor = async (needle: string, tries = 100): Promise<void> => {
    for (let i = 0; i < tries; i += 1) {
      if ((await events(page)).includes(needle)) return;
      await page.waitForTimeout(200);
    }
  };

  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN&story=instant#/play/jiaotu');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/80-jiaotu-story.png' });
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(900);

  // 只有一个洞：狐狸一守，它就出不去
  await dig(level.spots[0]!);
  await waitFor('beat:enter:burrow:wave:fox:trapped');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/81-jiaotu-one-burrow.png' });

  // 挖到第二个洞躲过狐狸，再到第三个洞躲过猎人和老鹰（签名画面：从别的洞口出来）
  await waitFor('beat:enter:burrow:passed:fox:trapped');
  await dig(level.spots[1]!);
  await waitFor('beat:enter:burrow:passed:hunter:trapped');
  await dig(level.spots[2]!);
  await waitFor('beat:enter:burrow:wave:hunter:safe');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/82-jiaotu-three-burrows.png' });
});

test('capture yangyouji screenshots', async ({ page }) => {
  const level = loadContent('yangyouji').game.stages[0]!.levelScript as {
    targets: { id: string; x: number; y: number }[];
    ladder: { rungs: { targetId: string }[]; advance: { x: number; y: number } };
  };
  const rungs = level.ladder.rungs;
  const targetOf = (rung: number) =>
    level.targets.find((t) => t.id === rungs[rung]!.targetId)!;
  const waitFor = async (needle: string, tries = 40): Promise<void> => {
    for (let i = 0; i < tries; i += 1) {
      if ((await events(page)).includes(needle)) return;
      await page.waitForTimeout(200);
    }
  };

  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN&story=instant#/play/yangyouji');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/83-yangyouji-story.png' });
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(900);

  // 十步：最近、最大的一片柳叶
  const first = targetOf(0);
  await dragDesign(page, archerAt(0), { x: first.x, y: first.y });
  await waitFor('beat:enter:hit-' + first.id);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/84-yangyouji-ten-paces.png' });

  // 一档一档退到百步，一箭穿过那片最小的叶子（签名画面）
  for (let rung = 0; rung < rungs.length - 1; rung += 1) {
    await clickDesign(page, level.ladder.advance.x, level.ladder.advance.y);
    await waitFor('beat:enter:aim:advance:' + (rung + 1));
    const target = targetOf(rung + 1);
    await dragDesign(page, archerAt(rung + 1), { x: target.x, y: target.y });
    await waitFor('beat:enter:hit-' + target.id);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/85-yangyouji-hundred-paces.png' });
});

test('capture paoding screenshots', async ({ page }) => {
  const level = loadContent('paoding').game.stages[0]!.levelScript as {
    pieces: { id: string; x: number; y: number; grooveDeg: number }[];
  };
  const pushAlong = async (piece: { x: number; y: number; grooveDeg: number }): Promise<void> => {
    const rad = (piece.grooveDeg * Math.PI) / 180;
    await dragDesign(
      page,
      { x: piece.x, y: piece.y },
      {
        x: Math.min(720, Math.max(30, piece.x + Math.cos(rad) * 170)),
        y: Math.min(1300, Math.max(190, piece.y + Math.sin(rad) * 170)),
      },
    );
    await page.waitForTimeout(240);
  };

  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN&story=instant#/play/paoding');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/86-paoding-story.png' });
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(520);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(900);

  // 第一刀砍在骨头上：刀口多了一个缺口
  await clickDesign(page, 375, 700);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/screenshots/87-paoding-first-cut.png' });

  // 顺着缝一块块推出去，最后只剩一张骨架和一把好刀（签名画面）
  await page.waitForTimeout(1400);
  for (const piece of level.pieces) await pushAlong(piece);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/88-paoding-skeleton.png' });
});

/**
 * 三十六计 · 第一辑（胜战计 1–6）的玩法画面。
 * 这里不做真实操作演出（每条计策的手感留给 smoke 的 autoplay 用例守），
 * 只把"故事听完 → 玩法第一屏"拍下来，用于 README 与版面巡检。
 */
for (const [id, scene, file] of [
  ['mantian-guohai', 'ruse', '92-stratagem-01-mantian.png'],
  ['weiwei-jiuzhao', 'siege', '93-stratagem-02-weiwei.png'],
  ['jiedao-sharen', 'borrow', '94-stratagem-03-jiedao.png'],
  ['yiyi-dailao', 'stillness', '95-stratagem-04-yiyi.png'],
  ['chenhuo-dajie', 'window', '96-stratagem-05-chenhuo.png'],
  ['shengdong-jixi', 'ruse', '97-stratagem-06-shengdong.png'],
  // 第二辑（敌战计 7–12）
  ['wuzhong-shengyou', 'show', '98-stratagem-07-wuzhong.png'],
  ['andu-chencang', 'twoline', '99-stratagem-08-andu.png'],
  ['gean-guanhuo', 'wait', '100-stratagem-09-gean.png'],
  ['xiaoli-cangdao', 'read', '101-stratagem-10-xiaoli.png'],
  ['lidai-taojiang', 'matchup', '102-stratagem-11-lidai.png'],
  ['shunshou-qianyang', 'window', '103-stratagem-12-shunshou.png'],
  // 第三辑（攻战计 13–18）
  ['dacao-jingshe', 'probe', '104-stratagem-13-dacao.png'],
  ['jieshi-huanhun', 'borrow', '105-stratagem-14-jieshi.png'],
  ['diaohu-lishan', 'lure', '106-stratagem-15-diaohu.png'],
  ['yuqin-guzong', 'chase', '107-stratagem-16-yuqin.png'],
  ['paozhuan-yinyu', 'lure', '108-stratagem-17-paozhuan.png'],
  ['qinzei-qinwang', 'probe', '109-stratagem-18-qinzei.png'],
] as const) {
  test('capture stratagem screenshots: ' + id, async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto('/?lang=zh-CN&story=instant#/play/' + id);
    await page.waitForSelector('canvas');
    // story=instant 只是"不等旁白念完"，故事两幕仍然要自己翻页
    await page.waitForTimeout(450);
    await clickDesign(page, 375, 900);
    await page.waitForTimeout(520);
    await clickDesign(page, 375, 900);
    await expect.poll(() => events(page), { timeout: 20_000 }).toContain('scene:enter:' + scene);
    await page.waitForTimeout(900);
    await page.screenshot({ path: 'docs/screenshots/' + file });
  });
}