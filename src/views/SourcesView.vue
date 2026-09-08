<script setup lang="ts">
import {
  AddOutline,
  CloudUploadOutline,
  EllipsisHorizontalOutline,
  RefreshOutline,
} from '@vicons/ionicons5'
import type { DropdownOption } from 'naive-ui'
import { useDialog, useMessage } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'

import { api } from '@/api/client'
import type { CollectReport, ParseReport, Source, SourceType } from '@/api/types'
import { formatTime, fromNow, shortId, SOURCE_TYPE_LABEL, toOptions } from '@/utils/display'

const message = useMessage()
const dialog = useDialog()

const sourceType = ref<SourceType | null>(null)
const enabledFilter = ref<'true' | 'false' | null>(null)
const enabledOptions: { label: string; value: 'true' | 'false' }[] = [
  { label: '已启用', value: 'true' },
  { label: '已停用', value: 'false' },
]

// 采集源是人工登记的清单，量级小；为了让排序覆盖全部匹配结果而不是只在当前页
// 内瞎排，这里干脆把符合筛选条件的全量拉回来，排序、分页都在前端做——省得
// 为了给后端加排序参数，还要把统计字段（原始文本数等）本来的聚合子查询改成
// 参与 order_by/limit，得不偿失。
const PAGE_FETCH_SIZE = 200

const allSources = ref<Source[]>([])
const total = computed(() => allSources.value.length)
const page = ref(1)
const size = ref(20)
const loading = ref(false)
const error = ref<string | null>(null)

async function refresh(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const collected: Source[] = []
    let p = 1
    for (;;) {
      const data = await api.listSources({
        source_type: sourceType.value,
        enabled: enabledFilter.value === null ? null : enabledFilter.value === 'true',
        page: p,
        size: PAGE_FETCH_SIZE,
      })
      collected.push(...data.items)
      if (data.items.length === 0 || collected.length >= data.total) break
      p += 1
    }
    allSources.value = collected
    const currentIds = new Set(collected.map((source) => source.id))
    selectedIds.value = selectedIds.value.filter((id) => currentIds.has(id))
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    allSources.value = []
  } finally {
    loading.value = false
  }
}

/** 换页：纯前端分页，不重新拉取。 */
function goto(next: number): void {
  page.value = next
}

/** 改筛选条件后调用：回到第一页，否则会停在一个可能不存在的页码上。 */
function reload(): void {
  page.value = 1
  selectedIds.value = []
  void refresh()
}

function setSize(next: number): void {
  size.value = next
  page.value = 1
}

watch([sourceType, enabledFilter], reload)

// --- 表头点击排序：对全量数据排序（见上面 allSources），不受分页影响 ---
type SortKey =
  | 'id'
  | 'source_type'
  | 'identifier'
  | 'cursor'
  | 'total_collected'
  | 'raw_total'
  | 'raw_parsed'
  | 'resource_total'
  | 'last_fetched_at'
  | 'enabled'

const sortKey = ref<SortKey | null>(null)
const sortOrder = ref<'asc' | 'desc'>('asc')

// 已解析列展示成百分比（更好一眼看出转化效果），排序也按这个百分比走，
// 跟展示的数字保持一致——不然点了排序箭头，肉眼却看不出谁在前谁在后。
function parsedPercent(s: Source): number {
  if (s.raw_total === 0) return 0
  return Math.round((s.raw_parsed / s.raw_total) * 100)
}

const SORT_ACCESSOR: Record<SortKey, (s: Source) => string | number> = {
  id: (s) => s.id,
  source_type: (s) => s.source_type,
  identifier: (s) => s.title || s.identifier,
  cursor: (s) => s.cursor_message_id ?? '',
  total_collected: (s) => s.total_collected,
  raw_total: (s) => s.raw_total,
  raw_parsed: (s) => parsedPercent(s),
  resource_total: (s) => s.resource_total,
  last_fetched_at: (s) => s.last_fetched_at ?? '',
  enabled: (s) => (s.enabled ? 1 : 0),
}

