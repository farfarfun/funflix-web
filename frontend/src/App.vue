<script setup lang="ts">
import type { GlobalThemeOverrides } from 'naive-ui'
import { darkTheme, dateZhCN, zhCN } from 'naive-ui'
import { computed, ref, watchEffect } from 'vue'

import AppShell from '@/components/AppShell.vue'

const STORAGE_KEY = 'funflix.theme'

// 媒体站默认深色（Netflix/Plex/Jellyfin 都是），只有用户明确存过「浅色」才用浅色
const storedTheme = localStorage.getItem(STORAGE_KEY)
const dark = ref(storedTheme ? storedTheme === 'dark' : true)
const theme = computed(() => (dark.value ? darkTheme : null))

// 海报网格/详情页 hero 是自绘区域，拿不到 naive-ui 的主题变量，
// 靠这个 class 驱动 tokens.css 里的 --bg-canvas 等自定义变量切换
watchEffect(() => {
  document.documentElement.classList.toggle('dark', dark.value)
})

function toggleTheme() {
  dark.value = !dark.value
  localStorage.setItem(STORAGE_KEY, dark.value ? 'dark' : 'light')
}

// 靛紫主色替换 naive-ui 默认蓝，圆角统一放大一档，浅色/深色共用一套梯度。
const PRIMARY = '#6D5EF8'
const PRIMARY_HOVER = '#7C6FFA'
const PRIMARY_PRESSED = '#5B4EE5'
const PRIMARY_SUPPRESSED = 'rgba(109, 94, 248, 0.16)'

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: PRIMARY,
    primaryColorHover: PRIMARY_HOVER,
    primaryColorPressed: PRIMARY_PRESSED,
    primaryColorSuppl: PRIMARY_SUPPRESSED,
    borderRadius: '10px',
    borderRadiusSmall: '6px',
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  },
  Card: { borderRadius: '14px' },
  Button: { borderRadiusMedium: '8px', borderRadiusSmall: '6px', borderRadiusTiny: '6px' },
  Input: { borderRadius: '8px' },
  Tag: { borderRadius: '6px' },
  Menu: {
    itemColorActive: PRIMARY_SUPPRESSED,
    itemColorActiveHover: PRIMARY_SUPPRESSED,
    itemTextColorActive: PRIMARY,
    itemTextColorActiveHover: PRIMARY,
    itemIconColorActive: PRIMARY,
    itemIconColorActiveHover: PRIMARY,
    borderRadius: '8px',
  },
}
</script>

<template>
  <!-- message / dialog 的 use* 组合式 API 要求调用方在对应 Provider 内部，
       所以真正的界面放在 AppShell 里，这一层只负责套 Provider。 -->
  <n-config-provider :theme="theme" :theme-overrides="themeOverrides" :locale="zhCN" :date-locale="dateZhCN">
    <n-global-style />
    <n-loading-bar-provider>
      <n-dialog-provider>
        <n-message-provider>
          <AppShell :dark="dark" @toggle-theme="toggleTheme" />
        </n-message-provider>
      </n-dialog-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>
