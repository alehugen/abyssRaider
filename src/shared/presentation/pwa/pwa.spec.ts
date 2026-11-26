import { describe, expect, it, vi } from 'vitest'
import { createOnlineState } from './useOnline'
import { createInstallController, installAction, type BeforeInstallPromptEvent } from './usePwaInstall'
import { createUpdateController, type RegisterSW } from './usePwaUpdate'

/** window/document de mentira: guarda os listeners e dispara eventos. */
function fakeTarget() {
  const listeners = new Map<string, Set<(e: Event) => void>>()
  return {
    addEventListener: (type: string, fn: (e: Event) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(fn)
    },
    removeEventListener: (type: string, fn: (e: Event) => void) => listeners.get(type)?.delete(fn),
    emit: (type: string, event: Event = new Event(type)) => listeners.get(type)?.forEach((fn) => fn(event)),
    count: (type: string) => listeners.get(type)?.size ?? 0,
  }
}

const standalone = (matches: boolean) => ({ matches }) as MediaQueryList

function installEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt') as BeforeInstallPromptEvent
  Object.assign(event, { prompt: vi.fn(async () => {}), userChoice: Promise.resolve({ outcome }) })
  return event
}

describe('useOnline', () => {
  it('começa com o estado do navegador e acompanha os eventos', () => {
    const target = fakeTarget()
    const state = createOnlineState({ navigator: { onLine: false }, target })
    expect(state.online.value).toBe(false)
    target.emit('online')
    expect(state.online.value).toBe(true)
    target.emit('offline')
    expect(state.online.value).toBe(false)
    state.dispose()
    expect(target.count('online')).toBe(0)
  })
})

