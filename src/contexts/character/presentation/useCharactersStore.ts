import { errorMessage } from '@/shared/lib/errorMessage'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { getContainer } from '@/app/container'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { linkCharacter } from '../application/linkCharacter'
import type { CharacterRef } from '../domain/CharacterDirectory'
import type { LinkedCharacter } from '../domain/LinkedCharacter'

/** Chave estável de um personagem do jogo (o characterId só é único por servidor). */
export function characterKey(c: { region: string; serverId: number; id: string }): string {
  return `${c.region}:${c.serverId}:${c.id}`
}

/** Personagens vinculados à conta logada. */
export const useCharactersStore = defineStore('characters', () => {
  const items = ref<LinkedCharacter[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)
  /** Chaves (characterKey ou linkId) com operação em andamento. */
  const pending = ref(new Set<string>())

  const linkedKeys = computed(() => new Set(items.value.map((l) => characterKey(l.character))))

  function ownerId(): string {
    const id = useAuthStore().user?.id
    if (!id) throw new Error('Faça login para gerenciar personagens.')
    return id
  }

  async function withPending<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
    pending.value = new Set(pending.value).add(key)
    error.value = null
    try {
      return await fn()
    } catch (e) {
      error.value = errorMessage(e)
      return undefined
    } finally {
      const next = new Set(pending.value)
      next.delete(key)
      pending.value = next
    }
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      items.value = await getContainer().characterRepository.listByOwner(ownerId())
      loaded.value = true
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  }

  function upsertLocal(linked: LinkedCharacter) {
    const i = items.value.findIndex((l) => l.linkId === linked.linkId)
    if (i >= 0) items.value.splice(i, 1, linked)
    else items.value.push(linked)
  }

  /** Vincula (ou atualiza, se já for seu) buscando os dados completos na API. */
  async function link(target: CharacterRef): Promise<boolean> {
    const { characterDirectory: directory, characterRepository: repository } = getContainer()
    const linked = await withPending(characterKey(target), () =>
      linkCharacter({ directory, repository }, ownerId(), target, items.value),
    )
    if (linked) upsertLocal(linked)
    return Boolean(linked)
  }

  function refresh(linked: LinkedCharacter) {
    const { region, serverId, id } = linked.character
    return link({ region, serverId, id })
  }

  async function unlink(linked: LinkedCharacter) {
    await withPending(linked.linkId, async () => {
      await getContainer().characterRepository.remove(linked.linkId)
      items.value = items.value.filter((l) => l.linkId !== linked.linkId)
    })
  }

  function isPending(key: string) {
    return pending.value.has(key)
  }

  function reset() {
    items.value = []
    loaded.value = false
    error.value = null
  }

  // Trocou de conta (ou saiu): descarta a lista da conta anterior.
  watch(
    () => useAuthStore().user?.id,
    (id, previous) => {
      if (id !== previous) reset()
    },
  )

  return { items, loading, loaded, error, linkedKeys, load, link, refresh, unlink, isPending, reset }
})
