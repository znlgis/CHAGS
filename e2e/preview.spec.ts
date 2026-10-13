import { expect, test } from '@playwright/test';
import { events } from './helpers';

const isJs = (url: string): boolean => {
  try {
    return new URL(url).pathname.endsWith('.js');
  } catch {
    return false;
  }
};

test('生产构建产物：游戏 chunk 懒加载 + 全流程可通关', async ({ page }) => {
  const failedRequests: string[] = [];
  const jsRequests: string[] = [];
  page.on('requestfailed', (req) => failedRequests.push(req.url()));
  page.on('request', (req) => {
    if (isJs(req.url())) jsRequests.push(req.url());
  });

  await page.goto('/');
  await expect(page.getByTestId('hall')).toBeVisible();
  const shellScripts = jsRequests.length;
  expect(shellScripts).toBeGreaterThan(0);
  // 首屏只加载外壳，不能把 Phaser 拉进来
  expect(shellScripts).toBeLessThan(5);

  await page.goto('/?autoplay=1#/play/caochong-elephant');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
  await expect(page.getByTestId('collected-count')).toHaveText('1');

  // 进入游戏后才新增游戏 chunk 请求（Phaser 都在这些 chunk 里）
  expect(jsRequests.length).toBeGreaterThan(shellScripts);
  expect(failedRequests).toEqual([]);
});
