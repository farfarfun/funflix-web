import { createRouter, createWebHistory } from 'vue-router'

/**
 * history 的 base 必须与 vite 的 `base` 一致（都是 /web/），
 * 否则前端算出来的链接会落在站点根下，点一下就 404。
 */
export const router = createRouter({
  history: createWebHistory('/web/'),
  routes: [
    { path: '/', redirect: '/media' },
    {
      path: '/media',
      name: 'media',
      component: () => import('@/views/MediaListView.vue'),
      meta: { title: '作品检索' },
    },
    {
      path: '/media/:id',
      name: 'media-detail',
      component: () => import('@/views/MediaDetailView.vue'),
      meta: { title: '作品详情' },
    },
    {
      path: '/resources',
      name: 'resources',
      component: () => import('@/views/ResourcesView.vue'),
      meta: { title: '网盘资源' },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { title: '流水线大盘' },
    },
    {
      path: '/sources',
      name: 'sources',
      component: () => import('@/views/SourcesView.vue'),
      meta: { title: '采集源' },
    },
    {
      path: '/raw',
      name: 'raw',
      component: () => import('@/views/RawDocsView.vue'),
      meta: { title: '原始文本' },
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

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} · funflix` : 'funflix'
})
