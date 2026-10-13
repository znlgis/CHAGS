import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // apps 下的纯逻辑测试也要跑 —— 例如典故注册表与内容目录的一致性
    include: [
      'packages/**/src/**/*.test.ts',
      'games/**/src/**/*.test.ts',
      'apps/**/src/**/*.test.ts',
    ],
    environment: 'node',
  },
});
