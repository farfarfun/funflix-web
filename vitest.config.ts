import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// 独立于 vite.config.ts：测试只跑纯逻辑（server/*.js、src/utils 等），
// 不需要 vite.config.ts 里那些跟构建/开发服务器相关的插件与代理配置，
// 但要沿用同一份 `@` 别名，否则 src 下的模块互相 import 会解析不到。
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.js', 'bin/**/*.test.js'],
  },
})
