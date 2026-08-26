<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { api, ApiError } from '@/api/client'
import type { MediaDetail } from '@/api/types'
import ResourceTable from '@/components/ResourceTable.vue'
import { formatTime, MEDIA_TYPE_LABEL } from '@/utils/display'

const route = useRoute()

const media = ref<MediaDetail | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const missing = ref(false)

async function load() {
  const id = Number(route.params.id)
  if (!Number.isInteger(id)) {
    error.value = '无效的作品 ID'
    return
  }
  loading.value = true
  error.value = null
  missing.value = false
  try {
    media.value = await api.getMedia(id)
  } catch (e) {
    media.value = null
    // 404 是「这部作品不存在」，与接口挂了是两回事，展示上要区分开
    if (e instanceof ApiError && e.status === 404) missing.value = true
    else error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => route.params.id, load)
</script>

<template>
  <div class="page">
    <n-button text class="back" @click="$router.push({ name: 'media' })">← 返回列表</n-button>

    <n-alert v-if="error" type="error">{{ error }}</n-alert>
    <n-result v-else-if="missing" status="404" title="作品不存在" description="它可能已被删除">
      <template #footer>
        <n-button @click="$router.push({ name: 'media' })">回到检索</n-button>
      </template>
    </n-result>

    <n-spin v-else :show="loading">
      <template v-if="media">
        <n-h2 class="title">{{ media.title }}</n-h2>

        <n-space :size="6" class="tags">
          <n-tag :bordered="false">{{ MEDIA_TYPE_LABEL[media.media_type] }}</n-tag>
          <n-tag v-if="media.year" :bordered="false" type="info">{{ media.year }}</n-tag>
          <n-tag
            v-for="t in media.tags"
            :key="t.id"
            :bordered="false"
            size="small"
            type="success"
          >
            {{ t.name }}
          </n-tag>
        </n-space>

        <n-descriptions
          class="meta"
          bordered
          size="small"
          :column="2"
          label-placement="left"
        >
          <n-descriptions-item label="原名">
            {{ media.original_title ?? '-' }}
          </n-descriptions-item>
          <n-descriptions-item label="归一键">{{ media.norm_key }}</n-descriptions-item>
          <n-descriptions-item label="别名">
            {{ media.aliases.length ? media.aliases.join('、') : '-' }}
          </n-descriptions-item>
          <n-descriptions-item label="资源数">
            {{ media.resource_count }} 条（{{ media.valid_resource_count }} 条可用）
          </n-descriptions-item>
          <n-descriptions-item label="入库时间">
            {{ formatTime(media.created_at) }}
          </n-descriptions-item>
          <n-descriptions-item label="更新时间">
            {{ formatTime(media.updated_at) }}
          </n-descriptions-item>
        </n-descriptions>

        <n-card v-if="media.overview" size="small" title="简介" class="mt">
          {{ media.overview }}
        </n-card>

        <n-h3 class="mt">网盘资源</n-h3>
        <ResourceTable :resources="media.resources" />
      </template>
    </n-spin>
  </div>
</template>

<style scoped>
.back {
  margin-bottom: 12px;
}
.title {
  margin: 0 0 10px;
}
.tags {
  margin-bottom: 16px;
}
.meta {
  margin-bottom: 8px;
}
.mt {
  margin-top: 20px;
}
</style>