const COLUMNS: { key: SortKey; label: string; width: string }[] = [
  { key: 'id', label: 'ID', width: '84px' },
  { key: 'source_type', label: '类型', width: '110px' },
  { key: 'identifier', label: '标识', width: 'auto' },
  { key: 'cursor', label: '水位', width: '90px' },
  { key: 'total_collected', label: '已采', width: '80px' },
  { key: 'raw_total', label: '原始文本', width: '90px' },
  { key: 'raw_parsed', label: '已解析', width: '130px' },
  { key: 'resource_total', label: '解析出资源', width: '100px' },
  { key: 'last_fetched_at', label: '最近采集', width: '120px' },
  { key: 'enabled', label: '启用', width: '74px' },
]

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }
  // 排序变了，原来第几页对应的是哪批数据也变了，回第一页避免停在错位的页码上
  page.value = 1
}

const sortedItems = computed(() => {
  if (sortKey.value === null) return allSources.value
  const accessor = SORT_ACCESSOR[sortKey.value]
  const dir = sortOrder.value === 'asc' ? 1 : -1
  return [...allSources.value].sort((a, b) => {
    const av = accessor(a)
    const bv = accessor(b)
    if (av < bv) return -dir
    if (av > bv) return dir
    return 0
  })
})

const pagedItems = computed(() => {
  const start = (page.value - 1) * size.value
  return sortedItems.value.slice(start, start + size.value)
})

// --- 多选 ---
const selectedIds = ref<string[]>([])
const selectedSources = computed(() => {
  const ids = new Set(selectedIds.value)
  return allSources.value.filter((source) => ids.has(source.id))
})
const allSelected = computed(
  () => allSources.value.length > 0 && selectedIds.value.length === allSources.value.length,
)
const partlySelected = computed(
  () => selectedIds.value.length > 0 && selectedIds.value.length < allSources.value.length,
)

function toggleSelected(id: string, checked: boolean): void {
  const ids = new Set(selectedIds.value)
  checked ? ids.add(id) : ids.delete(id)
  selectedIds.value = [...ids]
}

function toggleAll(checked: boolean): void {
  selectedIds.value = checked ? allSources.value.map((source) => source.id) : []
}

// --- 新增 ---
const showCreate = ref(false)
const creating = ref(false)
const newUrl = ref('')
const supported = ref<string[]>([])

async function create() {
  const url = newUrl.value.trim()
  if (!url) {
    message.warning('请填写采集源地址')
    return
  }
  creating.value = true
  try {
    // 只传 url，类型与标识由后端识别（如 https://t.me/s/Xxx → telegram / Xxx）
    await api.createSource({ url })
    message.success('已登记')
    showCreate.value = false
    newUrl.value = ''
    void refresh()
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e))
  } finally {
    creating.value = false
  }
}

// --- 异步操作队列：同一源串行，不同源最多四路并发 ---
type OperationKind = 'collect' | 'parse' | 'enable' | 'disable' | 'reset-cursor' | 'reset-parse' | 'delete'

interface OperationTask {
  key: string
  label: string
  sourceId: string
  sourceLabel: string
  run: () => Promise<string | undefined>
}

const operationQueue: OperationTask[] = []
const pendingOperationKeys = ref(new Set<string>())
const activeSourceIds = new Set<string>()
const queuedOperations = ref(0)
const runningOperations = ref(0)
let refreshTimer: ReturnType<typeof setTimeout> | null = null

function sourceLabel(source: Source): string {
  return source.title || source.identifier
}

function hasPending(source: Source, kind: OperationKind): boolean {
  return pendingOperationKeys.value.has(`${kind}:${source.id}`)
}

function scheduleRefresh(): void {
  if (refreshTimer !== null) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void refresh()
  }, 300)
}

