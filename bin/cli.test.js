// 配置优先级必须是 CLI 参数 > 环境变量 > 配置文件 > 代码默认值（组织规范 §9.3）。
// resolveOpts() 只负责前三档，代码默认值留给 server 层兜底（见 server/lifecycle.js、server/app.js）。
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveOpts } from './cli.js'

const CLI_PATH = fileURLToPath(new URL('./cli.js', import.meta.url))

// pnpm/npm -g 装出来的 bin 是一条软链，node 以 realpath 算 import.meta.url，
// argv[1] 却还是软链路径。「是否直接执行」那层判断若直接比字符串，软链下永远
// 不相等：main() 不跑、CLI 静默退出 0，setup.sh 看着「启动成功」但端口从不监听。
describe('经软链调用时仍然执行 CLI 逻辑', () => {
  let dir

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'funflix-web-shim-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('软链路径跑 --help 会打印用法而不是静默退出', () => {
    const link = path.join(dir, 'funflix-web-link.js')
    symlinkSync(CLI_PATH, link)

    const result = spawnSync(process.execPath, [link, '--help'], { encoding: 'utf8' })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('用法：funflix-web')
  })

  it('被 import 时不执行 CLI 逻辑', async () => {
    const probe = path.join(dir, 'probe.mjs')
    writeFileSync(probe, `await import(${JSON.stringify(CLI_PATH)})\nconsole.log('IMPORT_OK')\n`)

    const result = spawnSync(process.execPath, [probe], { encoding: 'utf8' })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('IMPORT_OK')
    expect(result.stdout).not.toContain('用法：funflix-web')
  })
})

describe('resolveOpts 的 backend 优先级', () => {
  let dir
  let configPath
  const ENV_KEY = 'FUNFLIX_API_BASE_URL'
  const originalEnv = process.env[ENV_KEY]

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'funflix-web-cli-'))
    configPath = path.join(dir, 'config.json')
    writeFileSync(configPath, JSON.stringify({ backend: 'http://from-file' }))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    if (originalEnv === undefined) delete process.env[ENV_KEY]
    else process.env[ENV_KEY] = originalEnv
  })

  it('CLI flag 优先于环境变量与配置文件', () => {
    process.env[ENV_KEY] = 'http://from-env'
    const opts = resolveOpts({ config: configPath, backendBaseUrl: 'http://from-cli' })
    expect(opts.backendBaseUrl).toBe('http://from-cli')
  })

  it('没有 CLI flag 时环境变量优先于配置文件', () => {
    process.env[ENV_KEY] = 'http://from-env'
    const opts = resolveOpts({ config: configPath })
    expect(opts.backendBaseUrl).toBe('http://from-env')
  })

  it('没有 CLI flag 与环境变量时落到配置文件', () => {
    delete process.env[ENV_KEY]
    const opts = resolveOpts({ config: configPath })
    expect(opts.backendBaseUrl).toBe('http://from-file')
  })

  it('三者都没有时返回 undefined，交给下游代码默认值兜底', () => {
    delete process.env[ENV_KEY]
    writeFileSync(configPath, '{}')
    const opts = resolveOpts({ config: configPath })
    expect(opts.backendBaseUrl).toBeUndefined()
  })
})
