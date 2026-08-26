<script setup lang="ts">
import { useDialog, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'

import { hasAdminKey } from '@/api/auth'
import { api } from '@/api/client'
import type { CollectReport, Source } from '@/api/types'
import { usePagedList } from '@/composables/usePagedList'
import { formatTime, fromNow, SOURCE_TYPE_LABEL } from '@/utils/display'

const message = useMessage()
const dialog = useDialog()

const { items, total, page, size, loading, error, refresh, goto } = usePagedList(
  (p, s) => api.listSources({ page: p, size: s }),
  20,
)

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

// --- 采集 ---
const collecting = ref<number | null>(null)

function describe(r: CollectReport): string {
  return `拉取 ${r.fetched} 条，新增 ${r.created}，去重 ${r.duplicated}，无正文跳过 ${r.skipped_empty}`
}

async function collect(source: Source) {
  collecting.value = source.id
  try {
    const report = await api.collectSource(source.id)
    if (report.ok) {
      message.success(describe(report))
      if (report.truncated) {
        message.warning('撞到翻页上限，还有更早的新消息没取完，可再采一次')
      }
    } else {
      message.error(report.error ?? '采集失败')
    }
    void refresh()
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e))
  } finally {
    collecting.value = null
  }
}

// --- 启用 / 停用 ---
async function toggle(source: Source, enabled: boolean) {
  try {
    await api.updateSource(source.id, { enabled })
    message.success(enabled ? '已启用' : '已停用')
    void refresh()
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e))
    void refresh()
  }
}

// --- 删除 ---
function confirmRemove(source: Source) {
  dialog.warning({
    title: '删除采集源',
    content: `确定删除 ${source.identifier}？已采集的原始文本会保留。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.deleteSource(source.id)
        message.success('已删除')
        void refresh()
      } catch (e) {
        message.error(e instanceof Error ? e.message : String(e))
      }
    },
  })
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
      <n-h2 class="title">采集源</n-h2>
      <n-space>
        <n-button size="small" @click="refresh">刷新</n-button>
        <n-button size="small" type="primary" :disabled="!hasAdminKey" @click="showCreate = true">
          登记采集源
        </n-button>
      </n-space>
    </n-space>

    <n-alert v-if="!hasAdminKey" type="info" class="mb" title="当前为只读">
      登记、采集、启停与删除都需要管理密钥（服务端的
      <n-text code>FUNFLIX_ADMIN_API_KEY</n-text>）。在左下角「管理密钥」里填入后即可操作。
    </n-alert>

    <n-alert v-if="error" type="error" class="mb">{{ error }}</n-alert>

    <n-spin :show="loading">
      <n-empty v-if="!loading && items.length === 0" description="还没有采集源" class="empty">
        <template #extra>
          <n-button size="small" :disabled="!hasAdminKey" @click="showCreate = true">登记第一个</n-button>
        </template>
      </n-empty>

      <n-table v-else :single-line="false" size="small">
        <thead>
          <tr>
            <th style="width: 52px">#</th>
            <th style="width: 110px">类型</th>
            <th>标识</th>
            <th style="width: 90px">水位</th>
            <th style="width: 80px">已采</th>
            <th style="width: 120px">最近采集</th>
            <th style="width: 74px">启用</th>
            <th style="width: 150px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in items" :key="s.id">
            <td>{{ s.id }}</td>
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
                :disabled="!hasAdminKey"
                @update:value="(v: boolean) => toggle(s, v)"
              />
            </td>
            <td>
              <n-space :size="4">
                <n-button
                  size="tiny"
                  :loading="collecting === s.id"
                  :disabled="collecting !== null || !hasAdminKey"
                  @click="collect(s)"
                >
                  采集
                </n-button>
                <n-button size="tiny" type="error" quaternary :disabled="!hasAdminKey" @click="confirmRemove(s)">
                  删除
                </n-button>
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
      @update:page="goto"
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
.hint {
  font-size: 12px;
  display: block;
  margin-top: 8px;
}
.pager {
  margin-top: 20px;
  justify-content: center;
}
</style>
