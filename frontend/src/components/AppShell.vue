<script setup lang="ts">
import {
  BookOutline,
  CloudDownloadOutline,
  CloudUploadOutline,
  DocumentTextOutline,
  KeyOutline,
  MenuOutline,
  MoonOutline,
  SearchOutline,
  SpeedometerOutline,
  SunnyOutline,
} from '@vicons/ionicons5'
import type { MenuOption } from 'naive-ui'
import { NIcon } from 'naive-ui'
import type { Component } from 'vue'
import { computed, h, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { adminKey, hasAdminKey, setAdminKey } from '@/api/auth'
import { pageHeading } from '@/composables/usePageHeading'

defineProps<{ dark: boolean }>()
defineEmits<{ toggleTheme: [] }>()

const route = useRoute()

// --- 移动端侧边栏：窄屏下 212px 固定侧栏会把内容区挤没，改成汉堡按钮开抽屉 ---
const mobileMenuOpen = ref(false)

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

function renderIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

function link(name: string, label: string) {
  return () => h(RouterLink, { to: { name } }, { default: () => label })
}

// 网盘资源放在「运维」而不是「发现」：它是按链接维度的全量清单，
// 后端要求管理密钥才能读，用途是排查「某个网盘是不是大面积失效了」，
// 而不是给使用者浏览内容 —— 那条路径是作品检索。
interface Entry {
  key: string
  label: string
  icon: Component
}
const GROUPS: { group: string; entries: Entry[] }[] = [
  {
    group: '发现',
    entries: [{ key: 'media', label: '作品检索', icon: SearchOutline }],
  },
  {
    group: '运维',
    entries: [
      { key: 'dashboard', label: '流水线大盘', icon: SpeedometerOutline },
      { key: 'sources', label: '采集源', icon: CloudUploadOutline },
      { key: 'raw', label: '原始文本', icon: DocumentTextOutline },
      { key: 'resources', label: '网盘资源', icon: CloudDownloadOutline },
    ],
  },
]

const menuOptions: MenuOption[] = GROUPS.map((g) => ({
  type: 'group',
  label: g.group,
  key: `g-${g.group}`,
  children: g.entries.map((e) => ({
    label: link(e.key, e.label),
    key: e.key,
    icon: renderIcon(e.icon),
  })),
}))

// 详情页要让它所属的列表项保持高亮，否则进详情后侧栏看起来什么都没选中
const activeKey = computed(() => {
  const name = String(route.name ?? '')
  return name === 'media-detail' ? 'media' : name
})

// 顶部工具条的面包屑：从菜单分组里反查当前页所属分组，比单独的路由 meta 更省一份数据源。
// 详情页是个例外：光显示所属分组看不出「在看哪一部」，用页面自己上报的 pageHeading 顶上去。
const breadcrumb = computed(() => {
  if (route.name === 'media-detail') {
    return { group: '发现 · 作品检索', label: pageHeading.value ?? '加载中…' }
  }
  for (const g of GROUPS) {
    const entry = g.entries.find((e) => e.key === activeKey.value)
    if (entry) return { group: g.group, label: entry.label }
  }
  return { group: '', label: (route.meta.title as string | undefined) ?? '' }
})

// 切页面后抽屉里的旧菜单还开着会挡住新页面，导航一发生就收起
watch(
  () => route.fullPath,
  () => {
    mobileMenuOpen.value = false
  },
)
</script>

<template>
  <n-layout has-sider position="absolute">
    <n-layout-sider bordered :width="212" class="sider" content-style="display:flex;flex-direction:column">
      <div class="brand">
        <div class="brand-mark">F</div>
        <div class="brand-text">
          <span class="brand-name">funflix</span>
          <span class="brand-sub">影视资源聚合</span>
        </div>
      </div>
      <n-menu :value="activeKey" :options="menuOptions" :indent="16" class="menu" />
    </n-layout-sider>

    <n-layout-content content-style="padding:0" :native-scrollbar="false">
      <div class="topbar" :style="{ background: dark ? 'rgba(24, 24, 28, 0.86)' : 'rgba(255, 255, 255, 0.86)' }">
        <div class="crumb">
          <n-button quaternary circle size="small" class="hamburger" @click="mobileMenuOpen = true">
            <n-icon size="18"><MenuOutline /></n-icon>
          </n-button>
          <span v-if="breadcrumb.group" class="crumb-group">{{ breadcrumb.group }}</span>
          <span v-if="breadcrumb.group" class="crumb-sep">/</span>
          <span class="crumb-label">{{ breadcrumb.label }}</span>
        </div>
        <n-space :size="4" align="center">
          <n-tooltip>
            <template #trigger>
              <n-button quaternary circle @click="openKeyDialog">
                <n-badge :dot="!hasAdminKey" :offset="[-2, 2]" type="warning">
                  <n-icon size="18"><KeyOutline /></n-icon>
                </n-badge>
              </n-button>
            </template>
            管理密钥
          </n-tooltip>
          <n-tooltip>
            <template #trigger>
              <n-button quaternary circle @click="$emit('toggleTheme')">
                <n-icon size="18">
                  <MoonOutline v-if="!dark" />
                  <SunnyOutline v-else />
                </n-icon>
              </n-button>
            </template>
            {{ dark ? '切换到浅色' : '切换到深色' }}
          </n-tooltip>
          <n-tooltip>
            <template #trigger>
              <n-button quaternary circle tag="a" href="/docs" target="_blank">
                <n-icon size="18"><BookOutline /></n-icon>
              </n-button>
            </template>
            接口文档
          </n-tooltip>
        </n-space>
      </div>

      <div class="content">
        <RouterView v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </RouterView>
      </div>
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

    <n-drawer v-model:show="mobileMenuOpen" placement="left" :width="240" class="mobile-drawer">
      <n-drawer-content title="funflix" closable :native-scrollbar="false">
        <n-menu :value="activeKey" :options="menuOptions" :indent="16" />
      </n-drawer-content>
    </n-drawer>
  </n-layout>
</template>

<style scoped>
.brand {
  padding: 20px 18px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-mark {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, #6d5ef8, #a78bfa);
  color: #fff;
  font-weight: 700;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}
.brand-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.brand-name {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.3px;
}
.brand-sub {
  font-size: 11px;
  opacity: 0.55;
}
.menu {
  padding: 0 6px;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 52px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(128, 128, 128, 0.14);
  backdrop-filter: blur(8px);
}
.crumb {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.hamburger {
  display: none;
  margin-right: 4px;
}

/* 窄屏：212px 固定侧栏会把内容区挤没，收起来改走抽屉 */
@media (max-width: 768px) {
  .sider {
    display: none;
  }
  .hamburger {
    display: inline-flex;
  }
  .content {
    padding: 16px;
  }
}
.crumb-group {
  opacity: 0.5;
}
.crumb-sep {
  opacity: 0.3;
}
.crumb-label {
  font-weight: 600;
}
.content {
  padding: 24px;
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
