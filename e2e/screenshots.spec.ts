import { test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  BALANCE_STONE_BUTTONS, CHOICE_OPTIONS, DESIGN, QUIZ, REWARD, REVEAL_NEXT, STORY_NEXT,
} from '../packages/templates/src/layout';

async function clickDesign(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  const scale = Math.min(box.width / DESIGN.width, box.height / DESIGN.height);
  const ox = box.x + (box.width - DESIGN.width * scale) / 2;
  const oy = box.y + (box.height - DESIGN.height * scale) / 2;
  await page.mouse.click(ox + x * scale, oy + y * scale);
}

test('capture screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/');
  await page.waitForSelector('[data-testid="hall"]');
  await page.screenshot({ path: 'docs/screenshots/01-hall.png' });

  await page.getByTestId('start-caochong-elephant').click();
  await page.waitForSelector('canvas');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/02-story.png' });

  for (let i = 0; i < 4; i += 1) {
    await clickDesign(page, STORY_NEXT.x, STORY_NEXT.y);
    await page.waitForTimeout(120);
  }
  await page.screenshot({ path: 'docs/screenshots/03-choice.png' });

  await clickDesign(page, CHOICE_OPTIONS[1].x, CHOICE_OPTIONS[1].y);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/screenshots/04-reveal.png' });

  await clickDesign(page, REVEAL_NEXT.x, REVEAL_NEXT.y);
  await page.waitForTimeout(400);
  for (let i = 0; i < 4; i += 1) {
    await clickDesign(page, BALANCE_STONE_BUTTONS[0].x, BALANCE_STONE_BUTTONS[0].y);
    await page.waitForTimeout(120);
  }
  await page.screenshot({ path: 'docs/screenshots/05-balance.png' });

  await clickDesign(page, BALANCE_STONE_BUTTONS[0].x, BALANCE_STONE_BUTTONS[0].y);
  await clickDesign(page, BALANCE_STONE_BUTTONS[0].x, BALANCE_STONE_BUTTONS[0].y);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'docs/screenshots/06-quiz.png' });

  for (let i = 0; i < 3; i += 1) {
    await clickDesign(page, QUIZ.options[1].x, QUIZ.options[1].y);
    await page.waitForTimeout(150);
    await clickDesign(page, QUIZ.next.x, QUIZ.next.y);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screenshots/07-card.png' });

  await clickDesign(page, REWARD.done.x, REWARD.done.y);
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: '我的图鉴' }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'docs/screenshots/08-album.png' });
});
