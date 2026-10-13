import { test } from '@playwright/test';
import { clickDesign, dragDesign } from './helpers';
import { REWARD, SUB, SUB_PILES } from '../packages/templates/src/layout';

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
