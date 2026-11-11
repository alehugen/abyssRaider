import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { TooltipProvider } from 'reka-ui'
import { getContainer, overrideContainer } from '@/app/container'
import type { Character } from '@/contexts/character/domain/Character'
import type { PlayerListing } from '@/contexts/character/domain/CharacterRepository'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import type { PartySummary } from '../../domain/Party'
import PlayersView from './PlayersView.vue'

const ME = 'me'

const player = (linkId: string, ownerId: string, c: Partial<Character> = {}): PlayerListing => ({
  linked: {
    linkId,
    ownerId,
    syncedAt: new Date(),
    character: {
      id: linkId,
      name: linkId,
      faction: 'asmodian',
      className: 'Cleric',
      level: 45,
      region: 'la',
      serverId: 1,
      serverName: 'Siel',
      itemLevel: 3000,
      ...c,
    },
  },
  ownerName: `dono-${ownerId}`,
  ownerAvatarUrl: null,
})

const ludra: PartySummary = {
  party: {
    id: 'p1',
    name: 'Ludra',
    sanctuary: { id: 'ludra', name: 'Abyssal Forge: Ludra', minItemLevel: 2800, groupSize: 10 },
    leaderId: ME,
    leaderCharacterLinkId: 'mine',
    region: 'la',
    faction: 'asmodian',
    createdAt: new Date(),
    routine: { days: [3], time: '20:00', timeZone: 'America/Sao_Paulo' },
  },
  leaderCharacterName: 'Eu',
  acceptedCount: 4,
  myStatus: 'leader',
}

async function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.user = { id: ME, name: 'Eu', avatarUrl: null } as never
  auth.status = 'authenticated'

  const searchPlayers = vi.fn(async () => [
    player('Sem', 'u1'), // sem disponibilidade
    player('Livre', 'u2'), // livre na quarta 19-22 -> bate com a rotina (qua 20:00)
    player('Convidada', 'u3'),
  ])
  const invite = vi.fn(async () => 'invited' as const)
  const base = getContainer()
  overrideContainer({
    characterRepository: { ...base.characterRepository, listByOwner: async () => [], searchPlayers },
    partyRepository: {
      ...base.partyRepository,
      listMine: async () => [ludra],
      listMemberships: async () => [{ partyId: 'p1', characterLinkId: 'Convidada', ownerId: 'u3', status: 'invited' as const }],
      invite,
    },
    availabilityRepository: {
      ...base.availabilityRepository,
      listByOwners: async () => new Map([['u2', [{ weekday: 3, start: 19 * 60, end: 22 * 60 }]]]),
    },
  })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/jogadores', name: 'players', component: PlayersView },
      { path: '/parties', name: 'parties', component: { template: '<div />' } },
    ],
  })
  await router.push('/jogadores')
  // No app, o TooltipProvider fica no App.vue (o ClassIcon usa tooltip).
  const Root = defineComponent(() => () => h(TooltipProvider, null, { default: () => h(PlayersView) }))
  const wrapper = mount(Root, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await vi.waitFor(() => expect(searchPlayers).toHaveBeenCalled(), { timeout: 2000 })
  await flushPromises()
  await vi.waitFor(() => expect(wrapper.text()).toContain('3 personagens'), { timeout: 2000 })
  return { wrapper, searchPlayers, invite }
}

describe('PlayersView', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('busca com a região e item level da party, as duas facções e sem os meus personagens', async () => {
    const { searchPlayers } = await setup()
    expect(searchPlayers).toHaveBeenLastCalledWith(
      expect.objectContaining({ region: 'la', faction: null, minItemLevel: 2800, excludeOwnerId: ME }),
    )
  })

  it('mostra disponibilidade, põe quem está livre na rotina primeiro e o estado do convite', async () => {
    const { wrapper } = await setup()
    const cards = wrapper.findAll('li.rounded-2xl')
    expect(cards[0]!.text()).toContain('Livre')
    expect(cards[0]!.text()).toContain('qua, 19:00 às 22:00')
    expect(cards[0]!.text()).toContain('Livre no horário de Ludra')
    expect(wrapper.text()).toContain('Não informou.')
    const convidada = cards.find((c) => c.text().includes('Convidada'))!
    expect(convidada.text()).toContain('Convidado, aguardando')
  })

  it('facção "Todas" busca sem filtro de facção', async () => {
    const { wrapper, searchPlayers } = await setup()
    const todas = wrapper.findAll('button').find((b) => b.text() === 'Todas')!
    await todas.trigger('click')
    await vi.waitFor(() => expect(searchPlayers).toHaveBeenLastCalledWith(expect.objectContaining({ faction: null })), {
      timeout: 2000,
    })
    expect(todas.attributes('data-state')).toBe('on')
  })

  it('convida e atualiza o card', async () => {
    const { wrapper, invite } = await setup()
    const card = wrapper.findAll('li.rounded-2xl').find((c) => c.text().includes('Sem'))!
    const button = card.findAll('button').find((b) => b.text().includes('Convidar para Ludra'))!
    await button.trigger('click')
    await flushPromises()
    expect(invite).toHaveBeenCalledWith('p1', 'Sem')
    expect(wrapper.text()).toContain('Convite enviado para Sem')
    expect(wrapper.findAll('li.rounded-2xl').find((c) => c.text().includes('Sem'))!.text()).toContain('Convidado, aguardando')
  })
})
