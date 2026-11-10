import { rolesOf, type CombatRole, type Faction, type Region } from '@/contexts/character/domain/Character'
import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import type { RaidRoutine } from './RaidRoutine'
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
  /** Dias e horário em que a party costuma raidar (null em parties antigas). */
  routine?: RaidRoutine | null
}

export interface PartyMember {
  id: string
  partyId: string
  linked: LinkedCharacter
  ownerName: string
  ownerAvatarUrl: string | null
  status: MemberStatus
  createdAt: Date
  /** Vaga fixa na formação (0..4 grupo 1, 5..9 grupo 2); null = encaixe automático. */
  slot?: number | null
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

/** Grupos dentro da raid (Ludra: 10 = 2 grupos de 5). */
export const GROUP_SIZE = 5
export const ROLE_ORDER: readonly CombatRole[] = ['tank', 'healer', 'dps']

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

/** Meta por grupo de 5: 1 tanque, 1 cura, 3 dano. */
export function targetComposition(groupSize: number): Record<CombatRole, number> {
  const groupCount = Math.max(1, Math.ceil(groupSize / GROUP_SIZE))
  return { tank: groupCount, healer: groupCount, dps: Math.max(0, groupSize - 2 * groupCount) }
}

/** Membro mínimo para as contas de papel: só a classe importa. */
type WithClass = { id: string; linked: { character: { className: string } } }

/**
 * Decide o papel de cada aceito. Classes de um papel só entram direto;
 * híbridas (Chanter) vão para o papel que mais falta.
 */
export function assignRoles<T extends WithClass>(members: readonly T[], groupSize: number): Map<string, CombatRole | null> {
  const target = targetComposition(groupSize)
  const count: Record<CombatRole, number> = { tank: 0, healer: 0, dps: 0 }
  const result = new Map<string, CombatRole | null>()
  const flex: Array<{ id: string; roles: readonly CombatRole[] }> = []

  for (const m of members) {
    const roles = rolesOf(m.linked.character.className)
    if (roles.length === 1) {
      result.set(m.id, roles[0]!)
      count[roles[0]!]++
    } else if (roles.length === 0) {
      result.set(m.id, null)
    } else {
      flex.push({ id: m.id, roles })
    }
  }
  // Vai para o papel menos preenchido em proporção à meta; empate favorece tanque/cura (mais raros).
  const fill = (r: CombatRole) => (target[r] ? count[r] / target[r] : Infinity)
  for (const f of flex) {
    const best = [...f.roles].sort((a, b) => fill(a) - fill(b) || ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b))[0]!
    result.set(f.id, best)
    count[best]++
  }
  return result
}

export function composition(members: readonly PartyMember[], groupSize: number): Composition {
  const result: Composition = { tank: 0, healer: 0, dps: 0, unknown: 0 }
  for (const role of assignRoles(acceptedMembers(members), groupSize).values()) result[role ?? 'unknown']++
  return result
}

/** Vagas abertas por papel (meta menos o que já tem), sem passar do total livre. */
export function openRoles(party: Party, members: readonly PartyMember[]): Record<CombatRole, number> {
  const target = targetComposition(party.sanctuary.groupSize)
  const comp = composition(members, party.sanctuary.groupSize)
  const free = party.sanctuary.groupSize - acceptedMembers(members).length
  const open = (r: CombatRole) => Math.min(free, Math.max(0, target[r] - comp[r]))
  return { tank: open('tank'), healer: open('healer'), dps: open('dps') }
}

/** Papéis do personagem que a party ainda precisa. */
export function neededRolesFor(party: Party, members: readonly PartyMember[], className: string): CombatRole[] {
  const open = openRoles(party, members)
  return rolesOf(className).filter((r) => open[r] > 0)
}

/**
 * Distribui os aceitos em grupos de 5, com vagas vazias como null.
 * Líder primeiro, depois por papel (tanque, cura, dano) e CP.
 */
export function groups(party: Party, members: readonly PartyMember[]): Array<Array<PartyMember | null>> {
  const accepted = acceptedMembers(members)
  const roles = assignRoles(accepted, party.sanctuary.groupSize)
  const rank = (m: PartyMember) => {
    const role = roles.get(m.id)
    return role ? ROLE_ORDER.indexOf(role) : ROLE_ORDER.length
  }
  const sorted = accepted.sort((a, b) => {
    const leader = Number(b.linked.linkId === party.leaderCharacterLinkId) - Number(a.linked.linkId === party.leaderCharacterLinkId)
    return leader || rank(a) - rank(b) || (b.linked.character.combatPower ?? 0) - (a.linked.character.combatPower ?? 0)
  })
  const count = Math.max(1, Math.ceil(party.sanctuary.groupSize / GROUP_SIZE))
  const total = count * GROUP_SIZE

  // Quem tem vaga fixa (válida e livre) fica nela; o resto ocupa as livres na ordem automática.
  const flat: Array<PartyMember | null> = Array.from({ length: total }, () => null)
  const loose: PartyMember[] = []
  for (const m of sorted) {
    const slot = m.slot
    if (slot != null && slot >= 0 && slot < total && !flat[slot]) flat[slot] = m
    else loose.push(m)
  }
  for (let i = 0; i < total && loose.length; i++) if (!flat[i]) flat[i] = loose.shift()!

  return Array.from({ length: count }, (_, g) => flat.slice(g * GROUP_SIZE, (g + 1) * GROUP_SIZE))
}

/**
 * Formação completa depois de arrastar a vaga `from` para `to` (troca se `to`
 * estiver ocupada). Devolve todas as posições, para gravar de uma vez.
 */
export function moveInLayout(
  grid: ReadonlyArray<ReadonlyArray<PartyMember | null>>,
  from: number,
  to: number,
): Array<{ memberId: string; slot: number }> {
  const flat = grid.flat()
  if (from !== to && flat[from] && to >= 0 && to < flat.length) {
    ;[flat[from], flat[to]] = [flat[to] ?? null, flat[from]!]
  }
  return flat.flatMap((m, slot) => (m ? [{ memberId: m.id, slot }] : []))
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
