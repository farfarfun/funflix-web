<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { api } from '@/api/client'
import type { PipelineStats } from '@/api/types'
import type { BreakdownRow } from '@/components/BreakdownList.vue'
import BreakdownList from '@/components/BreakdownList.vue'
import {
  CHECK_STATUS_LABEL,
  MEDIA_TYPE_LABEL,
  PARSE_STATUS_LABEL,
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
      <n-button size="small" :loading="loading" @click="load">刷新</n-button>
    </n-space>

    <n-alert v-if="error" type="error">{{ error }}</n-alert>

    <n-spin :show="loading">
      <template v-if="stats">
        <n-grid :cols="4" :x-gap="12" :y-gap="12" item-responsive responsive="screen">
          <n-gi span="4 s:2 m:1">
            <n-card size="small">
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
            <n-card size="small">
              <n-statistic label="原始文本" :value="stats.raw_total" />
              <n-text depth="3" class="hint">
                待解析 {{ stats.raw_by_status.pending ?? 0 }}
              </n-text>
            </n-card>
          </n-gi>
          <n-gi span="4 s:2 m:1">
            <n-card size="small">
              <n-statistic label="作品" :value="stats.media_total" />
              <n-text depth="3" class="hint">
                关联 {{ stats.media_resource_total }} 条
              </n-text>
            </n-card>
          </n-gi>
          <n-gi span="4 s:2 m:1">
            <n-card size="small">
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
              <BreakdownList :rows="rows(stats.raw_by_status, PARSE_STATUS_LABEL)" />
            </n-card>
          </n-gi>
          <n-gi span="2 m:1">
            <n-card size="small" title="资源校验状态">
              <BreakdownList :rows="rows(stats.resource_by_check, CHECK_STATUS_LABEL)" />
            </n-card>
          </n-gi>
          <n-gi span="2 m:1">
            <n-card size="small" title="按网盘分布">
              <BreakdownList :rows="rows(stats.resource_by_provider, PROVIDER_LABEL)" />
            </n-card>
          </n-gi>
          <n-gi span="2 m:1">
            <n-card size="small" title="作品类型分布">
              <BreakdownList :rows="rows(stats.media_by_type, MEDIA_TYPE_LABEL)" />
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
</style>
