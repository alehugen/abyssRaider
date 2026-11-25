import { describe, expect, it, vi } from 'vitest'
import type { PushDevice, PushDeviceRepository, PushPreferences } from '../../domain/PushDevice'
import { createPushController, urlBase64ToUint8Array, type BrowserPushSubscription, type PushBrowser } from './pushController'

function fakeRepo(initial: Record<string, { locale: string; preferences: PushPreferences }> = {}) {
  const rows = new Map(Object.entries(initial))
  const repo: PushDeviceRepository & { rows: typeof rows } = {
    rows,
    find: vi.fn(async (endpoint: string) => rows.get(endpoint) ?? null),
    save: vi.fn(async (d: PushDevice) => void rows.set(d.endpoint, { locale: d.locale, preferences: d.preferences })),
    remove: vi.fn(async (endpoint: string) => void rows.delete(endpoint)),
  }
  return repo
}

function fakeBrowser(over: Partial<PushBrowser> = {}, existing: BrowserPushSubscription | null = null) {
  let current = existing
  let permission: NotificationPermission = existing ? 'granted' : 'default'
  const sub = (endpoint: string): BrowserPushSubscription => ({
    endpoint,
    p256dh: 'key',
    auth: 'auth',
    unsubscribe: vi.fn(async () => {
      current = null
      return true
    }),
  })
  const browser: PushBrowser = {
    supported: true,
    permission: () => permission,
    requestPermission: vi.fn(async (): Promise<NotificationPermission> => (permission = 'granted')),
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => (current = sub('https://push.test/novo'))),
    ...over,
  }
  return { browser, sub, setPermission: (p: NotificationPermission) => (permission = p) }
}

const setup = (opts: { repo?: ReturnType<typeof fakeRepo>; browser?: PushBrowser; vapidKey?: string; locale?: string; iosNotInstalled?: boolean } = {}) =>
  createPushController({
    repo: opts.repo ?? fakeRepo(),
    browser: opts.browser ?? fakeBrowser().browser,
    vapidKey: 'vapidKey' in opts ? opts.vapidKey : 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
    locale: () => opts.locale ?? 'pt-BR',
    needsInstall: () => opts.iosNotInstalled ?? false,
  })

describe('createPushController: estado', () => {
  it('navegador sem push: "unsupported", ou "needsInstall" no iPhone fora da Tela de Início', async () => {
    const c = setup({ browser: fakeBrowser({ supported: false }).browser })
    await c.refresh()
    expect(c.status.value).toBe('unsupported')
    const ios = setup({ browser: fakeBrowser({ supported: false }).browser, iosNotInstalled: true })
    await ios.refresh()
    expect(ios.status.value).toBe('needsInstall')
  })

  it('sem chave VAPID no build: "unconfigured"', async () => {
    const c = setup({ vapidKey: undefined })
    await c.refresh()
    expect(c.status.value).toBe('unconfigured')
  })

  it('permissão negada no navegador: "denied"', async () => {
    const { browser, setPermission } = fakeBrowser()
    setPermission('denied')
    const c = setup({ browser })
    await c.refresh()
    expect(c.status.value).toBe('denied')
  })

  it('ligado só quando o aparelho está inscrito E salvo nesta conta', async () => {
    const { browser, sub } = fakeBrowser({}, null)
    const c1 = setup({ browser })
    await c1.refresh()
    expect(c1.status.value).toBe('off')

    const existing = sub('https://push.test/1')
    const outraConta = setup({ browser: fakeBrowser({}, existing).browser })
    await outraConta.refresh()
    expect(outraConta.status.value).toBe('off')

    const repo = fakeRepo({ 'https://push.test/1': { locale: 'pt-BR', preferences: { raids: true, patchNotes: false } } })
    const c2 = setup({ browser: fakeBrowser({}, existing).browser, repo })
    await c2.refresh()
    expect(c2.status.value).toBe('on')
    expect(c2.preferences.value).toEqual({ raids: true, patchNotes: false })
  })

  it('trocou o idioma do app: atualiza o idioma das notificações deste aparelho', async () => {
    const { browser, sub } = fakeBrowser()
    const existing = sub('https://push.test/1')
    const repo = fakeRepo({ 'https://push.test/1': { locale: 'pt-BR', preferences: { raids: true, patchNotes: true } } })
    const c = setup({ browser: fakeBrowser({}, existing).browser, repo, locale: 'en' })
    await c.refresh()
    expect(repo.rows.get('https://push.test/1')?.locale).toBe('en')
    expect(browser).toBeTruthy()
  })
})

