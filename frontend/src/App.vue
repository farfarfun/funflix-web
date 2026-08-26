<script setup lang="ts">
import { darkTheme, dateZhCN, zhCN } from 'naive-ui'
import { computed, ref } from 'vue'

import AppShell from '@/components/AppShell.vue'

const STORAGE_KEY = 'funflix.theme'

const dark = ref(localStorage.getItem(STORAGE_KEY) === 'dark')
const theme = computed(() => (dark.value ? darkTheme : null))

function toggleTheme() {
  dark.value = !dark.value
  localStorage.setItem(STORAGE_KEY, dark.value ? 'dark' : 'light')
}
</script>

<template>
  <!-- message / dialog 的 use* 组合式 API 要求调用方在对应 Provider 内部，
       所以真正的界面放在 AppShell 里，这一层只负责套 Provider。 -->
  <n-config-provider :theme="theme" :locale="zhCN" :date-locale="dateZhCN">
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
