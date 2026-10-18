import { defineConfig } from '@playwright/test';
import { baseline, retries } from './e2e/playwright.shared';

/**
 * 跑真实产物：验证生产构建下的代码分割与懒加载是否正常。
 *
 * build **不在 webServer 里做**：release/CI 跑的 e2e:dist 脚本已经 build 过了，
 * 塞进 webServer 等于每次起服务都重复构建一遍（还会把构建失败的报错混进 Playwright 超时里）。
 * 需要重新构建时用 `pnpm e2e:dist`（= pnpm build && playwright test --config 本文件）。
 */
export default defineConfig({
  ...baseline,
  testMatch: 'preview.spec.ts',
  timeout: 90_000,
  retries,
  use: { ...baseline.use, baseURL: 'http://127.0.0.1:5199' },
  webServer: {
    command: 'pnpm --filter @chags/site exec vite preview --port 5199 --strictPort',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
