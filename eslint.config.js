import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/playwright-report/**', '**/test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    // TypeScript 已经负责未定义变量检查
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
    // 纯逻辑层必须可控、可复现：禁止随机与隐式时钟
    files: ['packages/progress/src/**/*.ts', '**/logic/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: '纯逻辑层禁止 Math.random，请注入种子随机数，保证测试可复现。' },
        { object: 'Date', property: 'now', message: '纯逻辑层禁止 Date.now，请通过参数注入 now()。' },
      ],
    },
  },
);
