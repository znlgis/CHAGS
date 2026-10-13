import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __chags?: { events: string[]; last: string | null };
  }
}

const events = (page: Page): Promise<string[]> =>
  page.evaluate(() => window.__chags?.events ?? []);

test('生产构建产物：游戏 chunk 懒加载 + 全流程可通关', async ({ page }) => {
  const failedRequests: string[] = [];
  page.on('requestfailed', (req) => failedRequests.push(req.url()));

  await page.goto('/');
  await expect(page.getByTestId('hall')).toBeVisible();

  // 外壳首屏不应该加载 Phaser：游戏 chunk 只有在进入游戏后才出现
  const shellScripts = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((entry) => entry.name.endsWith('.js'))
      .map((entry) => entry.name.split('/').pop() ?? ''),
  );
  expect(shellScripts.length).toBeGreaterThan(0);

  await page.goto('/?autoplay=1#/play/caochong-elephant');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
  await expect(page.getByTestId('collected-count')).toHaveText('1');

  expect(failedRequests).toEqual([]);
});
