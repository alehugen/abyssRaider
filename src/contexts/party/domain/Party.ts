import { roleOf, type CombatRole, type Faction, type Region } from '@/contexts/character/domain/Character'
import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import { eligibility, type Eligibility, type Sanctuary } from './Sanctuary'

export type MemberStatus = 'pending' | 'accepted' | 'declined'

export interface Party {
  id: string
  name: string
  sanctuary: Sanctuary
  leaderId: string
  leaderCharacterLinkId: string
  region: Region
  faction: Faction
  createdAt: Date
}

export interface PartyMember {
  id: string
  partyId: string
  linked: LinkedCharacter
  ownerName: string
  ownerAvatarUrl: string | null
  status: MemberStatus
  createdAt: Date
}

export interface PartyDetails {
  party: Party
  members: PartyMember[]
}

/** Item da lista "Minhas parties". */
export interface PartySummary {
  party: Party
  leaderCharacterName: string
  acceptedCount: number
  /** Como o usuário logado participa. */
  myStatus: MemberStatus | 'leader'
}

/** Alguém que aplicou no santuário e pode ser recrutado. */
export interface Applicant {
  applicationId: string
  linked: LinkedCharacter
  ownerName: string
  appliedAt: Date
}

/** Grupos dentro da raid (Ludra: 10 = 2 grupos de 5). */
export const GROUP_SIZE = 5
export const ROLE_ORDER: readonly CombatRole[] = ['tank', 'healer', 'support', 'dps']

export function acceptedMembers(members: readonly PartyMember[]): PartyMember[] {
  return members.filter((m) => m.status === 'accepted')
}

export function pendingMembers(members: readonly PartyMember[]): PartyMember[] {
  return members.filter((m) => m.status === 'pending')
}

export function isFull(party: Party, members: readonly PartyMember[]): boolean {
  return acceptedMembers(members).length >= party.sanctuary.groupSize
}

export type Composition = Record<CombatRole, number> & { unknown: number }

export function composition(members: readonly PartyMember[]): Composition {
  const result: Composition = { tank: 0, healer: 0, support: 0, dps: 0, unknown: 0 }
  for (const m of acceptedMembers(members)) {
    const role = roleOf(m.linked.character.className)
    result[role ?? 'unknown']++
  }
  return result
}

function roleRank(m: PartyMember): number {
  const role = roleOf(m.linked.character.className)
  return role ? ROLE_ORDER.indexOf(role) : ROLE_ORDER.length
}

/**
 * Distribui os aceitos em grupos de 5, com vagas vazias como null.
 * Líder primeiro, depois por papel (tanque, cura, suporte, dano) e CP.
 */
export function groups(party: Party, members: readonly PartyMember[]): Array<Array<PartyMember | null>> {
  const sorted = acceptedMembers(members).sort((a, b) => {
    const leader = Number(b.linked.linkId === party.leaderCharacterLinkId) - Number(a.linked.linkId === party.leaderCharacterLinkId)
    return (
      leader ||
      roleRank(a) - roleRank(b) ||
      (b.linked.character.combatPower ?? 0) - (a.linked.character.combatPower ?? 0)
    )
  })
  const count = Math.max(1, Math.ceil(party.sanctuary.groupSize / GROUP_SIZE))
  return Array.from({ length: count }, (_, g) =>
    Array.from({ length: GROUP_SIZE }, (_, i) => sorted[g * GROUP_SIZE + i] ?? null),
  )
}

/** Se o personagem pode pedir para entrar (mesmas regras que o banco aplica). */
export function canJoin(party: Party, linked: LinkedCharacter): Eligibility {
  const c = linked.character
  if (c.region !== party.region) return { ok: false, reason: 'Região diferente da party.' }
  if (c.faction !== party.faction) {
    return { ok: false, reason: `A party é ${party.faction === 'elyos' ? 'Elyos' : 'Asmodian'}.` }
  }
  return eligibility(c, party.sanctuary)
}