describe('usePwaInstall', () => {
  it('guarda o convite do navegador e instala pelo botão do app', async () => {
    const target = fakeTarget()
    const install = createInstallController({ target, standalone: standalone(false), navigator: { userAgent: 'Android' } })
    expect(install.canInstall.value).toBe(false)

    const event = installEvent('accepted')
    const preventDefault = vi.spyOn(event, 'preventDefault')
    target.emit('beforeinstallprompt', event)
    expect(preventDefault).toHaveBeenCalled() // sem o banner automático do navegador
    expect(install.canInstall.value).toBe(true)

    expect(await install.install()).toBe(true)
    expect(event.prompt).toHaveBeenCalled()
    expect(install.canInstall.value).toBe(false) // o convite só vale uma vez
  })

  it('some quando o app já está instalado ou acabou de ser instalado', () => {
    const target = fakeTarget()
    const installed = createInstallController({ target, standalone: standalone(true), navigator: { userAgent: 'iPhone' } })
    target.emit('beforeinstallprompt', installEvent('accepted'))
    expect(installed.isInstalled.value).toBe(true)
    expect(installed.canInstall.value).toBe(false)
    expect(installed.needsManualSteps.value).toBe(false)

    const other = fakeTarget()
    const install = createInstallController({ target: other, standalone: standalone(false), navigator: { userAgent: 'Android' } })
    other.emit('beforeinstallprompt', installEvent('accepted'))
    other.emit('appinstalled')
    expect(install.isInstalled.value).toBe(true)
    expect(install.canInstall.value).toBe(false)
  })

  it('no iPhone/iPad (sem convite do navegador) pede os passos manuais', () => {
    const iphone = createInstallController({ target: fakeTarget(), standalone: standalone(false), navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' } })
    expect(iphone.needsManualSteps.value).toBe(true)
    // iPad se apresenta como Mac, mas tem toque.
    const ipad = createInstallController({ target: fakeTarget(), standalone: standalone(false), navigator: { userAgent: 'Macintosh', maxTouchPoints: 5 } })
    expect(ipad.needsManualSteps.value).toBe(true)
    const android = createInstallController({ target: fakeTarget(), standalone: standalone(false), navigator: { userAgent: 'Android' } })
    expect(android.needsManualSteps.value).toBe(false)
  })

  it('recusar o convite devolve false', async () => {
    const target = fakeTarget()
    const install = createInstallController({ target, standalone: standalone(false), navigator: { userAgent: 'Android' } })
    target.emit('beforeinstallprompt', installEvent('dismissed'))
    expect(await install.install()).toBe(false)
  })
})

describe('installAction', () => {
  it('com convite do navegador, instala direto; no iPhone, mostra os passos; instalado, some', async () => {
    const target = fakeTarget()
    const android = createInstallController({ target, standalone: standalone(false), navigator: { userAgent: 'Android' } })
    expect(installAction(android).visible.value).toBe(false)
    target.emit('beforeinstallprompt', installEvent('accepted'))
    expect(installAction(android).visible.value).toBe(true)
    expect(await installAction(android).run()).toBe('prompted')

    const iphone = createInstallController({ target: fakeTarget(), standalone: standalone(false), navigator: { userAgent: 'iPhone' } })
    expect(installAction(iphone).visible.value).toBe(true)
    expect(await installAction(iphone).run()).toBe('manual')

    const installed = createInstallController({ target: fakeTarget(), standalone: standalone(true), navigator: { userAgent: 'iPhone' } })
    expect(installAction(installed).visible.value).toBe(false)
  })
})

describe('usePwaUpdate', () => {
  function setup() {
    let options: Parameters<RegisterSW>[0] = {}
    const updateSW = vi.fn(async () => {})
    const register: RegisterSW = (o) => {
      options = o
      return updateSW
    }
    const doc = Object.assign(fakeTarget(), { visibilityState: 'visible' as DocumentVisibilityState })
    let tick: (() => void) | null = null
    let later: (() => void) | null = null
    const reload = vi.fn()
    const controller = createUpdateController({
      register,
      document: doc,
      setInterval: (fn) => {
        tick = fn
        return 1
      },
      clearInterval: vi.fn(),
      setTimeout: (fn) => {
        later = fn
        return 2
      },
      reload,
    })
    const registration = { update: vi.fn(async () => {}), installing: null } as unknown as ServiceWorkerRegistration
    return { controller, options: () => options, updateSW, doc, registration, tick: () => tick?.(), later: () => later?.(), reload }
  }

  it('avisa quando há versão nova e só recarrega quando a pessoa pede', async () => {
    const { controller, options, updateSW } = setup()
    expect(controller.needRefresh.value).toBe(false)
    options().onNeedRefresh?.()
    expect(controller.needRefresh.value).toBe(true)
    expect(updateSW).not.toHaveBeenCalled() // nunca recarrega sozinho

    await controller.update()
    expect(updateSW).toHaveBeenCalledWith(true)
  })

  it('"Agora não" esconde o aviso (a versão nova entra na próxima abertura)', () => {
    const { controller, options } = setup()
    options().onNeedRefresh?.()
    controller.dismiss()
    expect(controller.needRefresh.value).toBe(false)
  })

  it('procura versão nova a cada hora e quando o app volta para a frente', () => {
    const { options, registration, doc, tick } = setup()
    options().onRegisteredSW?.('/sw.js', registration)

    tick()
    expect(registration.update).toHaveBeenCalledTimes(1)

    doc.visibilityState = 'hidden'
    doc.emit('visibilitychange')
    expect(registration.update).toHaveBeenCalledTimes(1)

    doc.visibilityState = 'visible'
    doc.emit('visibilitychange')
    expect(registration.update).toHaveBeenCalledTimes(2)
  })

  it('"Atualizar" que não pega (service worker sumiu): recarrega mesmo assim, em vez de girar para sempre', async () => {
    const { controller, later, reload } = setup()
    await controller.update()
    expect(reload).not.toHaveBeenCalled()
    later()
    expect(reload).toHaveBeenCalled()
  })
})
