import { defineConfig } from '@playwright/test';
import { baseline, devBaseURL, devServer } from './e2e/playwright.shared';

/**
 * 文档截图：**不是测试**，不进回归集（零断言，跑一次要两分多钟）。
 * 它把 17 部典故 + 三十六计的画面截到 docs/screenshots/，供 README 与文档引用。
 *
 *   pnpm shots            # 全部重拍
 *   pnpm shots -g nuwa    # 只拍女娲那几条
 */
export default defineConfig({
  ...baseline,
  testMatch: 'screenshots.spec.ts',
  // 手动重拍截图：失败就停下来看，重试只会白等
  retries: 0,
  timeout: 120_000,
  use: { ...baseline.use, baseURL: devBaseURL },
  webServer: devServer,
});
