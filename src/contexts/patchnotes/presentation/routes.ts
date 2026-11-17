import type { RouteRecordRaw } from 'vue-router'

/** Aberta para todos: patch note é informação pública do jogo. */
export const patchNotesRoutes: RouteRecordRaw[] = [
  {
    path: '/patch-notes/:id?',
    name: 'patch-notes',
    component: () => import('./views/PatchNotesView.vue'),
  },
]
