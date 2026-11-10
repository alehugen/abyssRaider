import { DomainError } from '@/shared/domain/DomainError'

export type ApplicationStatus = 'pending' | 'accepted' | 'declined'

/** Um personagem se candidatando a um santuário. Líderes de party vão recrutar daqui. */
export interface RaidApplication {
  id: string
  /** id do vínculo (LinkedCharacter.linkId), não o characterId do jogo. */
  characterLinkId: string
  sanctuaryId: string
  status: ApplicationStatus
  createdAt: Date
}

export class NotEligibleError extends DomainError {
  constructor(reason: string) {
    super('application.not_eligible', reason)
  }
}

export class AlreadyAppliedError extends DomainError {
  constructor() {
    super('application.duplicate', 'Este personagem já está aplicado neste santuário.')
  }
}
