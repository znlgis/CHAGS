import { expect, test } from '@playwright/test';
import { events } from './helpers';

/** 游戏包自己的 chunk：外壳入口是 index-*.js，游戏/模块是 src-*.js */
const isGameChunk = (url: string): boolean => /\/assets\/src-[^/]+\.js$/.test(new URL(url).pathname);

/**
 * 生产构建产物：游戏 chunk 懒加载 + 全流程可通关。
 *
 * 断言按 chunk 的**归属**写，不数条数：条数会随打包策略变化，
 * 而"进游戏之前不许出现游戏 chunk"这件事与策略无关。
 */
test('生产构建产物：游戏 chunk 懒加载 + 全流程可通关', async ({ page }) => {
  const failedRequests: string[] = [];
  const gameChunks: string[] = [];
  page.on('requestfailed', (req) => {
    // net::ERR_ABORTED 是"页面又导航了，在途请求被取消"，不是加载失败
    if (req.failure()?.errorText === 'net::ERR_ABORTED') return;
    failedRequests.push(req.url() + ' → ' + (req.failure()?.errorText ?? ''));
  });
  page.on('request', (req) => {
    if (isGameChunk(req.url())) gameChunks.push(req.url());
  });

  await page.goto('/');
  await expect(page.getByTestId('hall')).toBeVisible();
  // 首屏只有外壳：Phaser 与任何游戏 chunk 都不许在这一步出现
  expect(gameChunks, '首屏不该加载游戏 chunk').toEqual([]);

  await page.goto('/?autoplay=1#/play/caochong-elephant');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
  await expect(page.getByTestId('collected-count')).toHaveText('1');

  // 进入游戏之后才新增游戏 chunk（Phaser 都在这些 chunk 里）
  expect(gameChunks.length, '进入游戏后应加载游戏 chunk').toBeGreaterThan(0);
  expect(failedRequests).toEqual([]);
});
