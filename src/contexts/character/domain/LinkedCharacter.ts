import { DomainError } from '@/shared/domain/DomainError'
import type { Character } from './Character'

/** Personagem vinculado a uma conta do AbyssRaider (snapshot da API + metadados). */
export interface LinkedCharacter {
  /** id do registro no nosso banco (não é o characterId do jogo). */
  linkId: string
  ownerId: string
  character: Character
  syncedAt: Date
}

/** Um personagem pertence a uma única conta. */
export class CharacterAlreadyClaimedError extends DomainError {
  constructor() {
    super('character.already_claimed', 'Este personagem já está vinculado a outra conta.')
  }
}

export class CharacterNotFoundError extends DomainError {
  constructor() {
    super('character.not_found', 'Personagem não encontrado na API do Aion.')
  }
}

export const MAX_CHARACTERS_PER_ACCOUNT = 12
export class CharacterLimitReachedError extends DomainError {
  constructor() {
    super('character.limit', `Limite de ${MAX_CHARACTERS_PER_ACCOUNT} personagens por conta.`)
  }
}
