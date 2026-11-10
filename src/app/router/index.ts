import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const devRoutes: RouteRecordRaw[] = import.meta.env.DEV
  ? [{ path: '/ui', name: 'ui', component: () => import('@/app/views/UiShowcaseView.vue') }]
  : []

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/app/views/HomeView.vue'),
    },
    ...devRoutes,
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/app/views/NotFoundView.vue'),
    },
  ],
})
