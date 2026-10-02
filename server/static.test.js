// 覆盖静态文件服务的核心安全与回退规则（组织规范 §12.3）：
// - 未构建时返回明确的 503 提示，不是没头没脑的 404
// - assets/** 未命中直接 404，不回退 index.html
// - 其余路径回退 index.html，交给前端路由（SPA）
// - 路径穿越（`..`）不能逃出 staticDir，哪怕请求行里直接带着未归一化的 `..`
import { createServer } from 'node:http'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createStaticHandler } from './static.js'

let dir
let server
let port

// 直接用 node:http 的底层 client 发请求：它不会像 WHATWG URL / fetch 那样
// 预先把 `..` 归一化掉，`path` 字段会原样写进请求行——这正是要测的攻击面。
function rawRequest(reqPath) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: reqPath, method: 'GET' }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') })
      })
    })
    req.on('error', reject)
    req.end()
  })
}

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'funflix-web-static-'))
})

afterEach(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve))
    server = undefined
  }
  rmSync(dir, { recursive: true, force: true })
})

function start(staticDir) {
  return new Promise((resolve) => {
    server = createServer(createStaticHandler(staticDir, '/web'))
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port
      resolve()
    })
  })
}

describe('createStaticHandler', () => {
  it('dist/ 缺失（没有 index.html）时返回 503 与构建提示，而不是 404', async () => {
    await start(dir)
    const res = await rawRequest('/web/')
    expect(res.status).toBe(503)
    expect(res.body).toContain('pnpm install && pnpm build')
  })

  it('assets/** 命中真实文件时返回 200 与 immutable 缓存', async () => {
    mkdirSync(path.join(dir, 'assets'))
    writeFileSync(path.join(dir, 'index.html'), '<html>ok</html>')
    writeFileSync(path.join(dir, 'assets', 'app.abc123.js'), 'console.log(1)')
    await start(dir)
    const res = await rawRequest('/web/assets/app.abc123.js')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable')
  })

  it('assets/** 未命中直接 404，不回退 index.html', async () => {
    mkdirSync(path.join(dir, 'assets'))
    writeFileSync(path.join(dir, 'index.html'), '<html>ok</html>')
    await start(dir)
    const res = await rawRequest('/web/assets/missing.js')
    expect(res.status).toBe(404)
  })

  it('非 assets 的未命中路径回退到 index.html（SPA 路由）', async () => {
    writeFileSync(path.join(dir, 'index.html'), '<html>spa</html>')
    await start(dir)
    const res = await rawRequest('/web/media/some-id')
    expect(res.status).toBe(200)
    expect(res.body).toBe('<html>spa</html>')
    expect(res.headers['cache-control']).toBe('no-cache')
  })

  it('带文件扩展名的未命中路径（如 favicon.ico）直接 404，不回退 index.html', async () => {
    writeFileSync(path.join(dir, 'index.html'), '<html>spa</html>')
    await start(dir)
    const res = await rawRequest('/web/favicon.ico')
    expect(res.status).toBe(404)
  })

  it('路径穿越：请求行里直接带未归一化的 .. 也不能读到 staticDir 外的文件', async () => {
    writeFileSync(path.join(dir, 'index.html'), '<html>spa</html>')
    // 在 staticDir 的父目录放一个「秘密文件」，staticDir 内部完全不该能读到它。
    const secretPath = path.join(dir, '..', `secret-${path.basename(dir)}.txt`)
    writeFileSync(secretPath, 'TOP-SECRET')
    try {
      await start(dir)
      const res = await rawRequest(`/web/../secret-${path.basename(dir)}.txt`)
      expect(res.body).not.toContain('TOP-SECRET')
      // 带扩展名的路径逃逸失败后按规则直接 404，不会泄露任何内容。
      expect(res.status).toBe(404)
    } finally {
      rmSync(secretPath, { force: true })
    }
  })
})
