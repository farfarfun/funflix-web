<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { api } from '@/api/client'
import type { MediaType } from '@/api/types'
import { usePagedList } from '@/composables/usePagedList'
import { MEDIA_TYPE_LABEL, toOptions } from '@/utils/display'

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

// 关键词做防抖，其余筛选项是离散选择，改动即刻生效
let timer: ReturnType<typeof setTimeout> | undefined
watch(keyword, () => {
  clearTimeout(timer)
  timer = setTimeout(reload, 300)
})
watch([mediaType, year, validOnly], reload)

onMounted(refresh)
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
      @update:page="goto"
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
