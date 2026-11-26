import { describe, expect, it, vi } from 'vitest'
import { openFromNotification, parsePushPayload, showPush, SW_MESSAGE } from './pushHandlers'

const data = (value: unknown) => ({ json: () => value })
const origin = 'https://app.test'

describe('parsePushPayload', () => {
  it('usa o que a função de envio mandou', () => {
    const p = parsePushPayload(data({ title: 'Raid marcada', body: 'Hoje', url: '/parties/1', tag: 'raid-1' }))
    expect(p).toEqual({ title: 'Raid marcada', body: 'Hoje', url: '/parties/1', tag: 'raid-1' })
  })

  it('sem dados ou com JSON quebrado: notificação genérica do app', () => {
    expect(parsePushPayload(null)).toMatchObject({ title: 'AbyssRaider', url: '/' })
    expect(parsePushPayload({ json: () => { throw new Error('x') } })).toMatchObject({ title: 'AbyssRaider' })
  })

  it('link para fora do app vira a página inicial', () => {
    expect(parsePushPayload(data({ title: 'x', url: 'https://outro.site' })).url).toBe('/')
    expect(parsePushPayload(data({ title: 'x', url: '//outro.site' })).url).toBe('/')
    expect(parsePushPayload(data({ title: 'x', url: '/\\outro.site' })).url).toBe('/')
  })
})

describe('showPush', () => {
  const env = () => {
    const tabs = [{ postMessage: vi.fn() }]
    return {
      registration: { showNotification: vi.fn(async () => {}) },
      clients: { matchAll: vi.fn(async () => tabs) },
      setAppBadge: vi.fn(async () => {}),
    }
  }

  it('mostra com ícone do app, tag e o link nos dados', async () => {
    const e = env()
    await showPush(e, data({ title: 'Patch notes novos', body: 'Atualização', url: '/patch-notes/9', tag: 'patch-9' }))
    expect(e.registration.showNotification).toHaveBeenCalledWith('Patch notes novos', {
      body: 'Atualização',
      tag: 'patch-9',
      renotify: true,
      icon: '/pwa-192x192.png',
      badge: '/notification-badge.png',
      data: { url: '/patch-notes/9' },
    })
  })

  it('marca o ícone do app e avisa as abas abertas (o sino atualiza na hora)', async () => {
    const e = env()
    await showPush(e, data({ title: 'x', url: '/' }))
    expect(e.setAppBadge).toHaveBeenCalled()
    const tabs = await e.clients.matchAll()
    expect(tabs[0]!.postMessage).toHaveBeenCalledWith({ type: SW_MESSAGE.push })
  })

  it('sem suporte a selo no ícone: só mostra a notificação', async () => {
    const e = { ...env(), setAppBadge: undefined }
    await expect(showPush(e, data({ title: 'x' }))).resolves.toBeUndefined()
    expect(e.registration.showNotification).toHaveBeenCalled()
  })
})

describe('openFromNotification', () => {
  const tab = (url: string, over: Record<string, unknown> = {}) => {
    const t = {
      url,
      focused: false,
      visibilityState: 'hidden',
      focus: vi.fn(async () => t),
      navigate: vi.fn(async () => t),
      postMessage: vi.fn(),
      ...over,
    }
    return t
  }

  it('com o app aberto: traz a aba para a frente e pede ao app para navegar (sem recarregar)', async () => {
    const open = tab('https://app.test/agenda')
    const clients = { matchAll: vi.fn(async () => [open]), openWindow: vi.fn(async () => null) }
    await openFromNotification(clients, { url: '/parties/1' }, origin)
    expect(open.focus).toHaveBeenCalled()
    expect(open.postMessage).toHaveBeenCalledWith({ type: SW_MESSAGE.open, url: '/parties/1' })
    expect(open.navigate).not.toHaveBeenCalled()
    expect(clients.openWindow).not.toHaveBeenCalled()
  })

  it('várias abas: usa a que está na tela', async () => {
    const back = tab('https://app.test/me')
    const front = tab('https://app.test/agenda', { visibilityState: 'visible' })
    const clients = { matchAll: vi.fn(async () => [back, front]), openWindow: vi.fn(async () => null) }
    await openFromNotification(clients, { url: '/agenda' }, origin)
    expect(front.postMessage).toHaveBeenCalled()
    expect(back.postMessage).not.toHaveBeenCalled()
  })

  it('com o app fechado: abre uma janela nova', async () => {
    const clients = { matchAll: vi.fn(async () => []), openWindow: vi.fn(async () => null) }
    await openFromNotification(clients, { url: '/patch-notes/9' }, origin)
    expect(clients.openWindow).toHaveBeenCalledWith('https://app.test/patch-notes/9')
  })

  it('se a aba não aceita foco, abre uma janela nova', async () => {
    const open = tab('https://app.test/', { focus: vi.fn(async () => { throw new Error('x') }) })
    const clients = { matchAll: vi.fn(async () => [open]), openWindow: vi.fn(async () => null) }
    await openFromNotification(clients, { url: '/agenda' }, origin)
    expect(clients.openWindow).toHaveBeenCalledWith('https://app.test/agenda')
  })
})
