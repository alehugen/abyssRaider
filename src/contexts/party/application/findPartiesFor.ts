import type { CombatRole } from '@/contexts/character/domain/Character'
import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import { acceptedMembers, canJoin, neededRolesFor, openRoles, type PartyDetails } from '../domain/Party'

export interface PartyMatch {
  details: PartyDetails
  /** Papéis do personagem que a party precisa (Chanter pode casar com dano e cura). Vazio = sem vaga para ele. */
  needed: CombatRole[]
  open: Record<CombatRole, number>
  acceptedCount: number
}

export interface PartySearch {
  /** Precisam do papel do personagem: mais papéis atendidos e mais perto de fechar primeiro. */
  needYou: PartyMatch[]
  /** Dá para pedir vaga, mas a composição já tem o papel dele (o líder ainda pode aceitar). */
  noRoleSlot: PartyMatch[]
  /** Parties da região em que a conta já é líder ou membro (não aparecem nas listas). */
  mine: PartyDetails[]
}

/**
 * Parties da mesma região para o personagem (santuário é entre facções), separadas em "precisam
 * de você", "sem vaga para o seu papel" e "suas" (já lidera ou participa).
 * Parties completas e as que ele não pode entrar (item level) ficam de fora.
 */
export function findPartiesFor(linked: LinkedCharacter, candidates: readonly PartyDetails[]): PartySearch {
  const mine: PartyDetails[] = []
  const joinable: PartyMatch[] = []

  for (const d of candidates) {
    const isMine =
      d.party.leaderId === linked.ownerId ||
      d.members.some((m) => m.linked.ownerId === linked.ownerId && m.status !== 'declined')
    if (isMine) {
      mine.push(d)
      continue
    }
    const acceptedCount = acceptedMembers(d.members).length
    if (!canJoin(d.party, linked).ok || acceptedCount >= d.party.sanctuary.groupSize) continue
    joinable.push({
      details: d,
      needed: neededRolesFor(d.party, d.members, linked.character.className),
      open: openRoles(d.party, d.members),
      acceptedCount,
    })
  }

  return {
    needYou: joinable
      .filter((m) => m.needed.length > 0)
      .sort((a, b) => b.needed.length - a.needed.length || b.acceptedCount - a.acceptedCount),
    noRoleSlot: joinable.filter((m) => m.needed.length === 0).sort((a, b) => b.acceptedCount - a.acceptedCount),
    mine,
  }
}
