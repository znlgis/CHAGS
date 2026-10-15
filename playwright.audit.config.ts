import { defineConfig, devices } from '@playwright/test';

/** 只跑双语版面巡检，产物写到 .scratch/i18n-audit/（不入库） */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'audit.spec.ts',
  // 巡检是截图给人看的：重试只会拖长时间，失败就该停下来看
  retries: 0,
  timeout: 180_000,
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
