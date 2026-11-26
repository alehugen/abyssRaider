import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const visible = ref(true)
const run = vi.fn(async (): Promise<'prompted' | 'manual'> => 'prompted')
vi.mock('./usePwaInstall', () => ({
  usePwaInstall: () => ({}),
  installAction: () => ({ visible, run }),
}))

const { default: InstallBanner } = await import('./InstallBanner.vue')

beforeEach(() => {
  visible.value = true
  run.mockReset().mockResolvedValue('prompted')
  localStorage.clear()
})
afterEach(() => {
  document.body.innerHTML = ''
})

describe('InstallBanner', () => {
  it('convida a instalar antes de entrar, explicando por quê', () => {
    const wrapper = mount(InstallBanner)
    expect(wrapper.text()).toContain('Instale o app antes de entrar')
    expect(wrapper.text()).toContain('login uma vez')
  })

  it('não aparece quando já está instalado (ou não dá para instalar)', () => {
    visible.value = false
    expect(mount(InstallBanner).find('[data-install-banner]').exists()).toBe(false)
  })

  it('"Instalar" abre o convite do navegador', async () => {
    const wrapper = mount(InstallBanner)
    await wrapper.get('[data-action="install"]').trigger('click')
    expect(run).toHaveBeenCalled()
  })

  it('no iPhone mostra o passo a passo', async () => {
    run.mockResolvedValue('manual')
    const wrapper = mount(InstallBanner, { attachTo: document.body })
    await wrapper.get('[data-action="install"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Adicionar à Tela de Início')
    wrapper.unmount()
  })

  it('"Agora não" esconde e lembra a escolha neste aparelho', async () => {
    const wrapper = mount(InstallBanner)
    await wrapper.get('[data-action="dismiss"]').trigger('click')
    expect(wrapper.find('[data-install-banner]').exists()).toBe(false)
    expect(mount(InstallBanner).find('[data-install-banner]').exists()).toBe(false)
  })
})
