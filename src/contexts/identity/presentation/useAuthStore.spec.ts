import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { overrideContainer } from '@/app/container'
import type { AuthRepository } from '@/contexts/identity/domain/AuthRepository'
import type { User } from '@/contexts/identity/domain/User'
import { useAuthStore } from './useAuthStore'

const lele: User = { id: 'u1', discordId: '1', displayName: 'Lele', avatarUrl: null }

function fakeRepo(initial: User | null) {
  let listener: ((u: User | null) => void) | null = null
  const repo: AuthRepository = {
    getCurrentUser: vi.fn(async () => initial),
    signInWithDiscord: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    onChange: vi.fn((fn) => {
      listener = fn
      return () => (listener = null)
    }),
  }
  return { repo, emit: (u: User | null) => listener?.(u) }
}

describe('useAuthStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('init carrega o usuário atual uma única vez', async () => {
    const { repo } = fakeRepo(lele)
    overrideContainer({ authRepository: repo })
    const auth = useAuthStore()

    await Promise.all([auth.init(), auth.init()])

    expect(repo.getCurrentUser).toHaveBeenCalledTimes(1)
    expect(auth.status).toBe('authenticated')
    expect(auth.user?.displayName).toBe('Lele')
  })

  it('reage a mudanças de sessão', async () => {
    const { repo, emit } = fakeRepo(null)
    overrideContainer({ authRepository: repo })
    const auth = useAuthStore()
    await auth.init()
    expect(auth.status).toBe('anonymous')

    emit(lele)
    expect(auth.isAuthenticated).toBe(true)
    emit(null)
    expect(auth.isAuthenticated).toBe(false)
  })

  it('signIn envia o callback com o destino', async () => {
    const { repo } = fakeRepo(null)
    overrideContainer({ authRepository: repo })
    const auth = useAuthStore()

    await auth.signIn('/me')

    const url = new URL(vi.mocked(repo.signInWithDiscord).mock.calls[0]![0])
    expect(url.pathname).toBe('/auth/callback')
    expect(url.searchParams.get('next')).toBe('/me')
  })

  it('signIn expõe o erro sem lançar', async () => {
    const { repo } = fakeRepo(null)
    vi.mocked(repo.signInWithDiscord).mockRejectedValueOnce(new Error('provider disabled'))
    overrideContainer({ authRepository: repo })
    const auth = useAuthStore()

    await auth.signIn()
    expect(auth.error).toContain('login com Discord não está habilitado')
  })

  it('signOut limpa o usuário', async () => {
    const { repo } = fakeRepo(lele)
    overrideContainer({ authRepository: repo })
    const auth = useAuthStore()
    await auth.init()

    await auth.signOut()
    expect(auth.user).toBeNull()
    expect(auth.status).toBe('anonymous')
  })
})
