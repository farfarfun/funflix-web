<script setup lang="ts">
import {
  BookOutline,
  ChevronDownOutline,
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
import type { DropdownOption, MenuOption } from 'naive-ui'
import { NIcon } from 'naive-ui'
import type { Component } from 'vue'
import { computed, h, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { adminKey, hasAdminKey, setAdminKey } from '@/api/auth'
import { pageHeading } from '@/composables/usePageHeading'

defineProps<{ dark: boolean }>()
defineEmits<{ toggleTheme: [] }>()

const route = useRoute()
const router = useRouter()

// --- 移动端导航：窄屏下横向导航挤不下，改成汉堡按钮开抽屉 ---
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

// 移动端抽屉仍然用 n-menu 摊开两组——它是叠在内容上方的浮层，不像常驻侧栏那样定义「这是个后台系统」
const drawerMenuOptions: MenuOption[] = GROUPS.map((g) => ({
  type: 'group',
  label: g.group,
  key: `g-${g.group}`,
  children: g.entries.map((e) => ({
    label: link(e.key, e.label),
    key: e.key,
    icon: renderIcon(e.icon),
  })),
}))

// 桌面顶栏只留「作品检索」单独露出，其余 4 个运维页收进一个下拉——
// 5 个目的地全摊平在顶栏会重新变回「后台导航条」的观感
const opsEntries = GROUPS.find((g) => g.group === '运维')?.entries ?? []
const opsOptions: DropdownOption[] = opsEntries.map((e) => ({
  key: e.key,
  label: e.label,
  icon: renderIcon(e.icon),
}))

function onOpsSelect(key: string | number) {
  void router.push({ name: String(key) })
}

// 详情页要让「作品检索」保持高亮，否则进详情后顶栏看起来什么都没选中
const activeKey = computed(() => {
  const name = String(route.name ?? '')
  return name === 'media-detail' ? 'media' : name
})
const isOpsActive = computed(() => opsEntries.some((e) => e.key === activeKey.value))

// 顶栏中间的面包屑：从分组里反查当前页所属分组，详情页例外，用页面自己上报的 pageHeading
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
  <div class="shell">
    <header class="navbar" :style="{ background: dark ? 'rgba(11, 12, 16, 0.86)' : 'rgba(255, 255, 255, 0.86)' }">
      <div class="navbar-inner">
        <div class="nav-left">
          <RouterLink :to="{ name: 'media' }" class="brand">
            <div class="brand-mark">F</div>
            <span class="brand-name">funflix</span>
          </RouterLink>

          <nav class="nav-links">
            <RouterLink :to="{ name: 'media' }" class="nav-link" :class="{ active: activeKey === 'media' }">
              作品检索
            </RouterLink>
            <n-dropdown trigger="click" :options="opsOptions" @select="onOpsSelect">
              <span class="nav-link nav-link-dropdown" :class="{ active: isOpsActive }">
                运维
                <n-icon size="12"><ChevronDownOutline /></n-icon>
              </span>
            </n-dropdown>
          </nav>
        </div>

        <div class="nav-center">
          <span v-if="breadcrumb.label" class="crumb">
            <span v-if="breadcrumb.group" class="crumb-group">{{ breadcrumb.group }}</span>
            <span v-if="breadcrumb.group" class="crumb-sep">/</span>
            <span class="crumb-label">{{ breadcrumb.label }}</span>
          </span>
        </div>

        <div class="nav-right">
          <n-button quaternary circle size="small" class="hamburger" @click="mobileMenuOpen = true">
            <n-icon size="18"><MenuOutline /></n-icon>
          </n-button>
          <n-space :size="2" align="center">
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
      </div>
    </header>

    <main class="content">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>

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
        <n-menu :value="activeKey" :options="drawerMenuOptions" :indent="16" />
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100%;
}
.navbar {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 56px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.14);
  backdrop-filter: blur(10px);
}
.navbar-inner {
  height: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 20px;
}
.brand {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
}
.brand-mark {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, #6d5ef8, #a78bfa);
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}
.brand-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.3px;
}
.nav-left {
  flex: none;
  display: flex;
  align-items: center;
  gap: 28px;
}
.nav-links {
  display: flex;
  align-items: center;
  gap: 20px;
}
.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 500;
  opacity: 0.62;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: opacity 0.15s var(--ease);
}
.nav-link:hover {
  opacity: 0.95;
}
.nav-link.active {
  opacity: 1;
  color: var(--n-primary-color, #6d5ef8);
}
.nav-center {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
}
.crumb {
  font-size: 13px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.crumb-group {
  opacity: 0.5;
}
.crumb-sep {
  opacity: 0.3;
  margin: 0 4px;
}
.crumb-label {
  font-weight: 600;
}
.nav-right {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
}
.hamburger {
  display: none;
}
.content {
  max-width: 1600px;
  margin: 0 auto;
  padding: 28px 24px 48px;
}

/* 窄屏：横向导航链接与中间面包屑挤不下，收起来改走抽屉 */
@media (max-width: 768px) {
  .nav-links,
  .nav-center {
    display: none;
  }
  .hamburger {
    display: inline-flex;
  }
  .content {
    padding: 16px 16px 32px;
  }
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
