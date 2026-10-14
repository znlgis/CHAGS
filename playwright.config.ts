import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // preview.spec.ts 必须跑真实产物（playwright.preview.config.ts）
  // audit.spec.ts 是双语版面巡检（playwright.audit.config.ts），默认不跑
  testIgnore: ['preview.spec.ts', 'audit.spec.ts'],
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
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
