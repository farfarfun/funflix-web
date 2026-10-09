/**
 * 登录态。
 *
 * 两道门：**整站**要登录（作品检索、详情也要），「运维」区（采集源 / 原始文本 /
 * 网盘资源 / 大盘）在此之上还要求 admin 角色。会话由后端签名的 httpOnly cookie
 * 维护，前端拿不到也不需要拿到 cookie 本身，这里只镜像一份当前用户，供路由守卫
 * 和界面判断用。
 *
 * 镜像只用来少跳一次冤枉路。真正的门禁在 FastAPI 上（`CurrentUserDep` /
 * `AdminUserDep`）—— 在控制台里把 `currentUser.role` 改成 admin，运维接口照样 403。
 */

import { computed, ref } from 'vue'

import { ApiError, api, setUnauthorizedHandler } from './client'
import type { User } from './types'

export const currentUser = ref<User | null>(null)

/**
 * 应用启动后的第一次 `/auth/me` 是否已经跑完。路由守卫要等它——不然会在
 * 还不知道有没有登录的一瞬间就误判成"未登录"，把人跳去登录页。
 */
export const authReady = ref(false)

export const isAuthenticated = computed(() => currentUser.value !== null)

/** 是否运维账号。只决定「运维」入口显不显示、运维路由放不放行。 */
export const isAdmin = computed(() => currentUser.value?.role === 'admin')

/**
 * 最近一次 `fetchMe()` 遇到的非 401 故障（网络错误、后端 500 等）。
 * 401 代表「明确未登录」，不算故障，会清空这里。界面可据此区分
 * 「真的没登录」与「服务暂时不可达」，不要把后者也当成前者处理。
 */
export const authError = ref<Error | null>(null)

let inflight: Promise<void> | null = null

/** 拉一次当前登录用户，写入 `currentUser`。同一时间只发一次请求。 */
export function fetchMe(): Promise<void> {
  if (inflight) return inflight
  inflight = api
    .me()
    .then((user) => {
      currentUser.value = user
      authError.value = null
    })
    .catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        // 明确未认证：清掉本地镜像的登录态，这是正常的「未登录」分支。
        currentUser.value = null
        authError.value = null
        return
      }
      // 网络故障 / 后端 500 等：不是「未登录」，不能悄悄把人退登录态。
      // 保留错误供调用方（路由守卫、界面）判断与展示，不静默吞掉。
      authError.value = err instanceof Error ? err : new Error(String(err))
    })
    .finally(() => {
      authReady.value = true
      inflight = null
    })
  return inflight
}

export async function login(username: string, password: string): Promise<void> {
  currentUser.value = await api.login(username, password)
}

/**
 * 凭邀请码注册。注册成功即已登录（后端同一次响应就下了会话 cookie），
 * 所以这里直接写 `currentUser`，不用再走一遍 `login()`。
 *
 * 注册出来一律是 guest —— 角色由后端定，调用方给不了。
 */
export async function register(
  username: string,
  password: string,
  inviteCode: string,
): Promise<void> {
  currentUser.value = await api.register(username, password, inviteCode)
}

export async function logout(): Promise<void> {
  try {
    await api.logout()
  } finally {
    currentUser.value = null
  }
}

// 会话过期后端会回 401——这里跟着清掉本地镜像的登录态，界面不至于显示
// "已登录"却处处操作失败。
setUnauthorizedHandler(() => {
  currentUser.value = null
})
