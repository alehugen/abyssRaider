import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { characterRoutes } from '@/contexts/character/presentation/routes'
import { partyRoutes } from '@/contexts/party/presentation/routes'
import { schedulingRoutes } from '@/contexts/scheduling/presentation/routes'
import { identityRoutes } from '@/contexts/identity/presentation/routes'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { pendingOnboardingStep } from '@/app/onboarding'

declare module 'vue-router' {
  interface RouteMeta {
    /** Exige login; anônimos vão para /login?next=... */
    requiresAuth?: boolean
    /** Só para anônimos (ex.: /login); logados vão para a home. */
    guestOnly?: boolean
    /** Abre mesmo sem os primeiros passos concluídos (a própria página deles). */
    skipOnboarding?: boolean
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
    {
      // Primeiros passos obrigatórios: vincular personagem e informar disponibilidade.
      path: '/comecar',
      name: 'onboarding',
      component: () => import('@/app/views/OnboardingView.vue'),
      meta: { requiresAuth: true, skipOnboarding: true },
    },
    ...identityRoutes,
    ...characterRoutes,
    ...partyRoutes,
    ...schedulingRoutes,
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
  if (to.meta.requiresAuth && !to.meta.skipOnboarding && (await pendingOnboardingStep())) {
    return { name: 'onboarding', query: { next: to.fullPath } }
  }
  return true
})
