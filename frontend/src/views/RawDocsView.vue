<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { api } from '@/api/client'
import type { ParseStatus, RawDocument, SourceType } from '@/api/types'
import { usePagedList } from '@/composables/usePagedList'
import {
  formatTime,
  fromNow,
  PARSE_STATUS_LABEL,
  PARSE_STATUS_TYPE,
  SOURCE_TYPE_LABEL,
  toOptions,
} from '@/utils/display'

const parseStatus = ref<ParseStatus | null>(null)
const sourceType = ref<SourceType | null>(null)

const { items, total, page, size, loading, error, refresh, goto, reload } = usePagedList(
  (p, s) =>
    api.listRaw({
      parse_status: parseStatus.value,
      source_type: sourceType.value,
      page: p,
      size: s,
    }),
  20,
)

watch([parseStatus, sourceType], reload)
onMounted(refresh)

// --- 详情 ---
// 列表接口刻意不返回全文，点开时再单独取一次
const detail = ref<RawDocument | null>(null)
const detailLoading = ref(false)
const showDetail = ref(false)

async function open(id: number) {
  showDetail.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await api.getRaw(id)
  } finally {
    detailLoading.value = false
  }
}
</script>

<template>
  <div class="page">
    <n-h2 class="title">原始文本</n-h2>

    <n-card size="small">
      <n-space align="center" :size="12" wrap>
        <n-select
          v-model:value="parseStatus"
          :options="toOptions(PARSE_STATUS_LABEL)"
          clearable
          placeholder="全部解析状态"
          style="width: 160px"
        />
        <n-select
          v-model:value="sourceType"
          :options="toOptions(SOURCE_TYPE_LABEL)"
          clearable
          placeholder="全部来源类型"
          style="width: 170px"
        />
        <n-button size="small" @click="refresh">刷新</n-button>
        <n-text depth="3">共 {{ total }} 条</n-text>
      </n-space>
    </n-card>

    <n-alert v-if="error" type="error" class="mt">{{ error }}</n-alert>

    <n-spin :show="loading">
      <n-empty v-if="!loading && items.length === 0" description="没有原始文本" class="empty" />
      <n-table v-else :single-line="false" size="small" class="mt">
        <thead>
          <tr>
            <th style="width: 64px">#</th>
            <th style="width: 120px">来源类型</th>
            <th>来源名称</th>
            <th style="width: 100px">解析状态</th>
            <th style="width: 70px">尝试</th>
            <th style="width: 120px">采集时间</th>
            <th style="width: 80px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in items" :key="d.id">
            <td>{{ d.id }}</td>
            <td>{{ SOURCE_TYPE_LABEL[d.source_type] ?? d.source_type }}</td>
            <td>{{ d.source_name ?? '-' }}</td>
            <td>
              <n-tag size="small" :bordered="false" :type="PARSE_STATUS_TYPE[d.parse_status]">
                {{ PARSE_STATUS_LABEL[d.parse_status] }}
              </n-tag>
            </td>
            <td>{{ d.parse_attempts }}</td>
            <td>
              <n-tooltip>
                <template #trigger><span>{{ fromNow(d.collected_at) }}</span></template>
                {{ formatTime(d.collected_at) }}
              </n-tooltip>
            </td>
            <td><n-button size="tiny" @click="open(d.id)">查看</n-button></td>
          </tr>
        </tbody>
      </n-table>
    </n-spin>

    <n-pagination
      v-if="total > size"
      class="pager"
      :page="page"
      :page-size="size"
      :item-count="total"
      @update:page="goto"
    />

    <n-modal
      v-model:show="showDetail"
      preset="card"
      title="原始文本"
      style="max-width: 820px"
      :bordered="false"
    >
      <n-spin :show="detailLoading">
        <template v-if="detail">
          <n-descriptions bordered size="small" :column="2" label-placement="left" class="mb">
            <n-descriptions-item label="来源">
              {{ detail.source_name ?? '-' }}
            </n-descriptions-item>
            <n-descriptions-item label="发布时间">
              {{ formatTime(detail.published_at) }}
            </n-descriptions-item>
            <n-descriptions-item label="原帖">
              <n-button
                v-if="detail.source_url"
                text
                tag="a"
                :href="detail.source_url"
                target="_blank"
                rel="noopener noreferrer"
              >
                打开
              </n-button>
              <span v-else>-</span>
            </n-descriptions-item>
            <n-descriptions-item label="内容指纹">
              <n-text code style="font-size: 11px">{{ detail.content_hash.slice(0, 16) }}…</n-text>
            </n-descriptions-item>
          </n-descriptions>

          <n-alert v-if="detail.parse_error" type="error" class="mb" title="解析错误">
            {{ detail.parse_error }}
          </n-alert>

          <n-log :log="detail.content" :rows="18" language="text" />
        </template>
      </n-spin>
    </n-modal>
  </div>
</template>

<style scoped>
.title {
  margin: 0 0 16px;
}
.mt {
  margin-top: 16px;
}
.mb {
  margin-bottom: 12px;
}
.empty {
  padding: 48px 0;
}
.pager {
  margin-top: 20px;
  justify-content: center;
}
</style>
