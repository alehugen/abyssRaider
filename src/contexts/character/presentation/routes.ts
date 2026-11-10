import type { RouteRecordRaw } from 'vue-router'

export const characterRoutes: RouteRecordRaw[] = [
  {
    path: '/me',
    name: 'me',
    component: () => import('./views/MyCharactersView.vue'),
    meta: { requiresAuth: true },
  },
]
