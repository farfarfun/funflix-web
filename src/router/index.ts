import { createRouter, createWebHistory } from 'vue-router'

import { authReady, fetchMe, isAdmin, isAuthenticated } from '@/api/auth'

/**
 * 两道门，对应后端的 `CurrentUserDep` / `AdminUserDep`：
 *
 * - **默认要登录**。整站都要口令，作品检索/详情也一样 —— 所以是白名单而不是
 *   黑名单：只有 `meta.public` 的路由（登录页）放行，新加页面漏标 meta 时会落在
 *   「要登录」这一侧，而不是悄悄变成公开页。
 * - `meta.requiresAdmin` 的是「运维」区，在登录之上还要求 admin 角色。
 */
declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    /** 免登录。只给登录页 —— 否则没登录的人连登录页都进不去。 */
    public?: boolean
    requiresAdmin?: boolean
  }
}

/**
 * history 的 base 必须与 vite 的 `base` 一致（都是 /web/），
 * 否则前端算出来的链接会落在站点根下，点一下就 404。
 */
export const router = createRouter({
  history: createWebHistory('/web/'),
  routes: [
    { path: '/', redirect: '/media' },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { title: '登录', public: true },
    },
    {
      path: '/media',
      name: 'media',
      component: () => import('@/views/MediaListView.vue'),
      meta: { title: '作品检索' },
    },
    {
      // `:id` 是 **work.id**（一部剧），不是 media.id（一季）—— 路径沿用
      // /media 只是为了不废掉已有链接，页面打的是 `GET /works/{id}`。
      path: '/media/:id',
      name: 'media-detail',
      component: () => import('@/views/MediaDetailView.vue'),
      meta: { title: '作品详情' },
    },
    {
      path: '/resources',
      name: 'resources',
      component: () => import('@/views/ResourcesView.vue'),
      meta: { title: '网盘资源', requiresAdmin: true },
    },
    {
      path: '/providers',
      name: 'providers',
      component: () => import('@/views/ProvidersView.vue'),
      meta: { title: '网盘管理', requiresAdmin: true },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { title: '流水线大盘', requiresAdmin: true },
    },
    {
      path: '/sources',
      name: 'sources',
      component: () => import('@/views/SourcesView.vue'),
      meta: { title: '采集源', requiresAdmin: true },
    },
    {
      path: '/raw',
      name: 'raw',
      component: () => import('@/views/RawDocsView.vue'),
      meta: { title: '原始文本', requiresAdmin: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  if (!authReady.value) await fetchMe()

  if (!to.meta.public && !isAuthenticated.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  // guest 手敲运维 URL：弹回首页而不是跳登录页 —— 他已经登录了，再让他登一次
  // 也还是 guest，那是个死循环。
  if (to.meta.requiresAdmin && !isAdmin.value) {
    return { name: 'media' }
  }
  if (to.name === 'login' && isAuthenticated.value) {
    return { name: 'media' }
  }
  return true
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} · funflix` : 'funflix'
})
