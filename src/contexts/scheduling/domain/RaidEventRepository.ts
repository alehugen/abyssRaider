import type { AgendaEntry, RaidEvent, RsvpStatus } from './RaidEvent'

export interface RaidEventRepository {
  /** Próximas raids da party (inclui as das últimas 6 horas, que podem estar acontecendo). */
  listForParty(partyId: string): Promise<RaidEvent[]>
  /** Próximas raids de todas as parties em que o usuário é membro aceito. */
  listAgenda(userId: string): Promise<AgendaEntry[]>
  schedule(partyId: string, startsAt: readonly Date[], note: string | null): Promise<void>
  cancel(eventId: string): Promise<void>
  respond(eventId: string, memberId: string, status: RsvpStatus): Promise<void>
}
