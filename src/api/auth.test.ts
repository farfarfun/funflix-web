// 覆盖 fetchMe() 的错误分类：401（明确未登录）必须清掉登录态；
// 网络故障 / 后端 500 不是「未登录」，不能悄悄把人退登录态（组织规范 §8.2）。
// 另外覆盖 isAdmin 的取值与 register() 的「注册即登录」。
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { User } from './types'

const meMock = vi.fn()
const registerMock = vi.fn()

vi.mock('./client', async () => {
  const actual = await vi.importActual<typeof import('./client')>('./client')
  return {
    ...actual,
    api: { ...actual.api, me: meMock, register: registerMock },
  }
})

const { ApiError } = await import('./client')
const { authError, currentUser, fetchMe, isAdmin, register } = await import('./auth')

const GUEST: User = { id: '1', username: 'a', role: 'guest' }
const ADMIN: User = { id: '2', username: 'ops', role: 'admin' }

describe('fetchMe', () => {
  beforeEach(() => {
    meMock.mockReset()
    currentUser.value = null
    authError.value = null
  })

  it('成功时写入 currentUser 并清空 authError', async () => {
    meMock.mockResolvedValue(GUEST)
    await fetchMe()
    expect(currentUser.value).toEqual(GUEST)
    expect(authError.value).toBeNull()
  })

  it('401 时清空 currentUser，判定为明确未登录，不计入 authError', async () => {
    currentUser.value = GUEST
    meMock.mockRejectedValue(new ApiError(401, '未登录'))
    await fetchMe()
    expect(currentUser.value).toBeNull()
    expect(authError.value).toBeNull()
  })

  it('网络故障/500 时保留原有 currentUser，故障记录到 authError 供界面展示', async () => {
    currentUser.value = GUEST
    meMock.mockRejectedValue(new ApiError(500, '服务异常'))
    await fetchMe()
    expect(currentUser.value).toEqual(GUEST)
    expect(authError.value).not.toBeNull()
    expect(authError.value?.message).toContain('服务异常')
  })

  it('同一时间重复调用只发一次请求', async () => {
    meMock.mockResolvedValue(GUEST)
    await Promise.all([fetchMe(), fetchMe(), fetchMe()])
    expect(meMock).toHaveBeenCalledTimes(1)
  })
})

describe('isAdmin', () => {
  beforeEach(() => {
    currentUser.value = null
  })

  it('跟着当前用户的角色变', () => {
    expect(isAdmin.value).toBe(false)
    currentUser.value = GUEST
    expect(isAdmin.value).toBe(false)
    currentUser.value = ADMIN
    expect(isAdmin.value).toBe(true)
  })
})

describe('register', () => {
  beforeEach(() => {
    registerMock.mockReset()
    currentUser.value = null
  })

  it('注册成功即已登录，直接写入 currentUser', async () => {
    registerMock.mockResolvedValue(GUEST)
    await register('a', 'secret123', 'CODE')
    expect(registerMock).toHaveBeenCalledWith('a', 'secret123', 'CODE')
    expect(currentUser.value).toEqual(GUEST)
  })

  it('注册失败时不动登录态，异常原样抛给界面', async () => {
    registerMock.mockRejectedValue(new ApiError(400, '邀请码无效或已用完'))
    await expect(register('a', 'secret123', 'BAD')).rejects.toThrow('邀请码无效或已用完')
    expect(currentUser.value).toBeNull()
  })
})
