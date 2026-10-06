// 覆盖反向代理层：正常转发，以及后端不可达时的 502 错误路径
// （组织规范 §8.2：故障要带上下文，不能是一个没头没脑的失败）。
import { createServer } from 'node:http'
import { request as httpRequest } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'

import { createProxyHandler } from './proxy.js'

let frontend
let backend

afterEach(async () => {
  if (frontend) await new Promise((resolve) => frontend.close(resolve))
  if (backend) await new Promise((resolve) => backend.close(resolve))
  frontend = undefined
  backend = undefined
})

function rawRequest(port, reqPath) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: reqPath, method: 'GET' }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    req.end()
  })
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

describe('createProxyHandler', () => {
  it('正常把请求转发到后端并透传响应体与状态码', async () => {
    backend = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ path: req.url }))
    })
    const backendPort = await listen(backend)

    frontend = createServer(createProxyHandler(`http://127.0.0.1:${backendPort}`))
    const frontendPort = await listen(frontend)

    const res = await rawRequest(frontendPort, '/api/v1/media')
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ path: '/api/v1/media' })
  })

  it('后端不可达时返回 502，且不会回显连接凭据或查询参数', async () => {
    // 先监听再立刻关闭，拿到一个本机大概率没人用、连接必失败的端口。
    const probe = createServer()
    const deadPort = await listen(probe)
    await new Promise((resolve) => probe.close(resolve))

    frontend = createServer(createProxyHandler(`http://user:secret@127.0.0.1:${deadPort}?token=private`))
    const frontendPort = await listen(frontend)

    const res = await rawRequest(frontendPort, '/healthz')
    expect(res.status).toBe(502)
    expect(res.body).toContain(String(deadPort))
    expect(res.body).not.toContain('user')
    expect(res.body).not.toContain('secret')
    expect(res.body).not.toContain('token')
    expect(res.body).not.toContain('private')
  })
})
