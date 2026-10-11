// 请求路由，对应原 Python 包 `funflix_web/app.py` 的路由表：
//   /            → 302 重定向到 /web/
//   /api/**, /healthz → 反代到后端
//   /web/**      → 静态文件 + SPA 回退
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStaticHandler } from './static.js'
import { createProxyHandler } from './proxy.js'
import { redactUrl } from './url.js'

const WEB_PREFIX = '/web'

const DEFAULT_STATIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')

/**
 * 创建 funflix-web 的 HTTP 服务。
 *
 * @param {{ staticDir?: string, backendBaseUrl?: string }} opts 静态资源目录和后端基础地址。
 * @returns {import('node:http').Server} 尚未开始监听的 HTTP 服务实例。
 */
export function createServer(opts = {}) {
  const staticDir = opts.staticDir ?? DEFAULT_STATIC_DIR
  const backendBaseUrl = opts.backendBaseUrl ?? 'http://127.0.0.1:18810'

  const staticHandler = createStaticHandler(staticDir, WEB_PREFIX)
  const proxyHandler = createProxyHandler(backendBaseUrl)

  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://internal')

    if (url.pathname === '/') {
      res.writeHead(302, { Location: `${WEB_PREFIX}/` })
      res.end()
      return
    }

    if (url.pathname.startsWith('/api') || url.pathname === '/healthz') {
      proxyHandler(req, res)
      return
    }

    if (url.pathname.startsWith(WEB_PREFIX)) {
      staticHandler(req, res)
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not Found')
  })
}

/**
 * 创建并开始监听 funflix-web 服务。
 *
 * @param {{ host?: string, port?: number, staticDir?: string, backendBaseUrl?: string }} opts 监听与服务配置。
 * @returns {Promise<import('node:http').Server>} 监听成功后兑现服务实例；监听失败时拒绝。
 */
export function runServe(opts = {}) {
  const host = opts.host ?? '127.0.0.1'
  const port = opts.port ?? 8810
  const backendBaseUrl = opts.backendBaseUrl ?? 'http://127.0.0.1:18810'

  return new Promise((resolve, reject) => {
    const server = createServer({ staticDir: opts.staticDir, backendBaseUrl })
    server.on('error', reject)
    server.listen(port, host, () => {
      console.log(`funflix-web 已启动：http://${host}:${port}${WEB_PREFIX}`)
      console.log(`后端：${redactUrl(backendBaseUrl)}`)
      resolve(server)
    })
  })
}
