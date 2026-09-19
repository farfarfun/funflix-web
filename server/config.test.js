import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultConfigPath, loadConfig } from './config.js'

describe('defaultConfigPath', () => {
  it('落在 XDG_CONFIG_HOME（未设置时回退 ~/.config）下的 farfarfun/funflix-web/config.toml', () => {
    const p = defaultConfigPath()
    expect(p.endsWith(path.join('farfarfun', 'funflix-web', 'config.toml'))).toBe(true)
  })
})

describe('loadConfig', () => {
  let dir

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'funflix-web-config-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('默认路径缺文件时返回空对象，不报错', () => {
    expect(loadConfig(path.join(dir, 'missing.toml'), false)).toEqual({})
  })

  it('显式传 --config 但文件不存在时抛错', () => {
    expect(() => loadConfig(path.join(dir, 'missing.toml'), true)).toThrow('配置文件不存在')
  })

  it('解析 .json 配置文件的四个已知字段', () => {
    const file = path.join(dir, 'config.json')
    writeFileSync(file, JSON.stringify({ host: '0.0.0.0', port: 9000, backend: 'http://x', static_dir: '/d' }))
    expect(loadConfig(file, true)).toEqual({ host: '0.0.0.0', port: 9000, backend: 'http://x', staticDir: '/d' })
  })

  it('解析 .toml 配置文件，忽略 [section] 与注释行', () => {
    const file = path.join(dir, 'config.toml')
    writeFileSync(
      file,
      ['[server]', '# 注释', 'host = "127.0.0.1"', 'port = 8811', 'backend = "http://y"'].join('\n'),
    )
    expect(loadConfig(file, true)).toEqual({ host: '127.0.0.1', port: 8811, backend: 'http://y' })
  })

  it('解析 .env 配置文件里的 FUNFLIX_API_BASE_URL 等既有环境变量命名', () => {
    const file = path.join(dir, 'config.env')
    writeFileSync(file, ['FUNFLIX_WEB_HOST=127.0.0.1', 'FUNFLIX_API_BASE_URL=http://z'].join('\n'))
    expect(loadConfig(file, true)).toEqual({ host: '127.0.0.1', backend: 'http://z' })
  })

  it('不支持的扩展名抛错', () => {
    const file = path.join(dir, 'config.yaml')
    writeFileSync(file, 'host: 127.0.0.1')
    expect(() => loadConfig(file, true)).toThrow('不支持的配置文件类型')
  })
})
