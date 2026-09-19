// ESLint flat config：Vue 3 + TypeScript（前端）与仓库内的 server/*.js、bin/cli.js（Node，ESM）。
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import vueTsEslintConfig from '@vue/eslint-config-typescript'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'components.d.ts'],
  },
  js.configs.recommended,
  // 只用 essential（抓真实 bug 的规则），不用 recommended/strongly-recommended——
  // 那两档大量是模板属性换行、缩进这类纯格式规则，对既有代码跑一次 --fix
  // 会产生跟这次审计无关的大范围重排版，不值得为了满足「有 lint 脚本」这条
  // 顺带把全部模板格式重写一遍。
  ...pluginVue.configs['flat/essential'],
  ...vueTsEslintConfig(),
  {
    files: ['server/**/*.js', 'bin/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['**/*.test.{js,ts}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    rules: {
      // 组件/视图偶尔需要单文件多个具名导出（composable + 组件），不强制单一默认导出。
      'vue/multi-word-component-names': 'off',
    },
  },
]
