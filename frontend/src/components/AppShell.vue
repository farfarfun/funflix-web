<script setup lang="ts">
import type { MenuOption } from 'naive-ui'
import { computed, h, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { adminKey, hasAdminKey, setAdminKey } from '@/api/auth'

defineProps<{ dark: boolean }>()
defineEmits<{ toggleTheme: [] }>()

const route = useRoute()

// --- 管理密钥 ---
const showKey = ref(false)
const draftKey = ref('')

function openKeyDialog() {
  draftKey.value = adminKey.value
  showKey.value = true
}

function saveKey() {
  setAdminKey(draftKey.value)
  showKey.value = false
}

function link(name: string, label: string) {
  return () => h(RouterLink, { to: { name } }, { default: () => label })
}

// 网盘资源放在「运维」而不是「发现」：它是按链接维度的全量清单，
// 后端要求管理密钥才能读，用途是排查「某个网盘是不是大面积失效了」，
// 而不是给使用者浏览内容 —— 那条路径是作品检索。
const menuOptions: MenuOption[] = [
  { type: 'group', label: '发现', key: 'g-discover', children: [
    { label: link('media', '作品检索'), key: 'media' },
  ]},
  { type: 'group', label: '运维', key: 'g-ops', children: [
    { label: link('dashboard', '流水线大盘'), key: 'dashboard' },
    { label: link('sources', '采集源'), key: 'sources' },
    { label: link('raw', '原始文本'), key: 'raw' },
    { label: link('resources', '网盘资源'), key: 'resources' },
  ]},
]

// 详情页要让它所属的列表项保持高亮，否则进详情后侧栏看起来什么都没选中
const activeKey = computed(() => {
  const name = String(route.name ?? '')
  return name === 'media-detail' ? 'media' : name
})
</script>

<template>
  <n-layout has-sider position="absolute">
    <n-layout-sider bordered :width="200" content-style="display:flex;flex-direction:column">
      <div class="brand">
        <span class="brand-name">funflix</span>
        <span class="brand-sub">影视资源聚合</span>
      </div>
      <n-menu :value="activeKey" :options="menuOptions" :indent="18" />
      <div class="sider-footer">
        <n-button quaternary size="small" block @click="openKeyDialog">
          <n-badge :dot="!hasAdminKey" :offset="[4, -2]" type="warning">管理密钥</n-badge>
        </n-button>
        <n-button quaternary size="small" block @click="$emit('toggleTheme')">
          {{ dark ? '☾ 深色' : '☀ 浅色' }}
        </n-button>
        <n-button quaternary size="small" block tag="a" href="/docs" target="_blank">
          接口文档
        </n-button>
      </div>
    </n-layout-sider>

    <n-layout-content content-style="padding:24px" :native-scrollbar="false">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </n-layout-content>

    <n-modal v-model:show="showKey" preset="card" title="管理密钥" style="max-width: 480px">
      <n-form-item label="X-API-Key" :show-feedback="false">
        <n-input
          v-model:value="draftKey"
          type="password"
          show-password-on="click"
          placeholder="服务端 FUNFLIX_ADMIN_API_KEY 的值"
          @keyup.enter="saveKey"
        />
      </n-form-item>
      <n-text depth="3" class="key-hint">
        浏览与搜索不需要密钥。登记采集源、触发采集、删除等写操作需要，
        密钥只保存在这台浏览器的 localStorage 里，不会上传。
      </n-text>
      <template #footer>
        <n-space justify="space-between">
          <n-button size="small" quaternary @click="setAdminKey(''); showKey = false">
            清除
          </n-button>
          <n-space>
            <n-button size="small" @click="showKey = false">取消</n-button>
            <n-button size="small" type="primary" @click="saveKey">保存</n-button>
          </n-space>
        </n-space>
      </template>
    </n-modal>
  </n-layout>
</template>

<style scoped>
.brand {
  padding: 20px 20px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.brand-name {
  font-size: 19px;
  font-weight: 600;
  letter-spacing: 0.4px;
}
.brand-sub {
  font-size: 12px;
  opacity: 0.55;
}
.sider-footer {
  margin-top: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.key-hint {
  font-size: 12px;
  display: block;
  margin-top: 10px;
  line-height: 1.6;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
