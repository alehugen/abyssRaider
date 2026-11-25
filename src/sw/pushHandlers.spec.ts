import { describe, expect, it, vi } from 'vitest'
import { openFromNotification, parsePushPayload, showPush } from './pushHandlers'

const data = (value: unknown) => ({ json: () => value })

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
  })
})

describe('showPush', () => {
  it('mostra com ícone do app, tag e o link nos dados', async () => {
    const reg = { showNotification: vi.fn(async () => {}) }
    await showPush(reg, data({ title: 'Patch notes novos', body: 'Atualização', url: '/patch-notes/9', tag: 'patch-9' }))
    expect(reg.showNotification).toHaveBeenCalledWith('Patch notes novos', {
      body: 'Atualização',
      tag: 'patch-9',
      renotify: true,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url: '/patch-notes/9' },
    })
  })
})

describe('openFromNotification', () => {
  const origin = 'https://app.test'

  it('com o app aberto: leva a aba para a página e traz para a frente', async () => {
    const tab = { url: 'https://app.test/agenda', focus: vi.fn(async () => tab), navigate: vi.fn(async () => tab) }
    const clients = { matchAll: vi.fn(async () => [tab]), openWindow: vi.fn(async () => null) }
    await openFromNotification(clients, { url: '/parties/1' }, origin)
    expect(tab.navigate).toHaveBeenCalledWith('https://app.test/parties/1')
    expect(tab.focus).toHaveBeenCalled()
    expect(clients.openWindow).not.toHaveBeenCalled()
  })

  it('com o app fechado: abre uma janela nova', async () => {
    const clients = { matchAll: vi.fn(async () => []), openWindow: vi.fn(async () => null) }
    await openFromNotification(clients, { url: '/patch-notes/9' }, origin)
    expect(clients.openWindow).toHaveBeenCalledWith('https://app.test/patch-notes/9')
  })

  it('se a aba não deixa navegar, abre uma janela nova', async () => {
    const tab = { url: 'https://app.test/', focus: vi.fn(async () => tab), navigate: vi.fn(async () => { throw new Error('x') }) }
    const clients = { matchAll: vi.fn(async () => [tab]), openWindow: vi.fn(async () => null) }
    await openFromNotification(clients, { url: '/agenda' }, origin)
    expect(clients.openWindow).toHaveBeenCalledWith('https://app.test/agenda')
  })
})
