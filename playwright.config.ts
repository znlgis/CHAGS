import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // preview.spec.ts 必须跑真实产物（playwright.preview.config.ts）
  // audit.spec.ts 是双语版面巡检（playwright.audit.config.ts）
  // screenshots.spec.ts 只是"拍文档截图"（playwright.shots.config.ts，pnpm shots），
  // 它零断言、有 140 处固定等待，混在回归集里只会让 CI 白跑几分钟
  testIgnore: ['preview.spec.ts', 'audit.spec.ts', 'screenshots.spec.ts'],
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  // 本地不重试（失败要立刻看见），CI 上给两次机会：单核机器上偶发的计时抖动
  // 不该把一次真实回归连同两次假红一起埋掉
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  // 失败时留下截图与轨迹：CI 上挂了才有东西可查（此前只传一个根本不存在的 playwright-report）
  use: {
    baseURL: 'http://127.0.0.1:5183',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --filter @chags/site exec vite',
    url: 'http://127.0.0.1:5183',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
