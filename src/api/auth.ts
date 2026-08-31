/**
 * 管理密钥。
 *
 * 后端的写接口（登记 / 修改 / 删除采集源、触发采集）要求 `X-API-Key`，
 * 值是服务端的 `FUNFLIX_ADMIN_API_KEY`。读接口一律不需要。
 *
 * 存在 localStorage 里：这是个自部署的本地工具，没有登录体系可挂靠。
 * 代价是任何 XSS 都能读到它 —— 所以别把这个界面暴露到公网。
 */

import { computed, ref } from 'vue'

const STORAGE_KEY = 'funflix.adminKey'

export const adminKey = ref(localStorage.getItem(STORAGE_KEY) ?? '')

/** 有没有配密钥。没有的话写操作会被后端 403，界面要提前禁用。 */
export const hasAdminKey = computed(() => adminKey.value.length > 0)

export function setAdminKey(value: string): void {
  adminKey.value = value.trim()
  if (adminKey.value) localStorage.setItem(STORAGE_KEY, adminKey.value)
  else localStorage.removeItem(STORAGE_KEY)
}
