import type { RouteRecordRaw } from 'vue-router'

export const partyRoutes: RouteRecordRaw[] = [
  {
    path: '/parties',
    name: 'parties',
    component: () => import('./views/PartiesView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/parties/buscar',
    name: 'find-parties',
    component: () => import('./views/FindPartiesView.vue'),
    meta: { requiresAuth: true },
  },
  {
    // Busca de jogadores (personagens vinculados) para convidar. ?party=<id> escolhe a party.
    path: '/jogadores',
    name: 'players',
    component: () => import('./views/PlayersView.vue'),
    meta: { requiresAuth: true },
  },
  {
    // O link desta página é o convite da party.
    path: '/parties/:id',
    name: 'party',
    component: () => import('./views/PartyView.vue'),
    meta: { requiresAuth: true },
  },
]
