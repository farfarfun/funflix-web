<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { computed, ref } from 'vue'

import type { Quality, Resource } from '@/api/types'
import {
  CHECK_STATUS_LABEL,
  CHECK_STATUS_TYPE,
  formatSize,
  fromNow,
  PROVIDER_COLOR,
  PROVIDER_LABEL,
  QUALITY_LABEL,
} from '@/utils/display'

const props = defineProps<{ resources: Resource[]; loading?: boolean }>()

const message = useMessage()

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success(`${what}已复制`)
  } catch {
    // 非 HTTPS 且非 localhost 时 clipboard API 不可用，这时告诉用户手动复制
    message.warning('当前环境不允许自动复制，请手动选中链接')
  }
}

// --- 只看有效 / 按画质·大小排序 --------------------------------------------
// 详情接口一次性把这部作品的资源全量返回（最多 200 条），客户端筛选/排序即可，
// 不需要再打一次接口。有效资源本来就由后端排在前面，这里只是让「只看有效」
// 和「按画质/大小挑」这两件事不用眼睛在列表里一行行扫。

const validOnly = ref(false)

type SortKey = 'quality' | 'size' | null
const sortKey = ref<SortKey>(null)
const sortDir = ref<'asc' | 'desc'>('desc')

const QUALITY_RANK: Record<Quality, number> = { '4k': 4, '1080p': 3, '720p': 2, sd: 1, unknown: 0 }

function toggleSort(key: Exclude<SortKey, null>) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
}

function sortArrow(key: Exclude<SortKey, null>): string {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'desc' ? ' ↓' : ' ↑'
}

const displayResources = computed(() => {
  let list = props.resources
  if (validOnly.value) list = list.filter((r) => r.check_status === 'valid')
  if (sortKey.value) {
    const key = sortKey.value
    const dir = sortDir.value === 'desc' ? -1 : 1
    list = [...list].sort((a, b) => {
      const av = key === 'quality' ? QUALITY_RANK[a.quality] : (a.size_bytes ?? -1)
      const bv = key === 'quality' ? QUALITY_RANK[b.quality] : (b.size_bytes ?? -1)
      return (av - bv) * dir
    })
  }
  return list
})
</script>

<template>
  <div>
    <n-space v-if="resources.length > 0" align="center" :size="12" class="toolbar" :wrap="true">
      <n-checkbox v-model:checked="validOnly">只看有效</n-checkbox>
      <div class="sort-group">
        <button
          type="button"
          class="sort-chip"
          :class="{ active: sortKey === 'quality' }"
          @click="toggleSort('quality')"
        >
          画质{{ sortArrow('quality') }}
        </button>
        <button type="button" class="sort-chip" :class="{ active: sortKey === 'size' }" @click="toggleSort('size')">
          大小{{ sortArrow('size') }}
        </button>
      </div>
      <n-text depth="3" style="font-size: 12px">
        {{ displayResources.length }} / {{ resources.length }} 条
      </n-text>
    </n-space>

    <n-spin :show="loading">
      <n-empty v-if="resources.length === 0" description="暂无网盘资源" style="padding: 32px 0" />
      <n-empty
        v-else-if="displayResources.length === 0"
        description="没有满足条件的资源"
        style="padding: 32px 0"
      />
      <div v-else class="res-list">
        <div v-for="r in displayResources" :key="r.id" class="res-row">
          <div class="res-provider">
            <span class="dot" :style="{ background: PROVIDER_COLOR[r.provider] }" />
            {{ PROVIDER_LABEL[r.provider] }}
          </div>

          <div class="res-main">
            <n-space :size="6" align="center" :wrap="false">
              <n-button text tag="a" :href="r.url" target="_blank" rel="noopener noreferrer">
                打开
              </n-button>
              <n-button text type="primary" @click="copy(r.url, '链接')">复制</n-button>
              <n-tag v-if="r.passcode" size="small" :bordered="false" @click="copy(r.passcode!, '提取码')">
                码 {{ r.passcode }}
              </n-tag>
            </n-space>
            <n-text v-if="r.title_raw" depth="3" class="raw-title" :title="r.title_raw">
              {{ r.title_raw }}
            </n-text>
          </div>

          <div class="res-meta">
            <n-tag size="small" :bordered="false">{{ QUALITY_LABEL[r.quality] }}</n-tag>
            <span v-if="r.episode_info" class="meta-item">{{ r.episode_info }}</span>
            <span class="meta-item">{{ formatSize(r.size_bytes) }}</span>
            <n-tag size="small" :bordered="false" :type="CHECK_STATUS_TYPE[r.check_status]">
              {{ CHECK_STATUS_LABEL[r.check_status] }}
            </n-tag>
            <n-tooltip>
              <template #trigger>
                <span class="meta-item">{{ fromNow(r.last_seen_at) }}</span>
              </template>
              被 {{ r.seen_count }} 条分享提到过
            </n-tooltip>
          </div>
        </div>
      </div>
    </n-spin>
  </div>
</template>

<style scoped>
.toolbar {
  margin-bottom: 12px;
}
.sort-group {
  display: flex;
  gap: 6px;
}
.sort-chip {
  appearance: none;
  border: 1px solid rgba(128, 128, 128, 0.28);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.15s var(--ease), color 0.15s var(--ease), border-color 0.15s var(--ease);
}
.sort-chip:hover {
  opacity: 1;
}
.sort-chip.active {
  opacity: 1;
  color: var(--n-primary-color, #6d5ef8);
  border-color: var(--n-primary-color, #6d5ef8);
}
.res-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.res-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--poster-surface);
  border: 1px solid rgba(128, 128, 128, 0.12);
  transition: background 0.15s var(--ease);
}
.res-row:hover {
  background: rgba(128, 128, 128, 0.1);
}
.res-provider {
  flex: none;
  width: 84px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.res-main {
  flex: 1 1 260px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.raw-title {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.res-meta {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  opacity: 0.85;
}
.meta-item {
  white-space: nowrap;
}
</style>
