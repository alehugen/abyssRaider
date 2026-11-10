import { errorMessage } from '@/shared/lib/errorMessage'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { getContainer } from '@/app/container'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import type { PartySummary } from '../domain/Party'
import type { CreatePartyInput } from '../domain/PartyRepository'

/** Parties em que o usuário logado é líder, membro ou tem pedido pendente. */
export const usePartiesStore = defineStore('parties', () => {
  const items = ref<PartySummary[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    const userId = useAuthStore().user?.id
    if (!userId) return
    loading.value = true
    error.value = null
    try {
      items.value = await getContainer().partyRepository.listMine(userId)
      loaded.value = true
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  }

  /** Cria e devolve o id; erros sobem para o diálogo exibir. */
  async function create(input: CreatePartyInput): Promise<string> {
    const id = await getContainer().partyRepository.create(input)
    loaded.value = false // a lista será recarregada na próxima visita
    return id
  }

  function invalidate() {
    loaded.value = false
  }

  watch(
    () => useAuthStore().user?.id,
    (id, previous) => {
      if (id === previous) return
      items.value = []
      loaded.value = false
    },
  )

  return { items, loading, loaded, error, load, create, invalidate }
})
