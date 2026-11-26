import { describe, expect, it, vi } from 'vitest'
import { SW_MESSAGE } from '@/sw/pushHandlers'
import { listenToServiceWorker, setAppBadge } from './swMessages'

function fakeContainer() {
  const target = new EventTarget()
  return {
    target,
    send: (data: unknown) => target.dispatchEvent(new MessageEvent('message', { data })),
  }
}

describe('listenToServiceWorker', () => {
  it('toque na notificação com o app aberto: navega pelo router (só caminhos do app)', () => {
    const sw = fakeContainer()
    const onOpen = vi.fn()
    const stop = listenToServiceWorker({ onOpen, onPush: vi.fn() }, sw.target)
    sw.send({ type: SW_MESSAGE.open, url: '/parties/1' })
    sw.send({ type: SW_MESSAGE.open, url: 'https://outro.site' })
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith('/parties/1')
    stop()
    sw.send({ type: SW_MESSAGE.open, url: '/agenda' })
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('push chegou: avisa (o sino confere na hora); outras mensagens são ignoradas', () => {
    const sw = fakeContainer()
    const onPush = vi.fn()
    listenToServiceWorker({ onOpen: vi.fn(), onPush }, sw.target)
    sw.send({ type: SW_MESSAGE.push })
    sw.send({ type: 'SKIP_WAITING' })
    sw.send(null)
    expect(onPush).toHaveBeenCalledTimes(1)
  })

  it('sem service worker (navegador antigo, testes): não faz nada', () => {
    expect(() => listenToServiceWorker({ onOpen: vi.fn(), onPush: vi.fn() }, null)()).not.toThrow()
  })
})

describe('setAppBadge', () => {
  it('mostra o número de não lidas no ícone e limpa quando zera', () => {
    const nav = { setAppBadge: vi.fn(async () => {}), clearAppBadge: vi.fn(async () => {}) }
    setAppBadge(3, nav)
    setAppBadge(0, nav)
    expect(nav.setAppBadge).toHaveBeenCalledWith(3)
    expect(nav.clearAppBadge).toHaveBeenCalled()
  })

  it('navegador sem suporte: ignora', () => {
    expect(() => setAppBadge(2, {})).not.toThrow()
  })
})