describe('createPushController: ações', () => {
  it('ativar: pede permissão, inscreve com a chave VAPID e salva com o idioma e as preferências', async () => {
    const repo = fakeRepo()
    const { browser } = fakeBrowser()
    const c = setup({ repo, browser, locale: 'es' })
    await c.refresh()
    await c.enable()
    expect(browser.requestPermission).toHaveBeenCalled()
    expect(browser.subscribe).toHaveBeenCalledWith(expect.any(Uint8Array))
    expect(repo.save).toHaveBeenCalledWith({
      endpoint: 'https://push.test/novo',
      p256dh: 'key',
      auth: 'auth',
      locale: 'es',
      preferences: { raids: true, patchNotes: true },
    })
    expect(c.status.value).toBe('on')
  })

  it('ativar e a pessoa nega: fica "denied" e nada é salvo', async () => {
    const repo = fakeRepo()
    const { browser, setPermission } = fakeBrowser({
      requestPermission: vi.fn(async () => {
        setPermission('denied')
        return 'denied' as const
      }),
    })
    const c = setup({ repo, browser })
    await c.enable()
    expect(c.status.value).toBe('denied')
    expect(repo.save).not.toHaveBeenCalled()
  })

  it('erro ao salvar: mostra o erro e continua desligado', async () => {
    const repo = fakeRepo()
    repo.save = vi.fn(async () => {
      throw new Error('Failed to fetch')
    })
    const c = setup({ repo })
    await c.enable()
    expect(c.status.value).toBe('off')
    expect(c.error.value).toBeTruthy()
    expect(c.busy.value).toBe(false)
  })

  it('desativar: apaga desta conta e cancela a inscrição do navegador', async () => {
    const repo = fakeRepo()
    const { browser } = fakeBrowser()
    const c = setup({ repo, browser })
    await c.enable()
    const sub = await browser.getSubscription()
    await c.disable()
    expect(repo.remove).toHaveBeenCalledWith('https://push.test/novo')
    expect(sub?.unsubscribe).toHaveBeenCalled()
    expect(c.status.value).toBe('off')
  })

  it('trocar preferência salva; se falhar, volta ao valor anterior', async () => {
    const repo = fakeRepo()
    const c = setup({ repo })
    await c.enable()
    await c.setPreferences({ raids: true, patchNotes: false })
    expect(repo.rows.get('https://push.test/novo')?.preferences.patchNotes).toBe(false)

    repo.save = vi.fn(async () => {
      throw new Error('Failed to fetch')
    })
    await c.setPreferences({ raids: false, patchNotes: false })
    expect(c.preferences.value).toEqual({ raids: true, patchNotes: false })
    expect(c.error.value).toBeTruthy()
  })

  it('sair da conta: o aparelho para de receber as notificações dela', async () => {
    const repo = fakeRepo()
    const { browser } = fakeBrowser()
    const c = setup({ repo, browser })
    await c.enable()
    await c.forgetDevice()
    expect(repo.rows.size).toBe(0)
    expect(await browser.getSubscription()).toBeNull()
    expect(c.status.value).toBe('off')
  })
})

describe('urlBase64ToUint8Array', () => {
  it('converte a chave pública (base64url) em bytes', () => {
    expect([...urlBase64ToUint8Array('AQID_-8')]).toEqual([1, 2, 3, 255, 239])
  })
})
