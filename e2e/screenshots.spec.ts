import { test } from '@playwright/test';
import { clickDesign, dragDesign } from './helpers';
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
