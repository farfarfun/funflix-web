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
// 和「按画质/大小挑」这两件事不用眼睛在表格里一行行扫。

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
    <n-space v-if="resources.length > 0" align="center" :size="12" class="toolbar">
      <n-checkbox v-model:checked="validOnly">只看有效</n-checkbox>
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
      <n-table v-else :single-line="false" size="small" class="res-table">
        <thead>
          <tr>
            <th class="col-provider">网盘</th>
            <th>链接</th>
            <th class="col-quality sortable" @click="toggleSort('quality')">画质{{ sortArrow('quality') }}</th>
            <th class="col-episode">集数</th>
            <th class="col-size sortable" @click="toggleSort('size')">大小{{ sortArrow('size') }}</th>
            <th class="col-check">校验</th>
            <th class="col-lastseen">最近出现</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in displayResources" :key="r.id">
            <td class="col-provider">
              <span class="provider">
                <span class="dot" :style="{ background: PROVIDER_COLOR[r.provider] }" />
                {{ PROVIDER_LABEL[r.provider] }}
              </span>
            </td>
            <td>
              <n-space :size="6" align="center" :wrap="false">
                <n-button text tag="a" :href="r.url" target="_blank" rel="noopener noreferrer">
                  打开
                </n-button>
                <n-button text type="primary" @click="copy(r.url, '链接')">复制</n-button>
                <n-tag v-if="r.passcode" size="small" :bordered="false" @click="copy(r.passcode!, '提取码')">
                  码 {{ r.passcode }}
                </n-tag>
                <n-text v-if="r.title_raw" depth="3" class="raw-title" :title="r.title_raw">
                  {{ r.title_raw }}
                </n-text>
              </n-space>
              <!-- 窄屏收起独立列后，这几项挪到链接下面一行 -->
              <n-space class="mobile-meta" :size="6" align="center">
                <n-tag size="tiny" :bordered="false">{{ QUALITY_LABEL[r.quality] }}</n-tag>
                <span v-if="r.episode_info">{{ r.episode_info }}</span>
                <span>{{ formatSize(r.size_bytes) }}</span>
                <n-tag size="tiny" :bordered="false" :type="CHECK_STATUS_TYPE[r.check_status]">
                  {{ CHECK_STATUS_LABEL[r.check_status] }}
                </n-tag>
                <span>{{ fromNow(r.last_seen_at) }}</span>
              </n-space>
            </td>
            <td class="col-quality">{{ QUALITY_LABEL[r.quality] }}</td>
            <td class="col-episode">{{ r.episode_info ?? '-' }}</td>
            <td class="col-size">{{ formatSize(r.size_bytes) }}</td>
            <td class="col-check">
              <n-tag size="small" :bordered="false" :type="CHECK_STATUS_TYPE[r.check_status]">
                {{ CHECK_STATUS_LABEL[r.check_status] }}
              </n-tag>
            </td>
            <td class="col-lastseen">
              <n-tooltip>
                <template #trigger>
                  <span>{{ fromNow(r.last_seen_at) }}</span>
                </template>
                被 {{ r.seen_count }} 条分享提到过
              </n-tooltip>
            </td>
          </tr>
        </tbody>
      </n-table>
    </n-spin>
  </div>
</template>

<style scoped>
.toolbar {
  margin-bottom: 10px;
}
:deep(tbody tr:nth-child(even)) {
  background: rgba(128, 128, 128, 0.05);
}
.provider {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.raw-title {
  font-size: 12px;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  vertical-align: middle;
}
.col-provider {
  width: 84px;
}
.col-quality {
  width: 90px;
}
.col-episode {
  width: 110px;
}
.col-size {
  width: 90px;
}
.col-check {
  width: 100px;
}
.col-lastseen {
  width: 110px;
}
.sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.sortable:hover {
  color: var(--n-title-text-color, inherit);
  opacity: 0.8;
}
.mobile-meta {
  display: none;
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.65;
  flex-wrap: wrap;
}

/* 窄屏下 7 列表格挤不下：只留网盘/链接/集数，其余信息挪到链接下面一行 */
@media (max-width: 720px) {
  .res-table .col-quality,
  .res-table .col-size,
  .res-table .col-check,
  .res-table .col-lastseen {
    display: none;
  }
  .mobile-meta {
    display: flex;
  }
}
</style>
