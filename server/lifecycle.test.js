// 覆盖 start/stop/status 的生命周期判定逻辑（组织规范 §6.1）：
// 重复启动必须拒绝、陈旧 PID 文件要能和真的活着的进程区分开、
// status() 的三态要对、stop() 的空闲路径与真实优雅停止都要验证到。
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { start, status, stop } from './lifecycle.js'

const STATE_DIR_KEY = 'FUNFLIX_WEB_STATE_DIR'
let dir
let originalStateDir
let child

function pidFile() {
  return path.join(dir, 'funflix-web.pid')
}
function metaFile() {
  return path.join(dir, 'funflix-web.meta.json')
}

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'funflix-web-lifecycle-'))
  originalStateDir = process.env[STATE_DIR_KEY]
  process.env[STATE_DIR_KEY] = dir
})

afterEach(async () => {
  if (child) {
    try {
      process.kill(child.pid, 'SIGKILL')
    } catch {
      // 已经退出，忽略
    }
    child = undefined
  }
  if (originalStateDir === undefined) delete process.env[STATE_DIR_KEY]
  else process.env[STATE_DIR_KEY] = originalStateDir
  rmSync(dir, { recursive: true, force: true })
})

describe('start() 的重复启动与陈旧 PID 判定', () => {
  it('PID 文件指向真的存活的进程时拒绝重复启动', async () => {
    // 用测试进程自身的 PID 模拟「还在运行」：kill(pid, 0) 对自己必然成功。
    writeFileSync(pidFile(), String(process.pid))
    await expect(start({ staticDir: dir })).rejects.toThrow('已在运行')
  })

  it('陈旧 PID 文件（进程已不在）会被清理，随后按正常流程继续（这里卡在 dist 未构建)', async () => {
    // 2^31-1：Linux pid_max 远小于此，基本不可能撞上真实存活的进程。
    writeFileSync(pidFile(), '2147483647')
    await expect(start({ staticDir: dir })).rejects.toThrow('pnpm install && pnpm build')
    // 陈旧 PID 已被清掉，不会一直挡着后续的 start。
    expect(existsSync(pidFile())).toBe(false)
  })
})

describe('stop()', () => {
  it('没有在运行时返回 stopped:false，而不是报错', async () => {
    const result = await stop()
    expect(result).toEqual({ stopped: false, message: '未在运行' })
  })

  it('对真实进程发 SIGTERM 并等到它退出才算停止成功', async () => {
    child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
    await new Promise((resolve) => child.once('spawn', resolve))
    writeFileSync(pidFile(), String(child.pid))

    const result = await stop()
    expect(result.stopped).toBe(true)

    // 进程应已真的退出（SIGTERM 的默认行为是终止），轮询验证，避免信号传递的竞态。
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(() => process.kill(child.pid, 0)).toThrow()
    child = undefined
  })
})

describe('status()', () => {
  it('既无 PID 也无 meta 文件时是 stopped', () => {
    expect(status()).toEqual({ state: 'stopped', logFile: path.join(dir, 'funflix-web.log') })
  })

  it('PID 文件指向已死进程时是 stale', () => {
    writeFileSync(pidFile(), '2147483647')
    const s = status()
    expect(s.state).toBe('stale')
    expect(s.pid).toBe(2147483647)
  })

  it('PID 存活且有 meta 时是 running，并带上记录的 host/port/backend', () => {
    writeFileSync(pidFile(), String(process.pid))
    writeFileSync(
      metaFile(),
      JSON.stringify({ pid: process.pid, host: '127.0.0.1', port: 8810, backendBaseUrl: 'http://x' }),
    )
    const s = status()
    expect(s).toMatchObject({ state: 'running', pid: process.pid, host: '127.0.0.1', port: 8810 })
  })
})
