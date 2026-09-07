<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import type { MediaSummary } from '@/api/types'
import { MEDIA_TYPE_COLOR, MEDIA_TYPE_ICON, MEDIA_TYPE_LABEL } from '@/utils/display'

defineProps<{ item: MediaSummary }>()

// 缩略图挂了就退回图标占位，跟 PosterCard 的降级逻辑一致
const broken = ref(false)
</script>

<template>
  <RouterLink :to="{ name: 'media-detail', params: { id: item.id } }" class="row">
    <div
      class="thumb"
      :style="{ background: `linear-gradient(155deg, ${MEDIA_TYPE_COLOR[item.media_type]}33, ${MEDIA_TYPE_COLOR[item.media_type]}10)` }"
    >
      <img
        v-if="item.poster_url && !broken"
        class="thumb-img"
        :src="item.poster_url"
        :alt="item.title"
        loading="lazy"
        @error="broken = true"
      />
      <n-icon v-else :size="20" :color="MEDIA_TYPE_COLOR[item.media_type]">
        <component :is="MEDIA_TYPE_ICON[item.media_type]" />
      </n-icon>
    </div>

    <div class="info">
      <div class="title" :title="item.title">{{ item.title }}</div>
      <div class="meta">
        <n-tag size="small" :color="{ color: `${MEDIA_TYPE_COLOR[item.media_type]}1a`, textColor: MEDIA_TYPE_COLOR[item.media_type], borderColor: 'transparent' }">
          {{ MEDIA_TYPE_LABEL[item.media_type] }}
        </n-tag>
        <span v-if="item.year">{{ item.year }}</span>
        <span>{{ item.resource_count }} 条资源</span>
        <span v-if="item.valid_resource_count > 0" class="valid">{{ item.valid_resource_count }} 可用</span>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: background 0.15s var(--ease);
}
.row:hover {
  background: var(--poster-surface);
}
.row + .row {
  border-top: 1px solid rgba(128, 128, 128, 0.1);
}
.thumb {
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.info {
  flex: 1;
  min-width: 0;
}
.title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  opacity: 0.65;
  white-space: nowrap;
  overflow: hidden;
}
.valid {
  color: #18a058;
  opacity: 1;
}
</style>
