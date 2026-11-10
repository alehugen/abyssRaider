import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { characterRoutes } from '@/contexts/character/presentation/routes'
import { identityRoutes } from '@/contexts/identity/presentation/routes'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'

declare module 'vue-router' {
  interface RouteMeta {
    /** Exige login; anônimos vão para /login?next=... */
    requiresAuth?: boolean
    /** Só para anônimos (ex.: /login); logados vão para a home. */
    guestOnly?: boolean
  }
}

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
    ...identityRoutes,
    ...characterRoutes,
    ...devRoutes,
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/app/views/NotFoundView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth && !to.meta.guestOnly) return true

  const auth = useAuthStore()
  await auth.init()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { next: to.fullPath } }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'home' }
  }
  return true
})
