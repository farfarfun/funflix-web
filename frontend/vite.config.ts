import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import { defineConfig } from 'vite'

// 后端是 funflix 自己的 `funflix server start`（约定端口 18810），
// 不再经由 funflix-web 转发。生产态由 funflix-web 这个 npm 包内置的反代
// （见 server/proxy.js）接管，环境变量同名，本地联调时两边指向同一个值。
const BACKEND = process.env.FUNFLIX_API_BASE_URL || 'http://127.0.0.1:18810'

export default defineConfig({
  plugins: [
    vue(),
    // 按需解析模板里用到的 n-* 组件。全量 `app.use(naive)` 会把整个组件库
    // 打进主包（1.4MB），而这个应用只用到其中十几个组件。
    Components({ resolvers: [NaiveUiResolver()], dts: 'components.d.ts' }),
  ],

  // 生产下前端挂在 /web 下，所有资源引用都要带这个前缀，
  // 否则 /web/media/1 这类深链会去 / 根下找 assets 而 404。
  base: '/web/',

  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },

  build: {
    // 默认 dist/，随 npm 包一起发布；`funflix-web` 的 server 模块直接从包内读取。
    emptyOutDir: true,
  },

  server: {
    port: 5173,
    // 开发态用 vite 的 HMR，接口转发给真实后端，避免跨域
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/healthz': { target: BACKEND, changeOrigin: true },
    },
  },
})
