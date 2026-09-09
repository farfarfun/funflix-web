<script setup lang="ts">
import { RefreshOutline, ShieldCheckmarkOutline } from '@vicons/ionicons5'
import { useMessage } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'

import { api } from '@/api/client'
import type { PipelineStats, Provider, ProviderVerifyReport } from '@/api/types'
import { PROVIDER_COLOR, PROVIDER_LABEL } from '@/utils/display'

const message = useMessage()
const stats = ref<PipelineStats | null>(null)
const checkableProviders = ref(new Set<Provider>())
const capability = ref<'checkable' | 'unsupported' | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

interface ProviderRow {
  provider: Provider
  label: string
  total: number
  valid: number
  unchecked: number
  invalid: number
  other: number
  validRate: number | null
  checkable: boolean
}

const rows = computed<ProviderRow[]>(() => {
  const breakdown = stats.value?.resource_by_provider_check ?? {}
  return Object.entries(breakdown)
    .map(([key, buckets]) => {
      const provider = key as Provider
      const concluded = (buckets.valid ?? 0) + (buckets.invalid ?? 0)
      return {
        provider,
        label: PROVIDER_LABEL[provider] ?? key,
        total: buckets.total ?? 0,
        valid: buckets.valid ?? 0,
        unchecked: buckets.unchecked ?? 0,
        invalid: buckets.invalid ?? 0,
        other: buckets.other ?? 0,
        validRate: concluded > 0 ? Math.round(((buckets.valid ?? 0) / concluded) * 100) : null,
        checkable: checkableProviders.value.has(provider),
      }
    })
    .sort((a, b) => b.total - a.total)
})

const filteredRows = computed(() => {
  if (capability.value === null) return rows.value
  const checkable = capability.value === 'checkable'
  return rows.value.filter((row) => row.checkable === checkable)
})

