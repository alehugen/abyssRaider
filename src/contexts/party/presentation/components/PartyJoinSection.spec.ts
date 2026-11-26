import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import { useCharactersStore } from '@/contexts/character/presentation/useCharactersStore'
import type { Party } from '../../domain/Party'

vi.mock('../../domain/Party', async (orig) => ({
  ...(await orig<typeof import('../../domain/Party')>()),
  canJoin: () => ({ ok: true }),
  joinBlockedMessage: () => null,
}))

const { default: PartyJoinSection } = await import('./PartyJoinSection.vue')

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', name: 'find-parties', component: { template: '<div />' } }] })
const party = { id: 'p1' } as unknown as Party
const kael = { linkId: 'l1', character: { name: 'Kael', serverName: 'Siel' } } as unknown as LinkedCharacter

beforeEach(() => {
  setActivePinia(createPinia())
  const store = useCharactersStore()
  store.items = [kael]
  store.loaded = true
})

const mountIt = (props: Partial<InstanceType<typeof PartyJoinSection>['$props']> = {}) =>
  mount(PartyJoinSection, {
    props: { party, declined: false, full: false, busy: false, joining: false, ...props },
    global: { plugins: [router], stubs: { CreatePartyDialog: true } },
  })

describe('PartyJoinSection', () => {
  it('pedido recusado antes: explica e deixa pedir de novo', async () => {
    const wrapper = mountIt({ declined: true })
    await flushPromises()
    expect(wrapper.text()).toContain('recusou')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('request')?.[0]).toEqual(['l1'])
  })

  it('party cheia: avisa (o pedido fica para quando abrir vaga)', () => {
    expect(mountIt({ full: true }).text()).toContain('completa')
  })
})
