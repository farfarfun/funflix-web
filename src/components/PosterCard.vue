<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import type { MediaSummary } from '@/api/types'
import { MEDIA_TYPE_COLOR, MEDIA_TYPE_ICON, MEDIA_TYPE_LABEL } from '@/utils/display'

defineProps<{ item: MediaSummary }>()

// 封面图挂了（链接失效、跨域）就退回图标占位，别留一个破图标在格子里
const broken = ref(false)
</script>

<template>
  <RouterLink :to="{ name: 'media-detail', params: { id: item.id } }" class="poster-card">
    <div
      class="poster"
      :style="{ background: `linear-gradient(155deg, ${MEDIA_TYPE_COLOR[item.media_type]}33, ${MEDIA_TYPE_COLOR[item.media_type]}10)` }"
    >
      <img
        v-if="item.poster_url && !broken"
        class="poster-img"
        :src="item.poster_url"
        :alt="item.title"
        loading="lazy"
        @error="broken = true"
      />
      <n-icon v-else :size="40" :color="MEDIA_TYPE_COLOR[item.media_type]">
        <component :is="MEDIA_TYPE_ICON[item.media_type]" />
      </n-icon>

      <div v-if="item.valid_resource_count > 0" class="badge">{{ item.valid_resource_count }} 可用</div>

      <div class="scrim">
        <div class="scrim-title" :title="item.title">{{ item.title }}</div>
        <div class="scrim-meta">
          <span>{{ MEDIA_TYPE_LABEL[item.media_type] }}</span>
          <span v-if="item.year">· {{ item.year }}</span>
          <span class="scrim-count">· {{ item.resource_count }} 条</span>
        </div>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.poster-card {
  display: block;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}
.poster {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--poster-surface);
  box-shadow: var(--shadow-sm);
  transition: transform 0.18s var(--ease), box-shadow 0.18s var(--ease);
}
.poster-card:hover .poster {
  transform: translateY(-4px) scale(1.015);
  box-shadow: var(--shadow-lg);
}
.poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: rgba(24, 160, 88, 0.88);
  backdrop-filter: blur(4px);
}
.scrim {
  position: absolute;
  inset: auto 0 0 0;
  padding: 24px 10px 10px;
  background: linear-gradient(to top, var(--scrim-strong) 0%, var(--scrim-strong) 15%, transparent 100%);
  color: #fff;
}
.scrim-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}
.scrim-meta {
  margin-top: 4px;
  font-size: 11px;
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.scrim-count {
  opacity: 0.75;
}
</style>
