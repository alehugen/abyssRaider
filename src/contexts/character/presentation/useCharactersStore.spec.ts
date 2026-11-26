import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { getContainer, overrideContainer } from '@/app/container'
import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { useCharactersStore } from './useCharactersStore'

const linked = (linkId: string) => ({ linkId }) as unknown as LinkedCharacter

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

beforeEach(() => setActivePinia(createPinia()))

describe('useCharactersStore', () => {
  it('trocou de conta durante a consulta: não mostra os personagens da conta anterior', async () => {
    const slow = deferred<LinkedCharacter[]>()
    const listByOwner = vi.fn((owner: string) => (owner === 'u1' ? slow.promise : Promise.resolve([linked('b1')])))
    overrideContainer({ characterRepository: { ...getContainer().characterRepository, listByOwner } })
    const auth = useAuthStore()
    auth.user = { id: 'u1', discordId: null, displayName: 'A', avatarUrl: null }
    const store = useCharactersStore()

    const first = store.load()
    auth.user = { id: 'u2', discordId: null, displayName: 'B', avatarUrl: null }
    await nextTick() // o watch da conta limpa o store
    await store.load()
    slow.resolve([linked('a1')])
    await first

    expect(store.items.map((l) => l.linkId)).toEqual(['b1'])
  })
})
