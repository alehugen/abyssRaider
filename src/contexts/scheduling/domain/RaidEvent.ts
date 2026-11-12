import { brasiliaDayKey } from '@/shared/lib/brasilia'

export type RsvpStatus = 'going' | 'maybe' | 'declined'

export const RSVP_LABEL: Record<RsvpStatus, string> = {
  going: 'Vou',
  maybe: 'Talvez',
  declined: 'Não vou',
}

export interface Rsvp {
  eventId: string
  /** party_members.id de quem respondeu */
  memberId: string
  ownerId: string
  status: RsvpStatus
}

export interface RaidEvent {
  id: string
  partyId: string
  startsAt: Date
  note: string | null
  /** Criada sozinha pela recorrência da party. */
  recurring?: boolean
  rsvps: Rsvp[]
}

/** Evento na agenda do usuário, com o contexto da party. */
export interface AgendaEntry {
  event: RaidEvent
  partyName: string
  sanctuaryName: string
  faction: 'elyos' | 'asmodian'
  /** Participação do usuário logado nessa party (para responder). */
  myMemberId: string
  myCharacterName: string
}

export function rsvpCounts(event: RaidEvent): Record<RsvpStatus, number> {
  const counts: Record<RsvpStatus, number> = { going: 0, maybe: 0, declined: 0 }
  for (const r of event.rsvps) counts[r.status]++
  return counts
}

export function myRsvp(event: RaidEvent, memberId: string): RsvpStatus | null {
  return event.rsvps.find((r) => r.memberId === memberId)?.status ?? null
}

/** Agrupa por dia no horário de Brasília; `day` é o primeiro instante do grupo. */
export function groupByDay<T>(
  items: readonly T[],
  dateOf: (item: T) => Date,
): Array<{ key: string; day: Date; items: T[] }> {
  const groups = new Map<string, { key: string; day: Date; items: T[] }>()
  for (const item of [...items].sort((a, b) => dateOf(a).getTime() - dateOf(b).getTime())) {
    const key = brasiliaDayKey(dateOf(item))
    if (!groups.has(key)) groups.set(key, { key, day: dateOf(item), items: [] })
    groups.get(key)!.items.push(item)
  }
  return [...groups.values()]
}