function enqueueOperation(
  source: Source,
  kind: OperationKind,
  label: string,
  run: OperationTask['run'],
): boolean {
  const key = `${kind}:${source.id}`
  if (pendingOperationKeys.value.has(key)) return false
  operationQueue.push({ key, label, sourceId: source.id, sourceLabel: sourceLabel(source), run })
  pendingOperationKeys.value = new Set(pendingOperationKeys.value).add(key)
  queuedOperations.value = operationQueue.length
  drainQueue()
  return true
}

function drainQueue(): void {
  while (runningOperations.value < 4) {
    const index = operationQueue.findIndex((task) => !activeSourceIds.has(task.sourceId))
    if (index < 0) return
    const [task] = operationQueue.splice(index, 1)
    if (!task) return
    queuedOperations.value = operationQueue.length
    runningOperations.value += 1
    activeSourceIds.add(task.sourceId)
    void executeOperation(task)
  }
}

async function executeOperation(task: OperationTask): Promise<void> {
  try {
    const detail = await task.run()
    message.success(`${task.sourceLabel}：${task.label}完成${detail ? `，${detail}` : ''}`)
  } catch (e) {
    message.error(`${task.sourceLabel}：${task.label}失败，${e instanceof Error ? e.message : String(e)}`)
  } finally {
    const keys = new Set(pendingOperationKeys.value)
    keys.delete(task.key)
    pendingOperationKeys.value = keys
    activeSourceIds.delete(task.sourceId)
    runningOperations.value -= 1
    scheduleRefresh()
    drainQueue()
  }
}

function describe(r: CollectReport): string {
  return `拉取 ${r.fetched} 条，新增 ${r.created}，去重 ${r.duplicated}，无正文跳过 ${r.skipped_empty}`
}

function queueCollect(source: Source): boolean {
  return enqueueOperation(source, 'collect', '采集', async () => {
    const report = await api.collectSource(source.id)
    if (!report.ok) throw new Error(report.error ?? '采集失败')
    return `${describe(report)}${report.truncated ? '，仍有内容待采' : ''}`
  })
}

function queueResetCursor(source: Source): boolean {
  return enqueueOperation(source, 'reset-cursor', '重置水位', async () => {
    await api.resetSourceCursor(source.id)
    return undefined
  })
}

function confirmResetCursor(source: Source) {
  dialog.warning({
    title: '重置采集水位',
    content: `确定重置 ${sourceLabel(source)}？已有原始文本不会删除。`,
    positiveText: '重置',
    negativeText: '取消',
    onPositiveClick: () => queueResetCursor(source),
  })
}

function describeParse(r: ParseReport): string {
  return `解析 ${r.claimed} 条，成功 ${r.succeeded}，失败 ${r.failed}`
}

function queueParse(source: Source): boolean {
  return enqueueOperation(source, 'parse', '解析', async () => {
    const report = await api.parseSource(source.id)
    return report.claimed === 0
      ? '没有待解析文本'
      : `${describeParse(report)}${report.remaining_pending > 0 ? `，剩余 ${report.remaining_pending} 条` : ''}`
  })
}

function queueResetParse(source: Source): boolean {
  return enqueueOperation(source, 'reset-parse', '重置解析', async () => {
    const count = await api.resetSourceParse(source.id)
    return `${count} 条原始文本已重新入队`
  })
}

function confirmResetParse(source: Source) {
  dialog.warning({
    title: '重置解析标记',
    content: `确定重置 ${sourceLabel(source)}？该源的原始文本将使用当前规则重新解析。`,
    positiveText: '重置解析',
    negativeText: '取消',
    onPositiveClick: () => queueResetParse(source),
  })
}

function queueToggle(source: Source, enabled: boolean): boolean {
  const kind = enabled ? 'enable' : 'disable'
  return enqueueOperation(source, kind, enabled ? '启用' : '停用', async () => {
    await api.updateSource(source.id, { enabled })
    return undefined
  })
}

