import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import { AlreadyAppliedError, NotEligibleError, type RaidApplication } from '../domain/RaidApplication'
import type { RaidApplicationRepository } from '../domain/RaidApplicationRepository'
import { eligibility, type Sanctuary } from '../domain/Sanctuary'

/** Valida as regras (item level, duplicidade) e registra a aplicação. */
export async function applyToSanctuary(
  repository: RaidApplicationRepository,
  linked: LinkedCharacter,
  sanctuary: Sanctuary,
  existing: readonly RaidApplication[],
): Promise<RaidApplication> {
  const check = eligibility(linked.character, sanctuary)
  if (!check.ok) throw new NotEligibleError(check.reason)
  if (existing.some((a) => a.characterLinkId === linked.linkId && a.sanctuaryId === sanctuary.id)) {
    throw new AlreadyAppliedError()
  }
  return repository.create(linked.linkId, sanctuary.id)
}
