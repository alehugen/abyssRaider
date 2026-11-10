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
import type { PartyRepository } from '@/contexts/party/domain/PartyRepository'
import type { SanctuaryCatalog } from '@/contexts/party/domain/SanctuaryCatalog'
import { SupabasePartyRepository } from '@/contexts/party/infrastructure/SupabasePartyRepository'
import { SupabaseSanctuaryCatalog } from '@/contexts/party/infrastructure/SupabaseSanctuaryCatalog'
import type { AvailabilityRepository } from '@/contexts/scheduling/domain/AvailabilityRepository'
import type { RaidEventRepository } from '@/contexts/scheduling/domain/RaidEventRepository'
import { SupabaseAvailabilityRepository } from '@/contexts/scheduling/infrastructure/SupabaseAvailabilityRepository'
import { SupabaseRaidEventRepository } from '@/contexts/scheduling/infrastructure/SupabaseRaidEventRepository'
import { getSupabase, isSupabaseConfigured } from '@/shared/infrastructure/supabase/client'

export interface Container {
  authRepository: AuthRepository
  characterDirectory: CharacterDirectory
  characterRepository: CharacterRepository
  sanctuaryCatalog: SanctuaryCatalog
  partyRepository: PartyRepository
  raidEventRepository: RaidEventRepository
  availabilityRepository: AvailabilityRepository
}

const notConfigured = async (): Promise<never> => {
  throw new Error('Supabase não configurado (.env).')
}

/** Usado quando não há .env: o app abre, mas o login avisa que falta configuração. */
const unconfiguredAuth: AuthRepository = {
  getCurrentUser: async () => null,
  signInWithDiscord: notConfigured,
  signOut: async () => {},
  onChange: () => () => {},
}

const unconfiguredCharacters: CharacterRepository = {
  listByOwner: async () => [],
  save: notConfigured,
  remove: async () => {},
  findOwners: async () => [],
}

const unconfiguredParties: PartyRepository = {
  listMine: async () => [],
  listOpen: async () => [],
  get: async () => null,
  create: notConfigured,
  remove: notConfigured,
  requestJoin: notConfigured,
  decide: notConfigured,
  removeMember: notConfigured,
}

const unconfiguredEvents: RaidEventRepository = {
  listForParty: async () => [],
  listAgenda: async () => [],
  schedule: notConfigured,
  cancel: notConfigured,
  respond: notConfigured,
}

const unconfiguredAvailability: AvailabilityRepository = {
  listByOwner: async () => [],
  listByOwners: async () => new Map(),
  save: notConfigured,
  demand: async () => [],
}

let container: Container | null = null

export function getContainer(): Container {
  if (!container) {
    const supabase = isSupabaseConfigured() ? getSupabase() : null
    container = {
      authRepository: supabase ? new SupabaseAuthRepository(supabase) : unconfiguredAuth,
      characterDirectory: new HttpCharacterDirectory(),
      characterRepository: supabase ? new SupabaseCharacterRepository(supabase) : unconfiguredCharacters,
      sanctuaryCatalog: supabase ? new SupabaseSanctuaryCatalog(supabase) : { listActive: async () => [] },
      partyRepository: supabase ? new SupabasePartyRepository(supabase) : unconfiguredParties,
      raidEventRepository: supabase ? new SupabaseRaidEventRepository(supabase) : unconfiguredEvents,
      availabilityRepository: supabase ? new SupabaseAvailabilityRepository(supabase) : unconfiguredAvailability,
    }
  }
  return container
}

export function overrideContainer(partial: Partial<Container>): void {
  container = { ...getContainer(), ...partial }
}
