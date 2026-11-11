import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { TooltipProvider } from 'reka-ui'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { getContainer, overrideContainer } from '@/app/container'
import type { Character } from '@/contexts/character/domain/Character'
import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import type { Party, PartyDetails, PartyMember } from '../../domain/Party'
import FindPartiesView from './FindPartiesView.vue'

const ME = 'me'

const linked = (linkId: string, ownerId: string, c: Partial<Character> = {}): LinkedCharacter => ({
  linkId,
  ownerId,
  syncedAt: new Date(),
  character: {
    id: linkId,
    name: linkId,
    faction: 'asmodian',
    className: 'Gladiator',
    level: 45,
    region: 'la',
    serverId: 1,
    serverName: 'Siel',
    itemLevel: 3000,
    ...c,
  },
})

function details(id: string, leaderId: string, classes: string[]): PartyDetails {
  const party: Party = {
    id,
    name: id,
    sanctuary: { id: 'ludra', name: 'Abyssal Forge: Ludra', minItemLevel: 2800, groupSize: 10 },
    leaderId,
    leaderCharacterLinkId: `${id}-0`,
    region: 'la',
    faction: 'asmodian',
    createdAt: new Date(),
  }
  const members: PartyMember[] = classes.map((className, i) => ({
    id: `${id}-m${i}`,
    partyId: id,
    linked: linked(`${id}-${i}`, i === 0 ? leaderId : `${id}-o${i}`, { className }),
    ownerName: 'x',
    ownerAvatarUrl: null,
    status: 'accepted',
    createdAt: new Date(),
  }))
  return { party, members }
}

async function setup(candidates: PartyDetails[]) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.user = { id: ME, name: 'Eu', avatarUrl: null } as never
  auth.status = 'authenticated'

  const base = getContainer()
  overrideContainer({
    characterRepository: {
      ...base.characterRepository,
      listByOwner: async () => [linked('BOOMSHAKALAK', ME, { className: 'Cleric' })],
    },
    partyRepository: { ...base.partyRepository, listOpen: async () => candidates, listMine: async () => [] },
    availabilityRepository: { ...base.availabilityRepository, listByOwners: async () => new Map() },
  })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/parties/buscar', name: 'find-parties', component: FindPartiesView },
      { path: '/parties', name: 'parties', component: { render: () => null } },
      { path: '/parties/:id', name: 'party', component: { render: () => null } },
      { path: '/me', component: { render: () => null } },
    ],
  })
  await router.push('/parties/buscar')
  const Root = defineComponent(() => () => h(TooltipProvider, null, { default: () => h(FindPartiesView) }))
  const wrapper = mount(Root, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await vi.waitFor(() => expect(wrapper.text()).not.toContain('Escolha o personagem'), { timeout: 2000 })
  await flushPromises()
  return wrapper
}

describe('FindPartiesView', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('mostra a party do próprio líder em vez de uma tela vazia', async () => {
    const wrapper = await setup([details('Ludra', ME, ['Cleric', 'Cleric', 'Templar', 'Gladiator'])])
    await vi.waitFor(() => expect(wrapper.text()).toContain('Você já está nesta party da região'))
    expect(wrapper.text()).toContain('(líder)')
    expect(wrapper.text()).toContain('Nenhuma outra party aberta na sua região agora.')
  })

  it('separa quem precisa de cura de quem já tem as curas', async () => {
    const wrapper = await setup([
      details('Com curas', 'outro1', ['Cleric', 'Cleric', 'Templar']),
      details('Sem cura', 'outro2', ['Templar', 'Gladiator']),
    ])
    await vi.waitFor(() => expect(wrapper.text()).toContain('Precisam de cura'))
    const sections = wrapper.findAll('section')
    expect(sections[0]!.text()).toContain('Precisam de cura')
    expect(sections[0]!.text()).toContain('Sem cura')
    expect(sections[1]!.text()).toContain('Sem vaga de cura')
    expect(sections[1]!.text()).toContain('Com curas')
    expect(sections[1]!.text()).toContain('o líder decide')
  })
})
