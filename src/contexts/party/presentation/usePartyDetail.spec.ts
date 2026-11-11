import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { getContainer, overrideContainer } from '@/app/container'
import type { PartyDetails } from '../domain/Party'
import { usePartyDetail } from './usePartyDetail'

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const details = (id: string) => ({ party: { id, name: id }, members: [] }) as unknown as PartyDetails

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('usePartyDetail', () => {
  it('trocar de party limpa a anterior e ignora a resposta atrasada', async () => {
    setActivePinia(createPinia())
    const slowA = deferred<PartyDetails | null>()
    const get = vi.fn((id: string) => (id === A ? slowA.promise : Promise.resolve(details(B))))
    overrideContainer({ partyRepository: { ...getContainer().partyRepository, get } })

    const id = ref(A)
    const p = usePartyDetail(id)
    const first = p.load()
    id.value = B
    await p.load()
    expect(p.details.value?.party.id).toBe(B)

    slowA.resolve(details(A)) // chegou depois: não pode sobrescrever
    await first
    expect(p.details.value?.party.id).toBe(B)
    expect(p.loading.value).toBe(false)
  })

  it('link com id inválido é "não existe", sem erro e sem consultar', async () => {
    setActivePinia(createPinia())
    const get = vi.fn()
    overrideContainer({ partyRepository: { ...getContainer().partyRepository, get } })
    const p = usePartyDetail('abc')
    await p.load()
    expect(get).not.toHaveBeenCalled()
    expect(p.notFound.value).toBe(true)
    expect(p.error.value).toBeNull()
  })

  it('uma ação por vez: a segunda é ignorada enquanto a primeira roda', async () => {
    setActivePinia(createPinia())
    const slow = deferred<void>()
    const decide = vi.fn(() => slow.promise)
    overrideContainer({
      partyRepository: { ...getContainer().partyRepository, get: async () => details(A), decide },
    })
    const p = usePartyDetail(A)
    const first = p.accept('m1')
    expect(await p.decline('m2')).toBe(false)
    expect(decide).toHaveBeenCalledTimes(1)
    slow.resolve()
    expect(await first).toBe(true)
    expect(p.busy.value).toBeNull()
  })

  it('party finalizada: o líder continua líder, mas não gerencia mais', async () => {
    setActivePinia(createPinia())
    const { useAuthStore } = await import('@/contexts/identity/presentation/useAuthStore')
    useAuthStore().user = { id: 'leader' } as never
    const finished = { party: { id: A, name: 'x', leaderId: 'leader', finishedAt: new Date() }, members: [] }
    overrideContainer({
      partyRepository: { ...getContainer().partyRepository, get: async () => finished as unknown as PartyDetails },
    })
    const p = usePartyDetail(A)
    await p.load()
    expect(p.isLeader.value).toBe(true)
    expect(p.finished.value).toBe(true)
    expect(p.canManage.value).toBe(false)
  })
})
