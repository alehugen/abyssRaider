/**
 * Composition root: liga as portas (interfaces do domínio) às implementações
 * de infraestrutura. Stores e casos de uso pegam dependências daqui, e os
 * testes podem substituí-las com `overrideContainer`.
 */
import type { AuthRepository } from '@/contexts/identity/domain/AuthRepository'
import { SupabaseAuthRepository } from '@/contexts/identity/infrastructure/SupabaseAuthRepository'
import { getSupabase, isSupabaseConfigured } from '@/shared/infrastructure/supabase/client'

export interface Container {
  authRepository: AuthRepository
}

/** Usado quando não há .env: o app abre, mas o login avisa que falta configuração. */
const unconfiguredAuth: AuthRepository = {
  getCurrentUser: async () => null,
  signInWithDiscord: async () => {
    throw new Error('Supabase não configurado (.env).')
  },
  signOut: async () => {},
  onChange: () => () => {},
}

let container: Container | null = null

export function getContainer(): Container {
  container ??= {
    authRepository: isSupabaseConfigured() ? new SupabaseAuthRepository(getSupabase()) : unconfiguredAuth,
  }
  return container
}

export function overrideContainer(partial: Partial<Container>): void {
  container = { ...getContainer(), ...partial }
}
