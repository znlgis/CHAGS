import { devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';

/**
 * 四份 Playwright 配置的共同基线。
 *
 * 以前 config / preview / shots / audit 各抄一份 testDir、workers、reporter、projects，
 * 结果漂移得很厉害：shots 与 audit **完全没有截图与轨迹**（出事最难查的就是它们），
 * audit 的 expect.timeout 漏了（只剩默认 5 秒），shots 的 retries 也漏了。
 * 证据策略、超时、单核节奏只在这里改一次。
 *
 * 差异（testMatch / timeout / retries / baseURL / webServer）留在各自的配置文件里，
 * 那些是"这份配置为什么存在"本身。
 */

/** CI 上给两次机会：单核机器上偶发的计时抖动，不该把一次真实回归埋掉 */
export const retries = process.env.CI ? 2 : 0;

/** 开发服务器：四份配置里有三份跑的是同一条 vite dev server */
export const devServer = {
  command: 'pnpm --filter @chags/site exec vite',
  url: 'http://127.0.0.1:5183',
  reuseExistingServer: true,
  timeout: 120_000,
} as const;

export const devBaseURL = 'http://127.0.0.1:5183';

/**
 * 基线本身。
 *
 * 注意 testDir 的相对路径按**入口配置文件的目录**解析 —— 四份配置都在仓库根，
 * 所以这里写 './e2e' 就够（被 import 时不会按本文件位置再解析一次）。
 */
export const baseline = {
  testDir: './e2e',
  // 每条用例自己开 page/context；实测 2 个 worker 反而会放大长按/时序类断言的不稳定，
  // 先保持 1，等有专门的并行稳定性数据再往上加
  fullyParallel: false,
  workers: 1,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  // 失败时留下截图与轨迹：CI 上挂了才有东西可查
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
} satisfies PlaywrightTestConfig;
