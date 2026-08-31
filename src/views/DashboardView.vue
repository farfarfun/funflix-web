<script setup lang="ts">
import {
  AlbumsOutline,
  CloudDownloadOutline,
  CloudUploadOutline,
  DocumentTextOutline,
} from '@vicons/ionicons5'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { api } from '@/api/client'
import type { PipelineStats } from '@/api/types'
import type { BreakdownRow } from '@/components/BreakdownList.vue'
import BreakdownList from '@/components/BreakdownList.vue'
import {
  CHECK_STATUS_COLOR,
  CHECK_STATUS_LABEL,
  MEDIA_TYPE_COLOR,
  MEDIA_TYPE_LABEL,
  PARSE_STATUS_COLOR,
  PARSE_STATUS_LABEL,
  PROVIDER_COLOR,
  PROVIDER_LABEL,
} from '@/utils/display'

const stats = ref<PipelineStats | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    stats.value = await api.getStats()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)

// --- 自动刷新：盯着采集/校验进度时手动点刷新很烦，给个可关的轮询 ---
const AUTO_REFRESH_MS = 30_000
const autoRefresh = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

function stopAutoRefresh() {
  if (timer !== undefined) {
    clearInterval(timer)
    timer = undefined
  }
}

watch(autoRefresh, (on) => {
  stopAutoRefresh()
  if (on) timer = setInterval(load, AUTO_REFRESH_MS)
})

onUnmounted(stopAutoRefresh)

/** 把 {键: 数量} 变成按数量倒序的行，顺带把英文字面值翻成中文。 */
function rows(
  counts: Record<string, number> | undefined,
  labels?: Record<string, string>,
): BreakdownRow[] {
  if (!counts) return []
  return Object.entries(counts)
    .map(([key, value]) => ({ key, label: labels?.[key] ?? key, value }))
    .sort((a, b) => b.value - a.value)
}

/** 校验通过率：分母只算「已经校验过的」，未校验的不该拉低它。 */
const validRate = computed(() => {
  const by = stats.value?.resource_by_check
  if (!by) return null
  const checked = (by.valid ?? 0) + (by.invalid ?? 0) + (by.error ?? 0)
  if (checked === 0) return null
  return Math.round(((by.valid ?? 0) / checked) * 100)
})
</script>

