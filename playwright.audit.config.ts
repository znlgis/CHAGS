import { defineConfig } from '@playwright/test';
import { baseline, devBaseURL, devServer } from './e2e/playwright.shared';

/** 只跑双语版面巡检，产物写到 .scratch/i18n-audit/（不入库） */
export default defineConfig({
  ...baseline,
  testMatch: 'audit.spec.ts',
  // 巡检是截图给人看的：重试只会拖长时间，失败就该停下来看
  retries: 0,
  timeout: 180_000,
  use: { ...baseline.use, baseURL: devBaseURL },
  webServer: devServer,
});
