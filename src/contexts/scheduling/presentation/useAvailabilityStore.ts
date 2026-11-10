import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { getContainer } from '@/app/container'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { errorMessage } from '@/shared/lib/errorMessage'
import { normalizeWindows, windowsToRows, type TimeWindow } from '../domain/Availability'

/** Disponibilidade semanal da conta logada. */
export const useAvailabilityStore = defineStore('availability', () => {
  const windows = shallowRef<TimeWindow[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)
  const rows = computed(() => windowsToRows(windows.value))

  let loading: Promise<void> | null = null

  function load(): Promise<void> {
    loading ??= (async () => {
      const ownerId = useAuthStore().user?.id
      if (!ownerId) return
      error.value = null
      try {
        windows.value = await getContainer().availabilityRepository.listByOwner(ownerId)
        loaded.value = true
      } catch (e) {
        error.value = errorMessage(e)
        loading = null
      }
    })()
    return loading
  }

  /** Erros sobem para o diálogo exibir. */
  async function save(next: readonly TimeWindow[]): Promise<void> {
    const normalized = normalizeWindows(next)
    await getContainer().availabilityRepository.save(normalized)
    windows.value = normalized
    loaded.value = true
  }

  watch(
    () => useAuthStore().user?.id,
    (id, previous) => {
      if (id === previous) return
      windows.value = []
      loaded.value = false
      loading = null
    },
  )

  return { windows, rows, loaded, error, load, save }
})
