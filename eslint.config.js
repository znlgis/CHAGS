import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      // 打包产物与第三方工程：不是我们的代码，lint 它们没有意义
      // （Tauri 的 target/ 里嵌入了压缩后的前端产物，会让 eslint 报几千条）
      'apps/desktop/src-tauri/target/**',
      'apps/desktop/src-tauri/gen/**',
      'apps/mobile/android/**',
      'apps/mobile/resources/**',
      'release/**',
      '.scratch/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    // Node 侧脚本（没有类型兜底）：no-undef 在这里仍然有效，所以要把用到的
    // Node 全局变量显式声明出来（不引 globals 包，保持依赖零增长）
    files: ['scripts/**/*.mjs', '*.config.js', '*.config.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        queueMicrotask: 'readonly',
        structuredClone: 'readonly',
      },
    },
  },
  {
    // TypeScript 已经负责未定义变量检查（只对 TS/Vue 关：
    // scripts/*.mjs 与配置文件没有类型兜底，no-undef 在那里仍然有效）
    files: ['**/*.{ts,vue}'],
    rules: {
      'no-undef': 'off',
      'vue/multi-word-component-names': 'off',
      // 纯排版规则，交给编辑器/Prettier，不进 lint 门禁
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
    },
  },
  {
    // 外壳只能吃"摘要"：完整内容（故事 / 复习题 / 关卡脚本，约 45 KB gzip）
    // 必须走 loadEntry() 的动态 import，否则首屏会重新变大（见 docs/技术方案.md §7.13）。
    // 这条规则是那次瘦身唯一的长期守卫 —— 一句 import 就能把它作废，而体积门禁只在打包后才发现。
    files: ['apps/site/src/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@chags/content/full',
              message: '外壳不许直接引入完整内容：用 @chags/content 的 loadEntry()（动态 import）。',
            },
          ],
        },
      ],
    },
  },
  {
    // 纯逻辑层必须可控、可复现：禁止随机与隐式时钟。
    // 注意：纯逻辑文件叫 *.logic.ts（仓库里没有 logic/ 目录）——
    // 这条 glob 以前写成 '**/logic/**/*.ts'，等于从来没生效过。
    files: ['packages/progress/src/**/*.ts', '**/*.logic.ts', '**/logic/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: '纯逻辑层禁止 Math.random，请注入种子随机数，保证测试可复现。' },
        { object: 'Date', property: 'now', message: '纯逻辑层禁止 Date.now，请通过参数注入 now()。' },
      ],
    },
  },
);