async function refresh(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const [nextStats, checkable] = await Promise.all([api.getStats(), api.checkableProviders()])
    stats.value = nextStats
    checkableProviders.value = new Set(checkable)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

// --- 当前表格多选：不支持校验的网盘不可选 ---
const selectedProviders = ref<Provider[]>([])
const selectedRows = computed(() => {
  const selected = new Set(selectedProviders.value)
  return rows.value.filter((row) => row.checkable && selected.has(row.provider))
})
const selectableRows = computed(() => filteredRows.value.filter((row) => row.checkable))
const allSelected = computed(
  () =>
    selectableRows.value.length > 0 &&
    selectableRows.value.every((row) => selectedProviders.value.includes(row.provider)),
)
const partlySelected = computed(
  () =>
    !allSelected.value &&
    selectableRows.value.some((row) => selectedProviders.value.includes(row.provider)),
)

function toggleSelected(provider: Provider, checked: boolean): void {
  const selected = new Set(selectedProviders.value)
  checked ? selected.add(provider) : selected.delete(provider)
  selectedProviders.value = [...selected]
}

function toggleAll(checked: boolean): void {
  const selected = new Set(selectedProviders.value)
  for (const row of selectableRows.value) {
    checked ? selected.add(row.provider) : selected.delete(row.provider)
  }
  selectedProviders.value = [...selected]
}

watch(capability, () => {
  selectedProviders.value = []
})

// --- 手动校验队列：不同网盘最多四路并发 ---
const operationQueue: ProviderRow[] = []
const pendingProviders = ref(new Set<Provider>())
const queuedOperations = ref(0)
const runningOperations = ref(0)

function describe(report: ProviderVerifyReport): string {
  return report.claimed === 0
    ? '没有可校验资源'
    : `校验 ${report.claimed} 条，成功 ${report.succeeded}，失败 ${report.failed}`
}

function queueVerify(row: ProviderRow): boolean {
  if (!row.checkable || pendingProviders.value.has(row.provider)) return false
  operationQueue.push(row)
  pendingProviders.value = new Set(pendingProviders.value).add(row.provider)
  queuedOperations.value = operationQueue.length
  drainQueue()
  return true
}

function drainQueue(): void {
  while (runningOperations.value < 4) {
    const row = operationQueue.shift()
    if (!row) return
    queuedOperations.value = operationQueue.length
    runningOperations.value += 1
    void executeVerify(row)
  }
}

async function executeVerify(row: ProviderRow): Promise<void> {
  try {
    const report = await api.verifyProvider(row.provider)
    message.success(`${row.label}：${describe(report)}`)
  } catch (e) {
    message.error(`${row.label}：校验失败，${e instanceof Error ? e.message : String(e)}`)
  } finally {
    const pending = new Set(pendingProviders.value)
    pending.delete(row.provider)
    pendingProviders.value = pending
    runningOperations.value -= 1
    drainQueue()
  }
}

function queueSelected(): void {
  let added = 0
  for (const row of selectedRows.value) added += Number(queueVerify(row))
  message.info(added > 0 ? `已加入 ${added} 个校验操作` : '所选网盘已在队列中')
}

function cancelQueuedOperations(): void {
  const canceled = operationQueue.splice(0)
  const pending = new Set(pendingProviders.value)
  for (const row of canceled) pending.delete(row.provider)
  pendingProviders.value = pending
  queuedOperations.value = 0
  message.info(`已取消 ${canceled.length} 个等待操作`)
}

onMounted(() => void refresh())
</script>

<template>
  <div class="page">
    <n-space align="center" justify="space-between" class="head">
      <n-space align="center" :size="8">
        <n-icon size="22" color="#18a058"><ShieldCheckmarkOutline /></n-icon>
        <n-h2 class="title">网盘管理</n-h2>
      </n-space>
      <n-button size="small" :loading="loading" @click="refresh">
        <template #icon><n-icon><RefreshOutline /></n-icon></template>
        刷新
      </n-button>
    </n-space>

    <n-card size="small" class="mb">
      <n-space align="center" :size="12" wrap>
        <n-select
          v-model:value="capability"
          :options="[
            { label: '支持校验', value: 'checkable' },
            { label: '不支持校验', value: 'unsupported' },
          ]"
          clearable
          placeholder="全部校验能力"
          style="width: 160px"
        />
        <n-text depth="3">共 {{ filteredRows.length }} 个网盘</n-text>
      </n-space>
    </n-card>

    <n-alert v-if="error" type="error" class="mb">{{ error }}</n-alert>

    <div
      v-if="selectedRows.length > 0 || runningOperations + queuedOperations > 0"
      class="operation-bar"
    >
      <n-space v-if="selectedRows.length > 0" align="center" :size="8">
        <n-text>已选 {{ selectedRows.length }} 个</n-text>
        <n-button size="tiny" @click="queueSelected">校验</n-button>
      </n-space>
      <n-space
        v-if="runningOperations + queuedOperations > 0"
        align="center"
        :size="8"
        class="queue-status"
      >
        <n-text depth="3" role="status" aria-live="polite">
          执行中 {{ runningOperations }}，等待 {{ queuedOperations }}
        </n-text>
        <n-button
          size="tiny"
          :disabled="queuedOperations === 0"
          aria-label="取消所有等待中的校验"
          @click="cancelQueuedOperations"
        >
          取消
        </n-button>
      </n-space>
    </div>

    <n-spin :show="loading" class="table-scroll">
      <n-empty
        v-if="!loading && filteredRows.length === 0"
        description="没有符合条件的网盘资源"
        class="empty"
      />
      <n-table v-else :single-line="false" size="small" class="provider-table">
        <thead>
          <tr>
            <th class="select-cell">
              <n-checkbox
                :checked="allSelected"
                :indeterminate="partlySelected"
                :disabled="selectableRows.length === 0"
                aria-label="选择所有支持校验的网盘"
                @update:checked="toggleAll"
              />
            </th>
            <th>网盘</th>
            <th>资源总量</th>
            <th>有效</th>
            <th>未校验</th>
            <th>失效</th>
            <th>其他</th>
            <th>有效率</th>
            <th>校验能力</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in filteredRows"
            :key="row.provider"
            :class="{
              'row-selected': selectedProviders.includes(row.provider),
              'row-unsupported': !row.checkable,
            }"
          >
            <td class="select-cell">
              <n-checkbox
                :checked="selectedProviders.includes(row.provider)"
                :disabled="!row.checkable"
                :aria-label="`选择 ${row.label}`"
                @update:checked="(checked: boolean) => toggleSelected(row.provider, checked)"
              />
            </td>
            <td>
              <span class="provider-name">
                <span
                  class="provider-dot"
                  :style="{ background: row.checkable ? PROVIDER_COLOR[row.provider] : '#9095a3' }"
                />
                {{ row.label }}
              </span>
            </td>
            <td class="number">{{ row.total }}</td>
            <td class="number status-valid">{{ row.valid }}</td>
            <td class="number">{{ row.unchecked }}</td>
            <td class="number status-invalid">{{ row.invalid }}</td>
            <td class="number">{{ row.other }}</td>
            <td class="number">{{ row.validRate === null ? '—' : `${row.validRate}%` }}</td>
            <td>
              <n-tag size="small" :type="row.checkable ? 'success' : 'default'">
                {{ row.checkable ? '支持' : '不支持' }}
              </n-tag>
            </td>
            <td>
              <n-tooltip :disabled="row.checkable">
                <template #trigger>
                  <span>
                    <n-button
                      size="tiny"
                      :disabled="!row.checkable"
                      :loading="pendingProviders.has(row.provider)"
                      :aria-label="`校验 ${row.label}`"
                      @click="queueVerify(row)"
                    >
                      校验
                    </n-button>
                  </span>
                </template>
                暂不支持校验
              </n-tooltip>
            </td>
          </tr>
        </tbody>
      </n-table>
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
.mb {
  margin-bottom: 16px;
}
.empty {
  padding: 48px 0;
}
.provider-table {
  min-width: 900px;
}
:deep(tbody tr:nth-child(even)) {
  background: rgba(128, 128, 128, 0.05);
}
:deep(tbody tr.row-selected) {
  background: color-mix(in srgb, var(--n-color-target, #6d5ef8) 8%, transparent);
}
:deep(tbody tr.row-unsupported .provider-name) {
  color: #9095a3;
}
.select-cell {
  width: 44px;
  text-align: center;
}
.provider-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  font-weight: 600;
}
.provider-dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
}
.number {
  font-variant-numeric: tabular-nums;
}
.status-valid {
  color: #18a058;
}
.status-invalid {
  color: #d03050;
}
.operation-bar {
  min-height: 44px;
  margin-bottom: 12px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--n-border-color, rgba(128, 128, 128, 0.24));
  border-radius: 4px;
}
.queue-status {
  flex: none;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 640px) {
  .operation-bar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