const rowMenuOptions: DropdownOption[] = [
  { label: '重置水位', key: 'reset-cursor' },
  { label: '重置解析', key: 'reset-parse' },
  { type: 'divider', key: 'divider' },
  { label: '删除', key: 'delete' },
]

function onRowMenuSelect(key: string, source: Source) {
  if (key === 'reset-cursor') confirmResetCursor(source)
  else if (key === 'reset-parse') confirmResetParse(source)
  else if (key === 'delete') confirmRemove(source)
}

function queueRemove(source: Source): boolean {
  return enqueueOperation(source, 'delete', '删除', async () => {
    await api.deleteSource(source.id)
    return undefined
  })
}

function confirmRemove(source: Source) {
  dialog.warning({
    title: '删除采集源',
    content: `确定删除 ${sourceLabel(source)}？已采集的原始文本会保留。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => queueRemove(source),
  })
}

type BulkAction = OperationKind

const bulkMenuOptions: DropdownOption[] = [
  { label: '重置水位', key: 'reset-cursor' },
  { label: '重置解析', key: 'reset-parse' },
  { type: 'divider', key: 'divider' },
  { label: '删除', key: 'delete' },
]

function queueSelected(action: BulkAction): void {
  let added = 0
  for (const source of selectedSources.value) {
    const queued =
      action === 'collect'
        ? queueCollect(source)
        : action === 'parse'
          ? queueParse(source)
          : action === 'enable'
            ? queueToggle(source, true)
            : action === 'disable'
              ? queueToggle(source, false)
              : action === 'reset-cursor'
                ? queueResetCursor(source)
                : action === 'reset-parse'
                  ? queueResetParse(source)
                  : queueRemove(source)
    added += Number(queued)
  }
  message.info(added > 0 ? `已加入 ${added} 个操作` : '所选操作已在队列中')
}

function confirmSelected(action: 'reset-cursor' | 'reset-parse' | 'delete'): void {
  const labels = {
    'reset-cursor': ['重置采集水位', '重置水位'],
    'reset-parse': ['重置解析标记', '重置解析'],
    delete: ['删除采集源', '删除'],
  } as const
  const [title, positiveText] = labels[action]
  dialog.warning({
    title,
    content: `确定对选中的 ${selectedSources.value.length} 个采集源执行“${positiveText}”？`,
    positiveText,
    negativeText: '取消',
    onPositiveClick: () => queueSelected(action),
  })
}

function onBulkMenuSelect(key: string): void {
  if (key === 'reset-cursor' || key === 'reset-parse' || key === 'delete') confirmSelected(key)
}

onMounted(async () => {
  void refresh()
  try {
    supported.value = await api.supportedSourceTypes()
  } catch {
    // 只是给新增弹窗做个提示，取不到不影响主流程
  }
})
</script>

<template>
  <div class="page">
    <n-space align="center" justify="space-between" class="head">
      <n-space align="center" :size="8">
        <n-icon size="22" color="#2b7fff"><CloudUploadOutline /></n-icon>
        <n-h2 class="title">采集源</n-h2>
      </n-space>
      <n-space>
        <n-button size="small" @click="refresh">
          <template #icon><n-icon><RefreshOutline /></n-icon></template>
          刷新
        </n-button>
        <n-button size="small" type="primary" @click="showCreate = true">
          <template #icon><n-icon><AddOutline /></n-icon></template>
          登记采集源
        </n-button>
      </n-space>
    </n-space>

    <n-card size="small" class="mb">
      <n-space align="center" :size="12" wrap>
        <n-select
          v-model:value="sourceType"
          :options="toOptions(SOURCE_TYPE_LABEL)"
          clearable
          placeholder="全部类型"
          style="width: 150px"
        />
        <n-select
          v-model:value="enabledFilter"
          :options="enabledOptions"
          clearable
          placeholder="全部状态"
          style="width: 130px"
        />
        <n-text depth="3">共 {{ total }} 个</n-text>
      </n-space>
    </n-card>

    <n-alert v-if="error" type="error" class="mb">{{ error }}</n-alert>

    <div
      v-if="selectedSources.length > 0 || runningOperations + queuedOperations > 0"
      class="operation-bar"
    >
      <n-space v-if="selectedSources.length > 0" align="center" :size="8" wrap>
        <n-text>已选 {{ selectedSources.length }} 个</n-text>
        <n-button size="tiny" @click="queueSelected('collect')">采集</n-button>
        <n-button size="tiny" @click="queueSelected('parse')">解析</n-button>
        <n-button size="tiny" @click="queueSelected('enable')">启用</n-button>
        <n-button size="tiny" @click="queueSelected('disable')">停用</n-button>
        <n-dropdown trigger="click" :options="bulkMenuOptions" @select="onBulkMenuSelect">
          <n-button size="tiny">
            更多
            <template #icon><n-icon><EllipsisHorizontalOutline /></n-icon></template>
          </n-button>
        </n-dropdown>
      </n-space>
      <n-text
        v-if="runningOperations + queuedOperations > 0"
        depth="3"
        class="queue-status"
        role="status"
        aria-live="polite"
      >
        执行中 {{ runningOperations }}，等待 {{ queuedOperations }}
      </n-text>
    </div>

    <n-spin :show="loading" class="table-scroll">
      <n-empty v-if="!loading && allSources.length === 0" description="还没有采集源" class="empty">
        <template #extra>
          <n-button size="small" @click="showCreate = true">登记第一个</n-button>
        </template>
      </n-empty>

      <n-table v-else :single-line="false" size="small">
        <thead>
          <tr>
            <th class="select-cell">
              <n-checkbox
                :checked="allSelected"
                :indeterminate="partlySelected"
                aria-label="选择所有筛选结果"
                @update:checked="toggleAll"
              />
            </th>
            <th
              v-for="col in COLUMNS"
              :key="col.key"
              :style="{ width: col.width }"
              :aria-sort="
                sortKey === col.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined
              "
            >
              <button type="button" class="sortable" @click="toggleSort(col.key)">
                {{ col.label }}
                <span aria-hidden="true" class="sort-arrow" :class="{ active: sortKey === col.key }">
                  {{ sortKey === col.key && sortOrder === 'desc' ? '▼' : '▲' }}
                </span>
              </button>
            </th>
            <th style="width: 200px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="s in pagedItems"
            :key="s.id"
            :class="{
              'row-failing': s.consecutive_failures > 0,
              'row-selected': selectedIds.includes(s.id),
            }"
          >
            <td class="select-cell">
              <n-checkbox
                :checked="selectedIds.includes(s.id)"
                :aria-label="`选择 ${sourceLabel(s)}`"
                @update:checked="(checked: boolean) => toggleSelected(s.id, checked)"
              />
            </td>
            <td><n-text code style="font-size: 11px" :title="s.id">{{ shortId(s.id) }}</n-text></td>
            <td>{{ SOURCE_TYPE_LABEL[s.source_type] ?? s.source_type }}</td>
            <td>
              <n-button text tag="a" :href="s.url" target="_blank" rel="noopener noreferrer">
                {{ s.title || s.identifier }}
              </n-button>
              <n-text v-if="s.last_error" type="error" class="err" :title="s.last_error">
                {{ s.consecutive_failures }} 次失败：{{ s.last_error }}
              </n-text>
            </td>
            <td>{{ s.cursor_message_id ?? '-' }}</td>
            <td>{{ s.total_collected }}</td>
            <td>{{ s.raw_total }}</td>
            <td>
              <n-tooltip>
                <template #trigger>
                  <div class="parsed-cell">
                    <n-progress
                      type="line"
                      :percentage="parsedPercent(s)"
                      :show-indicator="false"
                      :height="6"
                      :border-radius="3"
                      color="#6D5EF8"
                      class="bar"
                    />
                    <span class="pct">{{ parsedPercent(s) }}%</span>
                  </div>
                </template>
                {{ s.raw_parsed }} / {{ s.raw_total }}
              </n-tooltip>
            </td>
            <td>{{ s.resource_total }}</td>
            <td>
              <n-tooltip>
                <template #trigger><span>{{ fromNow(s.last_fetched_at) }}</span></template>
                最近成功：{{ formatTime(s.last_success_at) }}
              </n-tooltip>
            </td>
            <td>
              <n-switch
                size="small"
                :value="s.enabled"
                :loading="hasPending(s, 'enable') || hasPending(s, 'disable')"
                :aria-label="`${s.enabled ? '停用' : '启用'} ${sourceLabel(s)}`"
                @update:value="(v: boolean) => queueToggle(s, v)"
              />
            </td>
            <td>
              <n-space :size="4">
                <n-button
                  size="tiny"
                  :loading="hasPending(s, 'collect')"
                  @click="queueCollect(s)"
                >
                  采集
                </n-button>
                <n-button
                  size="tiny"
                  :loading="hasPending(s, 'parse')"
                  @click="queueParse(s)"
                >
                  解析
                </n-button>
                <n-dropdown
                  trigger="click"
                  :options="rowMenuOptions"
                  @select="(key: string) => onRowMenuSelect(key, s)"
                >
                  <n-button size="tiny" quaternary circle :aria-label="`${sourceLabel(s)} 更多操作`">
                    <template #icon><n-icon><EllipsisHorizontalOutline /></n-icon></template>
                  </n-button>
                </n-dropdown>
              </n-space>
            </td>
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
      show-quick-jumper
      show-size-picker
      :page-sizes="[10, 20, 50, 100]"
      @update:page="goto"
      @update:page-size="setSize"
    />

    <n-modal
      v-model:show="showCreate"
      preset="card"
      title="登记采集源"
      style="max-width: 520px"
    >
      <n-form-item label="采集源地址" :show-feedback="false">
        <n-input
          v-model:value="newUrl"
          placeholder="https://t.me/s/频道名"
          @keyup.enter="create"
        />
      </n-form-item>
      <n-text depth="3" class="hint">
        只需填地址，类型与标识会自动识别。当前支持：{{ supported.join('、') || '加载中…' }}
      </n-text>
      <template #footer>
        <n-space justify="end">
          <n-button size="small" @click="showCreate = false">取消</n-button>
          <n-button size="small" type="primary" :loading="creating" @click="create">
            登记
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
:deep(tbody tr:nth-child(even)) {
  background: rgba(128, 128, 128, 0.05);
}
:deep(tbody tr.row-failing) {
  box-shadow: inset 3px 0 0 #e88080;
}
:deep(tbody tr.row-selected) {
  background: color-mix(in srgb, var(--n-color-target, #6d5ef8) 8%, transparent);
}
.select-cell {
  width: 44px;
  text-align: center;
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
.parsed-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.parsed-cell .bar {
  flex: 1;
  min-width: 48px;
}
.parsed-cell .pct {
  flex: none;
  width: 36px;
  text-align: right;
  font-size: 12px;
  opacity: 0.8;
}
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
.err {
  display: block;
  font-size: 12px;
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sortable {
  appearance: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: inherit;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.sortable:hover {
  color: var(--n-primary-color, #6d5ef8);
}
.sort-arrow {
  font-size: 10px;
  opacity: 0.25;
}
.sort-arrow.active {
  opacity: 1;
}
.hint {
  font-size: 12px;
  display: block;
  margin-top: 8px;
}
.pager {
  margin-top: 20px;
  justify-content: center;
}

@media (pointer: coarse) {
  .sortable {
    min-height: 44px;
  }
}

@media (max-width: 640px) {
  .operation-bar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
