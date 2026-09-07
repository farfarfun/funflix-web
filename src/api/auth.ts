/**
 * 登录态。
 *
 * 「运维」区（采集源 / 原始文本 / 网盘资源 / 大盘）整体要求登录，会话由
 * 后端签名的 httpOnly cookie 维护，前端拿不到也不需要拿到 cookie 本身，
 * 这里只镜像一份当前用户，供路由守卫和界面判断用。
 */

import { computed, ref } from 'vue'

import { api, setUnauthorizedHandler } from './client'
import type { User } from './types'

export const currentUser = ref<User | null>(null)

/**
 * 应用启动后的第一次 `/auth/me` 是否已经跑完。路由守卫要等它——不然会在
 * 还不知道有没有登录的一瞬间就误判成"未登录"，把人跳去登录页。
 */
export const authReady = ref(false)

export const isAuthenticated = computed(() => currentUser.value !== null)

let inflight: Promise<void> | null = null

/** 拉一次当前登录用户，写入 `currentUser`。同一时间只发一次请求。 */
export function fetchMe(): Promise<void> {
  if (inflight) return inflight
  inflight = api
    .me()
    .then((user) => {
      currentUser.value = user
    })
    .catch(() => {
      currentUser.value = null
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
