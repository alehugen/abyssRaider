import { errorMessage } from '@/shared/lib/errorMessage'
import { defineStore } from 'pinia'
import { ref, shallowRef, watch } from 'vue'
import { getContainer } from '@/app/container'
import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { applyToSanctuary } from '../application/applyToSanctuary'
import type { RaidApplication } from '../domain/RaidApplication'
import type { Sanctuary } from '../domain/Sanctuary'

/** Santuários abertos e as aplicações dos personagens da conta logada. */
export const useRaidApplicationsStore = defineStore('raidApplications', () => {
  const sanctuaries = shallowRef<Sanctuary[]>([])
  const applications = ref<RaidApplication[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)

  let loading: Promise<void> | null = null

  function load(): Promise<void> {
    loading ??= (async () => {
      const ownerId = useAuthStore().user?.id
      if (!ownerId) return
      const { sanctuaryCatalog, raidApplicationRepository } = getContainer()
      try {
        const [list, mine] = await Promise.all([
          sanctuaryCatalog.listActive(),
          raidApplicationRepository.listByOwner(ownerId),
        ])
        sanctuaries.value = list
        applications.value = mine
        loaded.value = true
      } catch (e) {
        error.value = errorMessage(e)
        loading = null
      }
    })()
    return loading
  }

  function sanctuaryById(id: string): Sanctuary | undefined {
    return sanctuaries.value.find((s) => s.id === id)
  }

  function forCharacter(linkId: string): RaidApplication[] {
    return applications.value.filter((a) => a.characterLinkId === linkId)
  }

  /** Lança o erro (NotEligible, AlreadyApplied...) para o diálogo exibir. */
  async function apply(linked: LinkedCharacter, sanctuary: Sanctuary): Promise<void> {
    const created = await applyToSanctuary(
      getContainer().raidApplicationRepository,
      linked,
      sanctuary,
      applications.value,
    )
    applications.value.push(created)
  }

  async function withdraw(application: RaidApplication): Promise<void> {
    error.value = null
    try {
      await getContainer().raidApplicationRepository.withdraw(application.id)
      applications.value = applications.value.filter((a) => a.id !== application.id)
    } catch (e) {
      error.value = errorMessage(e)
    }
  }

  // Trocou de conta: descarta o estado da conta anterior.
  watch(
    () => useAuthStore().user?.id,
    (id, previous) => {
      if (id === previous) return
      applications.value = []
      loaded.value = false
      loading = null
    },
  )

  return { sanctuaries, applications, loaded, error, load, sanctuaryById, forCharacter, apply, withdraw }
})
