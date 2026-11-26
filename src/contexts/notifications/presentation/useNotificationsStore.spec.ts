import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { overrideContainer } from '@/app/container'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import type { AppNotification, NotificationRepository } from '../domain/Notification'
import { useNotificationsStore } from './useNotificationsStore'

const note = (id: number, minutesAgo = 0): AppNotification => ({
  id,
  kind: 'invite_received',
  partyId: 'p1',
  data: {},
  createdAt: new Date(Date.now() - minutesAgo * 60_000),
  readAt: null,
})

/** Resposta que o teste resolve quando quiser (para simular ordem de chegada). */
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

let pending: Array<ReturnType<typeof deferred<AppNotification[]>>> = []
let onReady: (() => void) | undefined
let repo: NotificationRepository

beforeEach(() => {
  setActivePinia(createPinia())
  pending = []
  onReady = undefined
  repo = {
    list: vi.fn(() => {
      const d = deferred<AppNotification[]>()
      pending.push(d)
      return d.promise
    }),
    markRead: vi.fn(async () => {}),
    markAllRead: vi.fn(async () => {}),
    subscribe: vi.fn((_userId, _onNew, ready) => {
      onReady = ready
      return () => {}
    }),
  }
  overrideContainer({ notificationRepository: repo })
  useAuthStore().user = { id: 'u1', discordId: null, displayName: 'Lyra', avatarUrl: null }
})

afterEach(() => vi.useRealTimers())

describe('useNotificationsStore', () => {
  it('resposta antiga não apaga o aviso que chegou em tempo real durante a consulta', async () => {
    const store = useNotificationsStore()
    const loading = store.refresh()
    store.add(note(2))
    pending[0]!.resolve([note(1, 5)])
    await loading
    expect(store.items.map((n) => n.id)).toEqual([2, 1])
  })

  it('respostas fora de ordem: vale a da consulta mais nova', async () => {
    const store = useNotificationsStore()
    const first = store.refresh()
    const second = store.refresh()
    pending[1]!.resolve([note(3), note(1, 5)])
    await second
    pending[0]!.resolve([note(1, 5)])
    await first
    expect(store.items.map((n) => n.id)).toEqual([3, 1])
  })

  it('confere de novo ao voltar para o app e quando o tempo real conecta', async () => {
    const store = useNotificationsStore()
    store.start()
    expect(repo.list).toHaveBeenCalledTimes(1)

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    onReady?.()
    expect(repo.list).toHaveBeenCalledTimes(3)
    store.stop()
  })

  it('não consulta em segundo plano (a aba escondida não gasta rede)', async () => {
    vi.useFakeTimers()
    const store = useNotificationsStore()
    store.start()
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    vi.advanceTimersByTime(60_000)
    expect(repo.list).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    vi.advanceTimersByTime(60_000)
    expect(repo.list).toHaveBeenCalledTimes(2)
    store.stop()
  })

  it('erro ao marcar como lida aparece e a lista volta ao estado real', async () => {
    const store = useNotificationsStore()
    const loading = store.refresh()
    pending[0]!.resolve([note(1)])
    await loading
    repo.markRead = vi.fn(async () => {
      throw new Error('Failed to fetch')
    })
    const marking = store.markRead([1])
    expect(store.unread).toBe(0)
    await Promise.resolve()
    await Promise.resolve()
    pending[1]?.resolve([note(1)])
    await marking
    expect(store.unread).toBe(1)
    expect(store.error).toBeTruthy()
  })
})