<template>
  <div class="page">
    <n-space align="center" justify="space-between" class="head">
      <n-h2 class="title">流水线大盘</n-h2>
      <n-space align="center" :size="12">
        <n-checkbox v-model:checked="autoRefresh">
          自动刷新（{{ AUTO_REFRESH_MS / 1000 }}s）
        </n-checkbox>
        <n-button size="small" :loading="loading" @click="load">刷新</n-button>
      </n-space>
    </n-space>

    <n-alert v-if="error" type="error">{{ error }}</n-alert>

    <n-spin :show="loading">
      <template v-if="stats">
        <n-grid :cols="4" :x-gap="12" :y-gap="12" item-responsive responsive="screen">
          <n-gi span="4 s:2 m:1">
            <n-card size="small" class="stat-card">
              <div class="stat-icon accent-blue"><n-icon size="20"><CloudUploadOutline /></n-icon></div>
              <n-statistic label="采集源" :value="stats.sources_total" />
              <n-text depth="3" class="hint">
                启用 {{ stats.sources_enabled }}
                <n-text v-if="stats.sources_failing > 0" type="warning">
                  · {{ stats.sources_failing }} 个连续失败
                </n-text>
              </n-text>
            </n-card>
          </n-gi>
          <n-gi span="4 s:2 m:1">
            <n-card size="small" class="stat-card">
              <div class="stat-icon accent-amber"><n-icon size="20"><DocumentTextOutline /></n-icon></div>
              <n-statistic label="原始文本" :value="stats.raw_total" />
              <n-text depth="3" class="hint">
                待解析 {{ stats.raw_by_status.pending ?? 0 }}
              </n-text>
            </n-card>
          </n-gi>
          <n-gi span="4 s:2 m:1">
            <n-card size="small" class="stat-card">
              <div class="stat-icon accent-purple"><n-icon size="20"><AlbumsOutline /></n-icon></div>
              <n-statistic label="作品" :value="stats.media_total" />
              <n-text depth="3" class="hint">
                关联 {{ stats.media_resource_total }} 条
              </n-text>
            </n-card>
          </n-gi>
          <n-gi span="4 s:2 m:1">
            <n-card size="small" class="stat-card">
              <div class="stat-icon accent-green"><n-icon size="20"><CloudDownloadOutline /></n-icon></div>
              <n-statistic label="网盘资源" :value="stats.resource_total" />
              <n-text depth="3" class="hint">
                <template v-if="validRate !== null">有效率 {{ validRate }}%</template>
                <template v-else>尚未校验</template>
                <template v-if="stats.resource_orphan > 0">
                  · {{ stats.resource_orphan }} 条未归属
                </template>
              </n-text>
            </n-card>
          </n-gi>
        </n-grid>

        <n-grid :cols="2" :x-gap="12" :y-gap="12" class="mt" item-responsive responsive="screen">
          <n-gi span="2 m:1">
            <n-card size="small" title="原始文本解析状态">
              <BreakdownList
                :rows="rows(stats.raw_by_status, PARSE_STATUS_LABEL)"
                :colors="PARSE_STATUS_COLOR"
              />
            </n-card>
          </n-gi>
          <n-gi span="2 m:1">
            <n-card size="small" title="资源校验状态">
              <BreakdownList
                :rows="rows(stats.resource_by_check, CHECK_STATUS_LABEL)"
                :colors="CHECK_STATUS_COLOR"
              />
            </n-card>
          </n-gi>
          <n-gi span="2 m:1">
            <n-card size="small" title="按网盘分布">
              <BreakdownList
                :rows="rows(stats.resource_by_provider, PROVIDER_LABEL)"
                :colors="PROVIDER_COLOR"
              />
            </n-card>
          </n-gi>
          <n-gi span="2 m:1">
            <n-card size="small" title="作品类型分布">
              <BreakdownList
                :rows="rows(stats.media_by_type, MEDIA_TYPE_LABEL)"
                :colors="MEDIA_TYPE_COLOR"
              />
            </n-card>
          </n-gi>
          <n-gi span="2 m:1">
            <n-card size="small" title="抽取器用量">
              <BreakdownList :rows="rows(stats.extraction_by_model)" />
            </n-card>
          </n-gi>
          <n-gi span="2 m:1">
            <n-card size="small" title="其他">
              <div class="kv"><span>抽取留档</span><strong>{{ stats.extraction_total }}</strong></div>
              <div class="kv">
                <span>作品↔资源关联</span><strong>{{ stats.media_resource_total }}</strong>
              </div>
              <div class="kv"><span>校验历史</span><strong>{{ stats.check_total }}</strong></div>
            </n-card>
          </n-gi>
        </n-grid>
      </template>
    </n-spin>
  </div>
</template>

<style scoped>
.head {
  margin-bottom: 16px;
}
.title {
  margin: 0;
}
.mt {
  margin-top: 12px;
}
.hint {
  font-size: 12px;
}
.kv {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}
.stat-card {
  position: relative;
  transition: box-shadow 0.15s var(--ease), transform 0.15s var(--ease);
}
.stat-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}
.stat-icon {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}
.accent-blue {
  color: #2b7fff;
  background: rgba(43, 127, 255, 0.12);
}
.accent-amber {
  color: #d68f00;
  background: rgba(214, 143, 0, 0.14);
}
.accent-purple {
  color: #6d5ef8;
  background: rgba(109, 94, 248, 0.14);
}
.accent-green {
  color: #18a058;
  background: rgba(24, 160, 88, 0.14);
}
.stat-card :deep(.n-statistic-value) {
  font-size: 26px;
  font-weight: 700;
}
</style>
