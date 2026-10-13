import { test } from '@playwright/test';
import { clickDesign, dragDesign } from './helpers';
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
const LOCALES = ['zh-CN', 'en'] as const;

for (const locale of LOCALES) {
  const out = '.scratch/i18n-audit/' + locale;

  test('audit ' + locale + ' — caochong', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto('/?lang=' + locale + '#/play/caochong-elephant');
    await page.waitForSelector('canvas');
    await page.waitForTimeout(800);
    await page.screenshot({ path: out + '/01-story.png' });

    await clickDesign(page, 375, 900);
    await page.waitForTimeout(400);
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
    await page.goto('/?lang=' + locale + '#/play/pangu');
    await page.waitForSelector('canvas');
    await page.waitForTimeout(800);
    await page.screenshot({ path: out + '/09-story.png' });

    await clickDesign(page, 375, 900);
    await page.waitForTimeout(400);
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

    for (let i = 0; i < 30; i += 1) {
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
