import { defineConfig, devices } from '@playwright/test';

/**
 * 文档截图：**不是测试**，不进回归集（零断言，跑一次要两分多钟）。
 * 它把 17 部典故 + 三十六计的画面截到 docs/screenshots/，供 README 与文档引用。
 *
 *   pnpm shots            # 全部重拍
 *   pnpm shots -g nuwa    # 只拍女娲那几条
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'screenshots.spec.ts',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5183' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --filter @chags/site exec vite',
    url: 'http://127.0.0.1:5183',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
