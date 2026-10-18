import { defineConfig } from '@playwright/test';
import { baseline, devBaseURL, devServer, retries } from './e2e/playwright.shared';

export default defineConfig({
  ...baseline,
  // preview.spec.ts 必须跑真实产物（playwright.preview.config.ts）
  // audit.spec.ts 是双语版面巡检（playwright.audit.config.ts）
  // screenshots.spec.ts 只是"拍文档截图"（playwright.shots.config.ts，pnpm shots），
  // 它零断言、有 140 处固定等待，混在回归集里只会让 CI 白跑几分钟
  testIgnore: ['preview.spec.ts', 'audit.spec.ts', 'screenshots.spec.ts'],
  timeout: 90_000,
  // 本地不重试（失败要立刻看见），CI 上给两次机会
  retries,
  use: { ...baseline.use, baseURL: devBaseURL },
  webServer: devServer,
});
