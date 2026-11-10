import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { getContainer } from '@/app/container'
import { errorMessage } from '@/shared/lib/errorMessage'
import type { Sanctuary } from '../domain/Sanctuary'

/** Santuários ativos. Muda raramente: carrega uma vez por sessão. */
export const useSanctuariesStore = defineStore('sanctuaries', () => {
  const sanctuaries = shallowRef<Sanctuary[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)

  let loading: Promise<void> | null = null

  function load(): Promise<void> {
    loading ??= (async () => {
      try {
        sanctuaries.value = await getContainer().sanctuaryCatalog.listActive()
        loaded.value = true
      } catch (e) {
        error.value = errorMessage(e)
        loading = null
      }
    })()
    return loading
  }

  return { sanctuaries, loaded, error, load }
})
