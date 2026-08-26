import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import { defineConfig } from 'vite'

// 后端固定监听 8810，开发态的代理必须指向同一个端口。
const BACKEND = 'http://127.0.0.1:8810'

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
    // 直接产出到 Python 包内，`funflix-web serve` 起来就能托管，中间不需要拷贝步骤
    outDir: '../src/funflix_web/static',
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
