import type { CombatRole } from '@/contexts/character/domain/Character'
import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import { acceptedMembers, canJoin, neededRolesFor, openRoles, type PartyDetails } from '../domain/Party'

export interface PartyMatch {
  details: PartyDetails
  /** Papéis do personagem que a party precisa (Chanter pode casar com dano e cura). */
  needed: CombatRole[]
  open: Record<CombatRole, number>
  acceptedCount: number
}

/**
 * Parties em que o personagem pode entrar e que precisam do papel dele.
 * Ignora as que ele (ou outro personagem da mesma conta) já participa.
 * Ordena por mais papéis atendidos e, depois, pelas mais perto de fechar.
 */
export function findPartiesFor(linked: LinkedCharacter, candidates: readonly PartyDetails[]): PartyMatch[] {
  return candidates
    .filter((d) => d.party.leaderId !== linked.ownerId)
    .filter((d) => !d.members.some((m) => m.linked.ownerId === linked.ownerId && m.status !== 'declined'))
    .filter((d) => canJoin(d.party, linked).ok)
    .map((d) => ({
      details: d,
      needed: neededRolesFor(d.party, d.members, linked.character.className),
      open: openRoles(d.party, d.members),
      acceptedCount: acceptedMembers(d.members).length,
    }))
    .filter((m) => m.needed.length > 0)
    .sort((a, b) => b.needed.length - a.needed.length || b.acceptedCount - a.acceptedCount)
}
