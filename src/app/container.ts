/**
 * Composition root: liga as portas (interfaces do domínio) às implementações
 * de infraestrutura. Stores e casos de uso pegam dependências daqui, e os
 * testes podem substituí-las com `overrideContainer`.
 */
import type { CharacterDirectory } from '@/contexts/character/domain/CharacterDirectory'
import type { CharacterRepository } from '@/contexts/character/domain/CharacterRepository'
import { HttpCharacterDirectory } from '@/contexts/character/infrastructure/HttpCharacterDirectory'
import { SupabaseCharacterRepository } from '@/contexts/character/infrastructure/SupabaseCharacterRepository'
import type { AuthRepository } from '@/contexts/identity/domain/AuthRepository'
import { SupabaseAuthRepository } from '@/contexts/identity/infrastructure/SupabaseAuthRepository'
import { getSupabase, isSupabaseConfigured } from '@/shared/infrastructure/supabase/client'

export interface Container {
  authRepository: AuthRepository
  characterDirectory: CharacterDirectory
  characterRepository: CharacterRepository
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

const unconfiguredCharacters: CharacterRepository = {
  listByOwner: async () => [],
  save: async () => {
    throw new Error('Supabase não configurado (.env).')
  },
  remove: async () => {},
}

let container: Container | null = null

export function getContainer(): Container {
  if (!container) {
    const supabase = isSupabaseConfigured() ? getSupabase() : null
    container = {
      authRepository: supabase ? new SupabaseAuthRepository(supabase) : unconfiguredAuth,
      characterDirectory: new HttpCharacterDirectory(),
      characterRepository: supabase ? new SupabaseCharacterRepository(supabase) : unconfiguredCharacters,
    }
  }
  return container
}

export function overrideContainer(partial: Partial<Container>): void {
  container = { ...getContainer(), ...partial }
}
