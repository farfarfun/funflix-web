<script setup lang="ts">
import { useMessage } from 'naive-ui'

import type { Resource } from '@/api/types'
import {
  CHECK_STATUS_LABEL,
  CHECK_STATUS_TYPE,
  formatSize,
  fromNow,
  PROVIDER_LABEL,
  QUALITY_LABEL,
} from '@/utils/display'

defineProps<{ resources: Resource[]; loading?: boolean }>()

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
</script>

<template>
  <n-spin :show="loading">
    <n-empty v-if="resources.length === 0" description="暂无网盘资源" style="padding: 32px 0" />
    <n-table v-else :single-line="false" size="small">
      <thead>
        <tr>
          <th style="width: 84px">网盘</th>
          <th>链接</th>
          <th style="width: 90px">画质</th>
          <th style="width: 110px">集数</th>
          <th style="width: 90px">大小</th>
          <th style="width: 100px">校验</th>
          <th style="width: 110px">最近出现</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in resources" :key="r.id">
          <td>{{ PROVIDER_LABEL[r.provider] }}</td>
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
          </td>
          <td>{{ QUALITY_LABEL[r.quality] }}</td>
          <td>{{ r.episode_info ?? '-' }}</td>
          <td>{{ formatSize(r.size_bytes) }}</td>
          <td>
            <n-tag size="small" :bordered="false" :type="CHECK_STATUS_TYPE[r.check_status]">
              {{ CHECK_STATUS_LABEL[r.check_status] }}
            </n-tag>
          </td>
          <td>
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
</template>

<style scoped>
.raw-title {
  font-size: 12px;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  vertical-align: middle;
}
</style>
