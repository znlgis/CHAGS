import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.test.ts', 'games/**/src/**/*.test.ts'],
    environment: 'node',
  },
});
