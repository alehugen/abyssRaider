import { afterEach, describe, expect, it, vi } from 'vitest'
import { onAppResume } from './useRefreshOnResume'

const setVisibility = (state: 'visible' | 'hidden') =>
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })

afterEach(() => {
  vi.useRealTimers()
  setVisibility('visible')
})

describe('onAppResume', () => {
  it('chama ao voltar para o app, ao ganhar foco e ao reconectar, mas não em sequência', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const stop = onAppResume(fn)
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus')) // o mesmo retorno dispara os dois: conta uma vez
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(3000)
    window.dispatchEvent(new Event('online'))
    expect(fn).toHaveBeenCalledTimes(2)
    stop()
  })

  it('não chama ao ir para segundo plano, nem depois de parar', () => {
    const fn = vi.fn()
    const stop = onAppResume(fn)
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fn).not.toHaveBeenCalled()
    stop()
    setVisibility('visible')
    window.dispatchEvent(new Event('online'))
    expect(fn).not.toHaveBeenCalled()
  })
})
