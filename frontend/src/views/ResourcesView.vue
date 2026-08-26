<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { hasAdminKey } from '@/api/auth'
import { api } from '@/api/client'
import type { CheckStatus, Provider } from '@/api/types'
import ResourceTable from '@/components/ResourceTable.vue'
import { usePagedList } from '@/composables/usePagedList'
import { CHECK_STATUS_LABEL, PROVIDER_LABEL, toOptions } from '@/utils/display'

const provider = ref<Provider | null>(null)
const checkStatus = ref<CheckStatus | null>(null)

const { items, total, page, size, loading, error, refresh, goto, reload } = usePagedList(
  (p, s) =>
    api.listResources({
      provider: provider.value,
      check_status: checkStatus.value,
      page: p,
      size: s,
    }),
  30,
)

watch([provider, checkStatus], () => {
  if (hasAdminKey.value) reload()
})

// 没有密钥时不发请求：后端必然 403，发出去只会在控制台留一条毫无信息量的报错，
// 页面上该显示的是「怎么解决」而不是「失败了」。
onMounted(() => {
  if (hasAdminKey.value) void refresh()
})
watch(hasAdminKey, (has) => {
  if (has) void refresh()
})
</script>

<template>
  <div class="page">
    <n-h2 class="title">网盘资源</n-h2>

    <n-alert v-if="!hasAdminKey" type="info" class="mb" title="需要管理密钥">
      这里是按链接维度的全量清单，用于排查「某个网盘是不是大面积失效了」，
      后端要求管理密钥（服务端的 <n-text code>FUNFLIX_ADMIN_API_KEY</n-text>）。
      在左下角「管理密钥」里填入后即可查看。浏览内容请走
      <n-button text type="primary" @click="$router.push({ name: 'media' })">作品检索</n-button>。
    </n-alert>

    <template v-else>
      <n-card size="small">
        <n-space align="center" :size="12" wrap>
          <n-select
            v-model:value="provider"
            :options="toOptions(PROVIDER_LABEL)"
            clearable
            placeholder="全部网盘"
            style="width: 150px"
          />
          <n-select
            v-model:value="checkStatus"
            :options="toOptions(CHECK_STATUS_LABEL)"
            clearable
            placeholder="全部校验状态"
            style="width: 170px"
          />
          <n-button size="small" @click="refresh">刷新</n-button>
          <n-text depth="3">共 {{ total }} 条</n-text>
        </n-space>
      </n-card>

      <n-alert v-if="error" type="error" class="mt">{{ error }}</n-alert>

      <div class="mt">
        <ResourceTable :resources="items" :loading="loading" />
      </div>
    </template>

    <n-pagination
      v-if="hasAdminKey && total > size"
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
.mb {
  margin-bottom: 16px;
}
.pager {
  margin-top: 20px;
  justify-content: center;
}
</style>
