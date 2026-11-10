import type { RouteRecordRaw } from 'vue-router'

export const schedulingRoutes: RouteRecordRaw[] = [
  {
    path: '/agenda',
    name: 'agenda',
    component: () => import('./views/AgendaView.vue'),
    meta: { requiresAuth: true },
  },
]
