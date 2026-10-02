// 覆盖 fetchMe() 的错误分类：401（明确未登录）必须清掉登录态；
// 网络故障 / 后端 500 不是「未登录」，不能悄悄把人退登录态（组织规范 §8.2）。
import { beforeEach, describe, expect, it, vi } from 'vitest'

const meMock = vi.fn()

vi.mock('./client', async () => {
  const actual = await vi.importActual<typeof import('./client')>('./client')
  return {
    ...actual,
    api: { ...actual.api, me: meMock },
  }
})

const { ApiError } = await import('./client')
const { authError, currentUser, fetchMe } = await import('./auth')

describe('fetchMe', () => {
  beforeEach(() => {
    meMock.mockReset()
    currentUser.value = null
    authError.value = null
  })

  it('成功时写入 currentUser 并清空 authError', async () => {
    meMock.mockResolvedValue({ id: '1', username: 'a' })
    await fetchMe()
    expect(currentUser.value).toEqual({ id: '1', username: 'a' })
    expect(authError.value).toBeNull()
  })

  it('401 时清空 currentUser，判定为明确未登录，不计入 authError', async () => {
    currentUser.value = { id: '1', username: 'a' }
    meMock.mockRejectedValue(new ApiError(401, '未登录'))
    await fetchMe()
    expect(currentUser.value).toBeNull()
    expect(authError.value).toBeNull()
  })

  it('网络故障/500 时保留原有 currentUser，故障记录到 authError 供界面展示', async () => {
    currentUser.value = { id: '1', username: 'a' }
    meMock.mockRejectedValue(new ApiError(500, '服务异常'))
    await fetchMe()
    expect(currentUser.value).toEqual({ id: '1', username: 'a' })
    expect(authError.value).not.toBeNull()
    expect(authError.value?.message).toContain('服务异常')
  })

  it('同一时间重复调用只发一次请求', async () => {
    meMock.mockResolvedValue({ id: '1', username: 'a' })
    await Promise.all([fetchMe(), fetchMe(), fetchMe()])
    expect(meMock).toHaveBeenCalledTimes(1)
  })
})
