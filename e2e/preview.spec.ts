import { expect, test } from '@playwright/test';
import { events } from './helpers';

/**
 * "重" chunk：游戏包（game-*）、按条目切的内容（content-*）与 Phaser（vendor-phaser-*）。
 * 外壳入口是 index-*.js，共享代码是 src-*.js —— 这些首屏可以有，重 chunk 不行。
 */
const isHeavyChunk = (url: string): boolean =>
  /\/assets\/(?:game-|content-|vendor-phaser-)[^/]+\.js$/.test(new URL(url).pathname);

/**
 * 生产构建产物：重 chunk 懒加载 + 全流程可通关。
 *
 * 断言按 chunk 的**归属**写，不数条数：条数会随打包策略变化，
 * 而"进游戏之前不许出现游戏 chunk / Phaser / 内容 chunk"这件事与策略无关。
 */
test('生产构建产物：重 chunk 懒加载 + 全流程可通关', async ({ page }) => {
  const failedRequests: string[] = [];
  const heavyChunks: string[] = [];
  page.on('requestfailed', (req) => {
    // net::ERR_ABORTED 是"页面又导航了，在途请求被取消"，不是加载失败
    if (req.failure()?.errorText === 'net::ERR_ABORTED') return;
    failedRequests.push(req.url() + ' → ' + (req.failure()?.errorText ?? ''));
  });
  page.on('request', (req) => {
    if (isHeavyChunk(req.url())) heavyChunks.push(req.url());
  });

  await page.goto('/');
  await expect(page.getByTestId('hall')).toBeVisible();
  // 首屏只有外壳：Phaser / 游戏 / 内容 chunk 都不许在这一步出现
  expect(heavyChunks, '首屏不该加载重 chunk').toEqual([]);

  await page.goto('/?autoplay=1#/play/caochong-elephant');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
  await expect(page.getByTestId('collected-count')).toHaveText('1');

  // 进入游戏之后才新增重 chunk（Phaser / 本次内容 / 游戏包）
  expect(heavyChunks.length, '进入游戏后应加载重 chunk').toBeGreaterThan(0);
  const names = heavyChunks.map((url) => new URL(url).pathname);
  expect(names.some((path) => /vendor-phaser-/.test(path)), '应当加载 Phaser').toBe(true);
  expect(
    names.some((path) => /content-caochong-elephant-[^/]+\.js$/.test(path)),
    '应当只加载本局的内容 chunk',
  ).toBe(true);
  expect(
    names.some((path) => /content-pangu-[^/]+\.js$/.test(path)),
    '不该下载别的条目的内容',
  ).toBe(false);
  expect(failedRequests).toEqual([]);
});
