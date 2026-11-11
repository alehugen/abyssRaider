import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { TooltipProvider } from 'reka-ui'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { getContainer, overrideContainer } from '@/app/container'
import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import type { TimeWindow } from '@/contexts/scheduling/domain/Availability'
import { pendingOnboardingStep, safeNext } from './onboarding'
import OnboardingView from './views/OnboardingView.vue'

const ME = 'me'
const char: LinkedCharacter = {
  linkId: 'c1',
  ownerId: ME,
  syncedAt: new Date(),
  character: { id: 'x', name: 'BOOMSHAKALAK', faction: 'asmodian', className: 'Cleric', level: 45, region: 'la', serverId: 1, serverName: 'Siel' },
}

function setup(state: { characters: LinkedCharacter[]; windows: TimeWindow[] }) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.user = { id: ME, name: 'Eu', avatarUrl: null } as never
  auth.status = 'authenticated'
  const save = vi.fn(async (w: readonly TimeWindow[]) => void (state.windows = [...w]))
  const base = getContainer()
  overrideContainer({
    characterRepository: { ...base.characterRepository, listByOwner: async () => state.characters },
    availabilityRepository: { ...base.availabilityRepository, listByOwner: async () => state.windows, save },
  })
  return { pinia, save }
}

describe('primeiros passos', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('pede personagem, depois disponibilidade, depois libera', async () => {
    setup({ characters: [], windows: [] })
    expect(await pendingOnboardingStep()).toBe('character')

    setup({ characters: [char], windows: [] })
    expect(await pendingOnboardingStep()).toBe('availability')

    setup({ characters: [char], windows: [{ weekday: 3, start: 1140, end: 1320 }] })
    expect(await pendingOnboardingStep()).toBeNull()
  })

  it('não bloqueia se não conseguir carregar', async () => {
    setup({ characters: [], windows: [] })
    const base = getContainer()
    overrideContainer({
      characterRepository: { ...base.characterRepository, listByOwner: async () => Promise.reject(new Error('rede')) },
    })
    expect(await pendingOnboardingStep()).not.toBe('character')
  })

  it('só aceita caminhos internos no ?next=', () => {
    expect(safeNext('/parties/buscar')).toBe('/parties/buscar')
    expect(safeNext('//evil.com')).toBe('/parties')
    expect(safeNext('https://evil.com')).toBe('/parties')
    expect(safeNext(undefined)).toBe('/parties')
  })

  it('passo 2: salva a disponibilidade e segue para o destino', async () => {
    const { pinia, save } = setup({ characters: [char], windows: [] })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/comecar', name: 'onboarding', component: OnboardingView },
        { path: '/jogadores', name: 'players', component: { render: () => null } },
      ],
    })
    await router.push('/comecar?next=/jogadores')
    const Root = defineComponent(() => () => h(TooltipProvider, null, { default: () => h(OnboardingView) }))
    const wrapper = mount(Root, { global: { plugins: [pinia, router] }, attachTo: document.body })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Quando você costuma jogar?'))
    expect(wrapper.text()).toContain('Vinculado')
    expect(wrapper.text()).toContain('BOOMSHAKALAK')

    // Sem dia marcado não deixa concluir.
    const submit = () => wrapper.findAll('button[type=submit]').at(-1)!
    expect(submit().attributes('disabled')).toBeDefined()

    // Arrasta na grade de quarta 19:00 até 22:30 (= 19:00 às 23:00).
    const cell = (slot: number) => document.getElementById(`avail-3-${slot}`)!
    const grid = wrapper.find('[role=grid]').element as HTMLElement
    grid.setPointerCapture = vi.fn()
    let under = cell(38)
    document.elementFromPoint = vi.fn(() => under)
    const pointer = (type: string) => grid.dispatchEvent(Object.assign(new MouseEvent(type, { button: 0, bubbles: true }), { pointerId: 1 }))
    pointer('pointerdown')
    under = cell(45)
    pointer('pointermove')
    pointer('pointerup')
    await flushPromises()
    expect(wrapper.text()).toContain('qua, 19:00 às 23:00')
    expect(submit().attributes('disabled')).toBeUndefined()

    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(save).toHaveBeenCalledWith([{ weekday: 3, start: 19 * 60, end: 23 * 60 }])
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/jogadores'))
  })
})
