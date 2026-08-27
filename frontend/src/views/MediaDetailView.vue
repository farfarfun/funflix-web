<script setup lang="ts">
import { ArrowBackOutline, CloudDownloadOutline } from '@vicons/ionicons5'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { api, ApiError } from '@/api/client'
import type { MediaDetail } from '@/api/types'
import ResourceTable from '@/components/ResourceTable.vue'
import { pageHeading } from '@/composables/usePageHeading'
import { formatTime, MEDIA_TYPE_COLOR, MEDIA_TYPE_LABEL } from '@/utils/display'

const route = useRoute()

const media = ref<MediaDetail | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const missing = ref(false)

async function load() {
  const id = Number(route.params.id)
  pageHeading.value = null
  if (!Number.isInteger(id)) {
    error.value = '无效的作品 ID'
    return
  }
  loading.value = true
  error.value = null
  missing.value = false
  try {
    media.value = await api.getMedia(id)
    pageHeading.value = media.value.title
    document.title = `${media.value.title} · funflix`
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
onUnmounted(() => {
  pageHeading.value = null
})
</script>

<template>
  <div class="page">
    <n-button text class="back" @click="$router.push({ name: 'media' })">
      <template #icon><n-icon><ArrowBackOutline /></n-icon></template>
      返回列表
    </n-button>

    <n-alert v-if="error" type="error">{{ error }}</n-alert>
    <n-result v-else-if="missing" status="404" title="作品不存在" description="它可能已被删除">
      <template #footer>
        <n-button @click="$router.push({ name: 'media' })">回到检索</n-button>
      </template>
    </n-result>

    <n-spin v-else :show="loading">
      <template v-if="media">
        <n-card
          size="small"
          class="header-card"
          :style="{ borderLeft: `3px solid ${MEDIA_TYPE_COLOR[media.media_type]}` }"
        >
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
        </n-card>

        <n-card size="small" title="详情" class="mt">
          <n-descriptions bordered size="small" :column="2" label-placement="left">
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
        </n-card>

        <n-card v-if="media.overview" size="small" title="简介" class="mt">
          {{ media.overview }}
        </n-card>

        <n-card size="small" class="mt">
          <template #header>
            <n-space align="center" :size="8">
              <n-icon size="16" color="#18a058"><CloudDownloadOutline /></n-icon>
              <span>网盘资源</span>
              <n-text depth="3" class="count">{{ media.resources.length }} 条</n-text>
            </n-space>
          </template>
          <ResourceTable :resources="media.resources" />
        </n-card>
      </template>
    </n-spin>
  </div>
</template>

<style scoped>
.back {
  margin-bottom: 12px;
}
.header-card :deep(.n-card__content) {
  padding-bottom: 4px;
}
.title {
  margin: 0 0 10px;
}
.tags {
  margin-bottom: 4px;
}
.mt {
  margin-top: 16px;
}
.count {
  font-size: 12px;
  font-weight: 400;
}
</style>
