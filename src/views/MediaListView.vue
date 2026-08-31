<script setup lang="ts">
import { SearchOutline } from '@vicons/ionicons5'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { hasAdminKey } from '@/api/auth'
import { api } from '@/api/client'
import type { MediaType } from '@/api/types'
import PosterCard from '@/components/PosterCard.vue'
import { usePagedList } from '@/composables/usePagedList'
import { MEDIA_TYPE_COLOR, MEDIA_TYPE_LABEL } from '@/utils/display'

/** 首屏骨架屏的占位数：够铺满一屏又不会渲染太多占位节点。 */
const SKELETON_COUNT = 12

const route = useRoute()
const router = useRouter()

const keyword = ref('')
const mediaType = ref<MediaType | null>(null)
const year = ref<number | null>(null)
const validOnly = ref(false)

const TYPE_OPTIONS = Object.keys(MEDIA_TYPE_LABEL) as MediaType[]

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

function selectType(t: MediaType | null) {
  mediaType.value = mediaType.value === t ? null : t
}

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

/** 防抖计时期间为 true：敲字时给个反馈，不然用户会以为没反应而重复操作。 */
const debouncing = ref(false)

/** 改了筛选条件：回到第一页，写地址栏，重新取数。 */
function applyFilters(delay: number) {
  if (applyingFromUrl) return
  clearTimeout(timer)
  if (delay > 0) debouncing.value = true
  timer = setTimeout(() => {
    debouncing.value = false
    page.value = 1
    writeToUrl()
    reload()
  }, delay)
}

/** 是否有任何筛选条件在生效，用来区分「搜不到」与「库里本来就没数据」两种空状态。 */
const hasActiveFilters = computed(
  () => keyword.value.trim() !== '' || mediaType.value !== null || year.value !== null || validOnly.value,
)

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
    <div class="toolbar">
      <n-input v-model:value="keyword" clearable placeholder="搜索剧名，支持别名与简繁" class="search">
        <template #prefix><n-icon :depth="3"><SearchOutline /></n-icon></template>
        <template v-if="debouncing" #suffix><n-spin :size="14" /></template>
      </n-input>

      <div class="filters">
        <div class="pills">
          <button type="button" class="pill" :class="{ active: mediaType === null }" @click="selectType(null)">
            全部
          </button>
          <button
            v-for="t in TYPE_OPTIONS"
            :key="t"
            type="button"
            class="pill"
            :class="{ active: mediaType === t }"
            :style="mediaType === t ? { background: MEDIA_TYPE_COLOR[t], borderColor: MEDIA_TYPE_COLOR[t] } : {}"
            @click="selectType(t)"
          >
            {{ MEDIA_TYPE_LABEL[t] }}
          </button>
        </div>

        <n-input-number
          v-model:value="year"
          clearable
          :show-button="false"
          :min="1888"
          :max="2100"
          placeholder="年份"
          class="year-input"
        />
        <n-checkbox v-model:checked="validOnly">只看有可用资源</n-checkbox>
        <n-text depth="3" class="total">共 {{ total }} 部</n-text>
      </div>
    </div>

    <n-alert v-if="error" type="error" class="mt">{{ error }}</n-alert>

    <!-- 首屏（还没有任何数据可显示）用骨架屏，比整页转圈更快出内容感；
         换页/改筛选时列表里已经有旧数据，走下面的 n-spin 蒙层就够了 -->
    <div v-if="loading && items.length === 0 && !error" class="grid mt">
      <n-skeleton v-for="i in SKELETON_COUNT" :key="i" class="skeleton-poster" :sharp="false" />
    </div>

    <n-spin v-else :show="loading">
      <n-empty
        v-if="!loading && items.length === 0"
        :description="hasActiveFilters ? '没有匹配的作品，换个关键词或筛选条件试试' : '库里还没有作品'"
        class="mt-lg"
      >
        <template v-if="hasAdminKey && !hasActiveFilters" #extra>
          <n-text depth="3">去「采集源」登记一个频道并采集，再跑解析即可入库。</n-text>
        </template>
      </n-empty>

      <div v-else class="grid mt">
        <PosterCard v-for="item in items" :key="item.id" :item="item" />
      </div>
    </n-spin>

    <n-pagination
      v-if="total > size"
      class="pager"
      :page="page"
      :page-size="size"
      :item-count="total"
      show-quick-jumper
      @update:page="changePage"
    />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.search {
  max-width: 420px;
}
.filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pill {
  appearance: none;
  border: 1px solid rgba(128, 128, 128, 0.28);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  padding: 5px 14px;
  border-radius: 999px;
  cursor: pointer;
  opacity: 0.75;
  transition: opacity 0.15s var(--ease), transform 0.15s var(--ease), background 0.15s var(--ease);
}
.pill:hover {
  opacity: 1;
}
.pill.active {
  opacity: 1;
  color: #fff;
  border-color: transparent;
  background: var(--n-primary-color, #6d5ef8);
}
.year-input {
  width: 110px;
}
.total {
  margin-left: auto;
}
.mt {
  margin-top: 20px;
}
.mt-lg {
  margin-top: 64px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 18px;
}
.skeleton-poster {
  aspect-ratio: 2 / 3;
  width: 100%;
  border-radius: var(--radius-md);
}
.pager {
  margin-top: 28px;
  justify-content: center;
}
</style>
