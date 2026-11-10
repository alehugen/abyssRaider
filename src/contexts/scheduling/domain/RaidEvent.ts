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

export const MAX_WEEKS = 8

/** Datas de uma raid semanal: a primeira e as mesmas hora/dia da semana nas seguintes. */
export function weeklyOccurrences(first: Date, weeks: number): Date[] {
  const count = Math.min(Math.max(1, Math.trunc(weeks)), MAX_WEEKS)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(first)
    d.setDate(d.getDate() + 7 * i) // setDate respeita horário de verão do fuso local
    return d
  })
}

export function rsvpCounts(event: RaidEvent): Record<RsvpStatus, number> {
  const counts: Record<RsvpStatus, number> = { going: 0, maybe: 0, declined: 0 }
  for (const r of event.rsvps) counts[r.status]++
  return counts
}

export function myRsvp(event: RaidEvent, memberId: string): RsvpStatus | null {
  return event.rsvps.find((r) => r.memberId === memberId)?.status ?? null
}

/** Agrupa por dia no fuso de quem está vendo (chave AAAA-MM-DD local). */
export function groupByDay<T>(items: readonly T[], dateOf: (item: T) => Date): Array<{ day: Date; items: T[] }> {
  const groups = new Map<string, { day: Date; items: T[] }>()
  for (const item of [...items].sort((a, b) => dateOf(a).getTime() - dateOf(b).getTime())) {
    const d = dateOf(item)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!groups.has(key)) groups.set(key, { day: new Date(d.getFullYear(), d.getMonth(), d.getDate()), items: [] })
    groups.get(key)!.items.push(item)
  }
  return [...groups.values()]
}
