import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { getContainer, overrideContainer } from '@/app/container'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import PartiesView from './PartiesView.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:p(.*)*', name: 'find-parties', component: { template: '<div />' } }],
})

beforeEach(() => {
  setActivePinia(createPinia())
  useAuthStore().user = { id: 'u1', discordId: null, displayName: 'Lyra', avatarUrl: null }
})

const mountView = () => mount(PartiesView, { global: { plugins: [router], stubs: { CreatePartyDialog: true } } })

describe('PartiesView', () => {
  it('falha ao carregar: mostra o erro com "Tentar de novo", não "você não tem parties"', async () => {
    const listMine = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce([])
    overrideContainer({ partyRepository: { ...getContainer().partyRepository, listMine } })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Nenhuma party ativa')
    expect(wrapper.text()).not.toContain('nenhuma party.')

    await wrapper.get('[data-action="retry"]').trigger('click')
    await flushPromises()
    expect(listMine).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
