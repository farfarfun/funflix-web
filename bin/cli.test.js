// 配置优先级必须是 CLI 参数 > 环境变量 > 配置文件 > 代码默认值（组织规范 §9.3）。
// resolveOpts() 只负责前三档，代码默认值留给 server 层兜底（见 server/lifecycle.js、server/app.js）。
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveOpts } from './cli.js'

describe('resolveOpts 的 backend 优先级', () => {
  let dir
  let configPath
  const ENV_KEY = 'FUNFLIX_API_BASE_URL'
  const XDG_KEY = 'XDG_CONFIG_HOME'
  const originalEnv = process.env[ENV_KEY]
  const originalXdg = process.env[XDG_KEY]

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'funflix-web-cli-'))
    configPath = path.join(dir, 'config.json')
    writeFileSync(configPath, JSON.stringify({ backend: 'http://from-file' }))
    // 隔离默认配置路径（defaultConfigPath() 基于 XDG_CONFIG_HOME），避免
    // 测试机上真实存在的 ~/.config/farfarfun/funflix-web/config.toml 干扰断言。
    process.env[XDG_KEY] = dir
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    if (originalEnv === undefined) delete process.env[ENV_KEY]
    else process.env[ENV_KEY] = originalEnv
    if (originalXdg === undefined) delete process.env[XDG_KEY]
    else process.env[XDG_KEY] = originalXdg
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
    // config 缺省时走 defaultConfigPath()，explicit=false，缺文件不报错、只返回 {}。
    const opts = resolveOpts({})
    expect(opts.backendBaseUrl).toBeUndefined()
  })
})
