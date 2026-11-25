import { flushPromises, mount } from '@vue/test-utils'
import { PhSword, PhUsersThree } from '@phosphor-icons/vue'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const online = ref(true)
const needRefresh = ref(false)
const update = vi.fn(async () => {})
const dismiss = vi.fn(() => (needRefresh.value = false))

vi.mock('./useOnline', () => ({ useOnline: () => ({ online }) }))
vi.mock('./usePwaUpdate', () => ({ usePwaUpdate: () => ({ needRefresh, update, dismiss }) }))

const { default: OfflineBanner } = await import('./OfflineBanner.vue')
const { default: PwaUpdateToast } = await import('./PwaUpdateToast.vue')
const { default: BottomNav } = await import('../navigation/BottomNav.vue')

beforeEach(() => {
  online.value = true
  needRefresh.value = false
  update.mockClear()
  dismiss.mockClear()
})

describe('OfflineBanner', () => {
  it('só aparece sem conexão, explicando o que não funciona', async () => {
    const wrapper = mount(OfflineBanner)
    expect(wrapper.text()).toBe('')
    online.value = false
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('Sem conexão')
  })
})

describe('PwaUpdateToast', () => {
  it('avisa da versão nova e só atualiza quando a pessoa toca em Atualizar', async () => {
    const wrapper = mount(PwaUpdateToast)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)

    needRefresh.value = true
    await flushPromises()
    expect(wrapper.text()).toContain('Nova versão')
    expect(update).not.toHaveBeenCalled()

    await wrapper.get('[data-action="update"]').trigger('click')
    expect(update).toHaveBeenCalled()
  })

  it('"Agora não" esconde o aviso', async () => {
    needRefresh.value = true
    const wrapper = mount(PwaUpdateToast)
    await wrapper.get('[data-action="later"]').trigger('click')
    expect(dismiss).toHaveBeenCalled()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })
})

describe('BottomNav', () => {
  it('mostra cada aba com ícone e nome, e marca a atual', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: ['/', '/me', '/parties'].map((path) => ({ path, component: { template: '<div />' } })),
    })
    await router.push('/parties')
    const wrapper = mount(BottomNav, {
      props: {
        label: 'Principal',
        items: [
          { to: '/me', label: 'Chars', ariaLabel: 'Personagens', icon: PhSword },
          { to: '/parties', label: 'Parties', icon: PhUsersThree },
        ],
      },
      global: { plugins: [router] },
    })
    const links = wrapper.findAll('a')
    expect(links.map((a) => a.text())).toEqual(['Chars', 'Parties'])
    // Nome abreviado na tela, completo para leitor de tela.
    expect(links[0]!.attributes('aria-label')).toBe('Personagens')
    expect(links[1]!.attributes('aria-current')).toBe('page')
    expect(links[0]!.attributes('aria-current')).toBeUndefined()
  })
})
