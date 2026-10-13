import { test } from '@playwright/test';
import { clickDesign, dragDesign, holdDesign, tapDesign } from './helpers';
import { REWARD, SUB, SUB_PILES } from '../packages/templates/src/layout';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface StageScript { template: string; levelScript: unknown }

/** Playwright 的 ESM 加载器不接受裸 JSON 导入，这里自己读 */
function loadContent(id: string): { game: { stages: StageScript[] } } {
  const path = fileURLToPath(new URL('../packages/content/src/allusions/' + id + '.json', import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as { game: { stages: StageScript[] } };
}

const panguJson = loadContent('pangu');

const BOAT = { x: SUB.boatX, y: 600 };

test('capture screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/');
  await page.waitForSelector('[data-testid="hall"]');
  await page.screenshot({ path: 'docs/screenshots/01-hall.png' });

  await page.getByTestId('start-caochong-elephant').click();
  await page.waitForSelector('canvas');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/02-story.png' });

  await clickDesign(page, 375, 900);
  await page.waitForTimeout(400);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/03-try-scale.png' });

  // 直接上秤 → 压垮
  await dragDesign(page, SUB.heavyHome, { x: SUB.scalePos.x, y: SUB.scalePos.y - 40 });
  await page.waitForTimeout(320);
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

test('capture pangu screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/');
  await page.waitForSelector('[data-testid="hall"]');
  await page.screenshot({ path: 'docs/screenshots/11-hall-two.png' });

  await page.getByTestId('start-pangu').click();
  await page.waitForSelector('canvas');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/12-pangu-story.png' });

  await clickDesign(page, 375, 900);
  await page.waitForTimeout(400);
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

  for (let i = 0; i < 24; i += 1) {
    await clickDesign(page, 375, 700);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'docs/screenshots/17-sky-high.png' });

  for (let i = 0; i < 6; i += 1) {
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
  await page.goto('/?lang=en');
  await page.waitForSelector('[data-testid="hall"]');
  await page.screenshot({ path: 'docs/screenshots/23-en-hall.png' });

  await page.getByTestId('start-pangu').click();
  await page.waitForSelector('canvas');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/24-en-story.png' });

  await clickDesign(page, 375, 900);
  await page.waitForTimeout(400);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(600);
  for (let i = 0; i < 4; i += 1) {
    await clickDesign(page, 375, 700);
    await page.waitForTimeout(130);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'docs/screenshots/25-en-push.png' });

  for (let i = 0; i < 30; i += 1) {
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
  await page.goto('/?lang=zh-CN#/play/nuwa');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/30-nuwa-story.png' });

  await clickDesign(page, 375, 900);
  await page.waitForTimeout(400);
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
  await page.goto('/?lang=zh-CN#/play/houyi');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/34-houyi-story.png' });

  await clickDesign(page, 375, 900);
  await page.waitForTimeout(400);
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
  await page.goto('/?lang=zh-CN#/play/jingwei');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/40-jingwei-story.png' });
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(400);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/41-jingwei-start.png' });

  await tapDesign(page, 375, 1000, 16, 110);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screenshots/42-jingwei-half.png' });

  await tapDesign(page, 375, 1000, 18, 110);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/screenshots/43-jingwei-island.png' });
});

test('capture kuafu screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN#/play/kuafu');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/44-kuafu-story.png' });
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(400);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/45-kuafu-running.png' });

  // 跑到河渭，喝水那一刻
  await holdDesign(page, 375, 1000, 3300);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/46-kuafu-drinking.png' });

  await holdDesign(page, 375, 1000, 5200);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/47-kuafu-peach.png' });
});

test('capture yugong screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/?lang=zh-CN#/play/yugong');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/48-yugong-story.png' });
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(400);
  await clickDesign(page, 375, 900);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/49-yugong-mountains.png' });

  // 挖到智叟出现：里程碑在 30%，3000 担的 30% 正好是第 9 下
  await tapDesign(page, 375, 1000, 9, 130);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/50-yugong-zhisou.png' });

  // 继续挖到第一次交接（60%）
  await tapDesign(page, 375, 1000, 12, 130);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/51-yugong-handover.png' });

  await tapDesign(page, 375, 1000, 26, 130);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/screenshots/52-yugong-done.png' });
});
