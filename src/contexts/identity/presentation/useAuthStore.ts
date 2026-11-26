import { errorMessage } from '@/shared/lib/errorMessage'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getContainer } from '@/app/container'
import type { User } from '@/contexts/identity/domain/User'

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const status = ref<AuthStatus>('idle')
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => status.value === 'authenticated')

  let initPromise: Promise<void> | null = null

  function setUser(next: User | null) {
    user.value = next
    status.value = next ? 'authenticated' : 'anonymous'
    // Entrou (ex.: a sessão renovou depois de abrir offline): o erro antigo não vale mais.
    if (next) error.value = null
  }

  /** Idempotente: pode ser chamado pelo guard de rota e por componentes. */
  function init(): Promise<void> {
    initPromise ??= (async () => {
      const repo = getContainer().authRepository
      status.value = 'loading'
      try {
        setUser(await repo.getCurrentUser())
      } catch (e) {
        error.value = errorMessage(e)
        setUser(null)
      }
      // Vale pela vida do app: a sessão muda em outra aba, ao renovar ou ao expirar.
      repo.onChange(setUser)
    })()
    return initPromise
  }

  async function signIn(next = '/') {
    error.value = null
    const redirectTo = new URL('/auth/callback', window.location.origin)
    redirectTo.searchParams.set('next', next)
    try {
      await getContainer().authRepository.signInWithDiscord(redirectTo.toString())
    } catch (e) {
      error.value = errorMessage(e)
    }
  }

  /** Sai mesmo se a chamada falhar (sem rede): a sessão local é descartada. */
  async function signOut() {
    try {
      await getContainer().authRepository.signOut()
    } catch (e) {
      console.error(e)
    } finally {
      setUser(null)
    }
  }

  return { user, status, error, isAuthenticated, init, signIn, signOut }
})
