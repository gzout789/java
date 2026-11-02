import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'

export default [
  // 全局忽略（不检查构建产物与依赖）
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-ssr/**',
      '*.local',
      'login-standalone.html',
      'game-smoke.mjs',
    ],
  },

  // 基础 JS 规则
  js.configs.recommended,

  // Vue 官方推荐规则（flat 版）
  ...pluginVue.configs['flat/recommended'],

  // 关闭与 Prettier 冲突的格式规则
  prettier,

  // 项目级宽松覆盖：老代码不追求 0 警告，先控制住硬错误
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        performance: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        AbortController: 'readonly',
        ResizeObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        location: 'readonly',
        history: 'readonly',
        Image: 'readonly',
        Audio: 'readonly',
        FileReader: 'readonly',
        Blob: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        Promise: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        WeakMap: 'readonly',
        Symbol: 'readonly',
        structuredClone: 'readonly',
        crypto: 'readonly',
      },
    },
    rules: {
      // 老代码容忍：未使用变量仅警告，不阻断
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // ESLint 10 新增的激进规则，对「let x=默认值 后 if/else 全覆盖」误报，降为警告
      'no-useless-assignment': 'warn',
      'no-console': 'off',
      'no-debugger': 'warn',
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/require-default-prop': 'off',
      'vue/attributes-order': 'off',
      'vue/no-v-html': 'off',
    },
  },
]
