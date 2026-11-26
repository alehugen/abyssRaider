import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PushPreferences } from '../../domain/PushDevice'
import type { PushStatus } from './pushController'

const status = ref<PushStatus>('off')
const preferences = ref<PushPreferences>({ raids: true, patchNotes: true })
const push = {
  status,
  preferences,
  busy: ref(false),
  error: ref<string | null>(null),
  refresh: vi.fn(async () => {}),
  enable: vi.fn(async () => void (status.value = 'on')),
  disable: vi.fn(async () => void (status.value = 'off')),
  setPreferences: vi.fn(async (p: PushPreferences) => void (preferences.value = p)),
  forgetDevice: vi.fn(async () => {}),
}
vi.mock('./usePushNotifications', () => ({
  usePushNotifications: () => push,
  pushDiagnostics: async () => [['PushManager', 'não'], ['Permissão', 'default']],
}))

const { default: PushSettingsDialog } = await import('./PushSettingsDialog.vue')

let wrapper: ReturnType<typeof mount> | null = null
async function openDialog() {
  wrapper = mount(PushSettingsDialog, { props: { open: true }, attachTo: document.body })
  await flushPromises()
  return document.body
}

beforeEach(() => {
  status.value = 'off'
  preferences.value = { raids: true, patchNotes: true }
  vi.clearAllMocks()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('PushSettingsDialog', () => {
  it('confere o estado do aparelho ao abrir', async () => {
    wrapper = mount(PushSettingsDialog, { props: { open: false }, attachTo: document.body })
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(push.refresh).toHaveBeenCalled()
  })

  it('desligado: botão de ativar; as opções aparecem depois de ativar', async () => {
    const body = await openDialog()
    const enable = body.querySelector<HTMLButtonElement>('[data-action="enable"]')
    expect(enable?.textContent).toContain('Ativar neste aparelho')
    expect(body.querySelector('[data-push-toggle="raids"]')).toBeNull()
    enable!.click()
    await flushPromises()
    expect(push.enable).toHaveBeenCalled()
    expect(body.textContent).toContain('Ativadas neste aparelho.')
    expect(body.querySelector('[data-push-toggle="raids"]')).not.toBeNull()
  })

  it('ligado: trocar "Patch notes" salva só essa preferência', async () => {
    status.value = 'on'
    const body = await openDialog()
    body.querySelector<HTMLButtonElement>('[data-push-toggle="patchNotes"]')!.click()
    await flushPromises()
    expect(push.setPreferences).toHaveBeenCalledWith({ raids: true, patchNotes: false })
    body.querySelector<HTMLButtonElement>('[data-action="disable"]')!.click()
    expect(push.disable).toHaveBeenCalled()
  })

  it('iPhone fora da Tela de Início: explica como instalar em vez de ativar', async () => {
    status.value = 'needsInstall'
    const body = await openDialog()
    expect(body.querySelector('[data-push="blocked"]')?.textContent).toContain('Adicionar à Tela de Início')
    expect(body.querySelector('[data-action="enable"]')).toBeNull()
  })

  it('mostra os detalhes técnicos do aparelho (para diagnosticar)', async () => {
    const body = await openDialog()
    const details = body.querySelector('[data-push="diagnostics"]')
    expect(details?.textContent).toContain('Detalhes técnicos')
    expect(details?.textContent).toContain('PushManager')
  })

  it('bloqueado no navegador: diz onde liberar', async () => {
    status.value = 'denied'
    const body = await openDialog()
    expect(body.querySelector('[data-push="blocked"]')?.textContent).toContain('bloqueadas')
  })
})
