import { defineConfig, devices } from '@playwright/test';

/** 跑真实产物：先 build 再 preview，验证生产构建下的代码分割与懒加载是否正常 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'preview.spec.ts',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  // 产物链路挂了同样要留下证据（以前这份配置什么都没留）
  use: {
    baseURL: 'http://127.0.0.1:5199',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm build && pnpm --filter @chags/site exec vite preview --port 5199 --strictPort',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
