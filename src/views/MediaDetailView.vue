<script setup lang="ts">
import { ArrowBackOutline, CloudDownloadOutline } from '@vicons/ionicons5'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { api, ApiError } from '@/api/client'
import type { MediaDetail } from '@/api/types'
import ResourceTable from '@/components/ResourceTable.vue'
import { pageHeading } from '@/composables/usePageHeading'
import { formatTime, MEDIA_TYPE_COLOR, MEDIA_TYPE_ICON, MEDIA_TYPE_LABEL } from '@/utils/display'

const route = useRoute()

const media = ref<MediaDetail | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const missing = ref(false)
const posterBroken = ref(false)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function load() {
  const id = String(route.params.id)
  pageHeading.value = null
  if (!UUID_RE.test(id)) {
    error.value = '无效的作品 ID'
    return
  }
  loading.value = true
  error.value = null
  missing.value = false
  posterBroken.value = false
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
        <!-- backdrop hero：拿海报模糊放大当背景，没有海报就退回按类型上色的渐变——
             与列表页 PosterCard 的空图占位是同一套配色逻辑，风格统一 -->
        <div
          class="hero"
          :style="
            !media.poster_url || posterBroken
              ? { background: `linear-gradient(155deg, ${MEDIA_TYPE_COLOR[media.media_type]}70, ${MEDIA_TYPE_COLOR[media.media_type]}20)` }
              : {}
          "
        >
          <img
            v-if="media.poster_url && !posterBroken"
            class="hero-bg"
            :src="media.poster_url"
            alt=""
            @error="posterBroken = true"
          />
          <div class="hero-scrim" />
          <div class="hero-content">
            <div class="hero-poster">
              <img v-if="media.poster_url && !posterBroken" :src="media.poster_url" :alt="media.title" />
              <n-icon v-else :size="36" :color="MEDIA_TYPE_COLOR[media.media_type]">
                <component :is="MEDIA_TYPE_ICON[media.media_type]" />
              </n-icon>
            </div>
            <div class="hero-info">
              <h1 class="hero-title">{{ media.title }}</h1>
              <div class="hero-tags">
                <span class="tag tag-type" :style="{ background: MEDIA_TYPE_COLOR[media.media_type] }">
                  {{ MEDIA_TYPE_LABEL[media.media_type] }}
                </span>
                <span v-if="media.year" class="tag">{{ media.year }}</span>
                <span v-for="t in media.tags" :key="t.id" class="tag">{{ t.name }}</span>
              </div>
              <div class="hero-summary">
                {{ media.resource_count }} 条资源
                <span v-if="media.valid_resource_count > 0">· {{ media.valid_resource_count }} 条可用</span>
              </div>
            </div>
          </div>
        </div>

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
.hero {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  min-height: 280px;
  display: flex;
  align-items: flex-end;
  background-color: var(--poster-surface);
}
.hero-bg {
  position: absolute;
  inset: -24px;
  width: calc(100% + 48px);
  height: calc(100% + 48px);
  object-fit: cover;
  filter: blur(36px) brightness(0.85);
  transform: scale(1.08);
}
.hero-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 0%, var(--scrim-soft) 45%, var(--scrim-strong) 100%);
}
.hero-content {
  position: relative;
  z-index: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  gap: 20px;
  padding: 24px;
  color: #fff;
}
.hero-poster {
  flex: none;
  width: 110px;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-sm);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}
.hero-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hero-info {
  flex: 1;
  min-width: 0;
  padding-bottom: 2px;
}
.hero-title {
  margin: 0 0 10px;
  font-size: 26px;
  line-height: 1.3;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
}
.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.tag {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(4px);
}
.tag-type {
  font-weight: 600;
  color: #fff;
}
.hero-summary {
  font-size: 13px;
  opacity: 0.85;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}
.mt {
  margin-top: 16px;
}
.count {
  font-size: 12px;
  font-weight: 400;
}

@media (max-width: 640px) {
  .hero {
    min-height: 0;
  }
  .hero-content {
    flex-direction: column;
    align-items: flex-start;
  }
  .hero-poster {
    width: 88px;
  }
}
</style>
