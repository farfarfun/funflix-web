<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { api } from '@/api/client'
import type { MediaType } from '@/api/types'
import { usePagedList } from '@/composables/usePagedList'
import { MEDIA_TYPE_LABEL, toOptions } from '@/utils/display'

const route = useRoute()
const router = useRouter()

const keyword = ref('')
const mediaType = ref<MediaType | null>(null)
const year = ref<number | null>(null)
const validOnly = ref(false)

// 解构出来才能在模板里自动解包 —— 对象里的 ref 不会被模板 unwrap
const { items, total, page, size, loading, error, refresh, goto, reload } = usePagedList(
  (p, s) =>
    api.listMedia({
      keyword: keyword.value.trim(),
      media_type: mediaType.value,
      year: year.value,
      valid_only: validOnly.value,
      page: p,
      size: s,
    }),
  24,
)

const typeOptions = toOptions(MEDIA_TYPE_LABEL)

// --- 筛选条件与地址栏同步 ---------------------------------------------------
// 不同步的话：点进详情再返回，筛选和页码全丢；搜索结果也没法发给别人。

/** 正在把地址栏的值灌进 ref，此时不要反向再写一次地址栏。 */
let applyingFromUrl = false

function readFromUrl() {
  applyingFromUrl = true
  const q = route.query
  keyword.value = typeof q.q === 'string' ? q.q : ''
  mediaType.value = typeof q.type === 'string' ? (q.type as MediaType) : null
  year.value = q.year ? Number(q.year) || null : null
  validOnly.value = q.valid === '1'
  page.value = Number(q.page) > 0 ? Number(q.page) : 1
  // 等这一轮的 watch 都跑完再解除，否则灌值本身会触发回写
  void nextTick(() => {
    applyingFromUrl = false
  })
}

/** 当前筛选状态对应的 query。写地址栏和判断「这次变化是不是我们自己写的」都用它。 */
function buildQuery(): Record<string, string> {
  const q: Record<string, string> = {}
  if (keyword.value.trim()) q.q = keyword.value.trim()
  if (mediaType.value) q.type = mediaType.value
  if (year.value) q.year = String(year.value)
  if (validOnly.value) q.valid = '1'
  if (page.value > 1) q.page = String(page.value)
  return q
}

function serialize(q: Record<string, unknown>): string {
  return Object.keys(q)
    .filter((k) => q[k] !== undefined && q[k] !== null && q[k] !== '')
    .sort()
    .map((k) => `${k}=${String(q[k])}`)
    .join('&')
}

function writeToUrl() {
  // replace 而不是 push：每敲一个字都塞一条历史记录的话，返回键就没法用了
  void router.replace({ query: buildQuery() })
}

let timer: ReturnType<typeof setTimeout> | undefined

/** 改了筛选条件：回到第一页，写地址栏，重新取数。 */
function applyFilters(delay: number) {
  if (applyingFromUrl) return
  clearTimeout(timer)
  timer = setTimeout(() => {
    page.value = 1
    writeToUrl()
    reload()
  }, delay)
}

// 输入框按键触发，要防抖；下拉与勾选是离散动作，立即生效
watch([keyword, year], () => applyFilters(300))
watch([mediaType, validOnly], () => applyFilters(0))

function changePage(next: number) {
  goto(next)
  writeToUrl()
}

// 浏览器前进/后退会改 query 但不重建组件，要据此回灌并重新取数。
// 但 writeToUrl 自己也会触发这个 watch —— 只靠标志位很难覆盖异步的 replace，
// 干脆比较地址栏与当前状态：一致就说明这次变化是我们写的，已经取过数了。
watch(
  () => route.query,
  () => {
    if (applyingFromUrl) return
    if (serialize(route.query as Record<string, unknown>) === serialize(buildQuery())) return
    readFromUrl()
    void refresh()
  },
)

onMounted(() => {
  readFromUrl()
  void refresh()
})
</script>

<template>
  <div class="page">
    <n-h2 class="title">作品检索</n-h2>

    <n-card size="small">
      <n-space align="center" :size="12" wrap>
        <n-input
          v-model:value="keyword"
          clearable
          placeholder="搜索剧名，支持别名与简繁"
          style="width: 280px"
        />
        <n-select
          v-model:value="mediaType"
          :options="typeOptions"
          clearable
          placeholder="全部类型"
          style="width: 140px"
        />
        <n-input-number
          v-model:value="year"
          clearable
          :show-button="false"
          :min="1888"
          :max="2100"
          placeholder="年份"
          style="width: 110px"
        />
        <n-checkbox v-model:checked="validOnly">只看有可用资源</n-checkbox>
        <n-text depth="3">共 {{ total }} 部</n-text>
      </n-space>
    </n-card>

    <n-alert v-if="error" type="error" class="mt">{{ error }}</n-alert>

    <n-spin :show="loading">
      <n-empty v-if="!loading && items.length === 0" description="没有匹配的作品" class="mt-lg">
        <template #extra>
          <n-text depth="3">库里还没有数据时，先到「采集源」登记一个频道并采集，再跑解析。</n-text>
        </template>
      </n-empty>

      <div v-else class="grid mt">
        <n-card
          v-for="item in items"
          :key="item.id"
          size="small"
          hoverable
          class="card"
          @click="$router.push({ name: 'media-detail', params: { id: item.id } })"
        >
          <div class="card-title" :title="item.title">{{ item.title }}</div>
          <n-space :size="4" class="mt-xs">
            <n-tag size="small" :bordered="false">{{ MEDIA_TYPE_LABEL[item.media_type] }}</n-tag>
            <n-tag v-if="item.year" size="small" :bordered="false" type="info">
              {{ item.year }}
            </n-tag>
          </n-space>
          <div class="card-meta">
            <n-text depth="3">{{ item.resource_count }} 条资源</n-text>
            <n-text v-if="item.valid_resource_count > 0" type="success">
              {{ item.valid_resource_count }} 条可用
            </n-text>
          </div>
        </n-card>
      </div>
    </n-spin>

    <n-pagination
      v-if="total > size"
      class="pager"
      :page="page"
      :page-size="size"
      :item-count="total"
      @update:page="changePage"
    />
  </div>
</template>

<style scoped>
.title {
  margin: 0 0 16px;
}
.mt {
  margin-top: 16px;
}
.mt-xs {
  margin-top: 8px;
}
.mt-lg {
  margin-top: 48px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 12px;
}
.card {
  cursor: pointer;
}
.card-title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-meta {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}
.pager {
  margin-top: 20px;
  justify-content: center;
}
</style>
