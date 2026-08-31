import { ref, shallowRef } from 'vue'

import type { Page } from '@/api/types'

/**
 * 翻页列表的取数、加载态与错误态。
 *
 * 带请求序号：搜索框每敲一个字都会发一次请求，先发的后到时会用旧结果覆盖新结果，
 * 表现是「输入完却显示上一次的搜索结果」。只认最后一次请求的响应即可避免。
 */
export function usePagedList<T>(load: (page: number, size: number) => Promise<Page<T>>, initialSize = 20) {
  const items = shallowRef<T[]>([])
  const total = ref(0)
  const page = ref(1)
  const size = ref(initialSize)
  const loading = ref(false)
  const error = ref<string | null>(null)

  let latest = 0

  async function refresh(): Promise<void> {
    const token = ++latest
    loading.value = true
    error.value = null
    try {
      const data = await load(page.value, size.value)
      if (token !== latest) return
      items.value = data.items
      total.value = data.total
    } catch (e) {
      if (token !== latest) return
      error.value = e instanceof Error ? e.message : String(e)
      items.value = []
      total.value = 0
    } finally {
      if (token === latest) loading.value = false
    }
  }

  /** 换页：保留筛选条件。 */
  function goto(next: number): void {
    page.value = next
    void refresh()
  }

  /** 改筛选条件后调用：回到第一页，否则会停在一个可能不存在的页码上。 */
  function reload(): void {
    page.value = 1
    void refresh()
  }

  function setSize(next: number): void {
    size.value = next
    reload()
  }

  return { items, total, page, size, loading, error, refresh, goto, reload, setSize }
}
