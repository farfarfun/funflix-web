// 反向代理到 funflix-api 后端（`funflix-api start`）。只用内置 http/https，不加第三方依赖。
// 存在的理由：funflix-api 自身没有 CORS 中间件，前端独立部署后必须走同源，
// 由这一层把 /api、/healthz 转发到真实后端，浏览器眼里全程只有一个源。
import http from 'node:http'
import https from 'node:https'
import { redactUrl } from './url.js'

/**
 * 创建将请求转发至 funflix-api 的处理函数。
 *
 * @param {string} backendBaseUrl 后端服务的 HTTP(S) 基础地址。
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void} 请求处理函数；后端连接失败时返回 502。
 */
export function createProxyHandler(backendBaseUrl) {
  const backend = new URL(backendBaseUrl)
  const transport = backend.protocol === 'https:' ? https : http

  return function handleProxy(req, res) {
    const headers = { ...req.headers, host: backend.host }

    const proxyReq = transport.request(
      {
        protocol: backend.protocol,
        hostname: backend.hostname,
        port: backend.port || (backend.protocol === 'https:' ? 443 : 80),
        method: req.method,
        path: req.url,
        headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
        proxyRes.pipe(res)
      },
    )

    proxyReq.on('error', (err) => {
      if (res.headersSent) {
        res.destroy()
        return
      }
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(`Bad Gateway: 无法连接后端 ${redactUrl(backendBaseUrl)}`)
    })

    req.pipe(proxyReq)
  }
}
