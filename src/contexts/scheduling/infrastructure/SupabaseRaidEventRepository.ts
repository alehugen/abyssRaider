import type { SupabaseClient } from '@supabase/supabase-js'
import { DomainError } from '@/shared/domain/DomainError'
import type { AgendaEntry, RaidEvent, RsvpStatus } from '../domain/RaidEvent'
import type { RaidEventRepository } from '../domain/RaidEventRepository'

interface EventRow {
  id: string
  party_id: string
  starts_at: string
  note: string | null
  recurring: boolean | null
  rsvps: Array<{ event_id: string; member_id: string; owner_id: string; status: RsvpStatus }>
}

const EVENT_COLUMNS = `id, party_id, starts_at, note, recurring,
  rsvps:raid_rsvps!raid_rsvps_event_id_fkey(event_id, member_id, owner_id, status)`

/** Raids que começaram há até 6 h ainda aparecem (podem estar em andamento). */
const sinceIso = () => new Date(Date.now() - 6 * 3600_000).toISOString()

function toEvent(r: EventRow): RaidEvent {
  return {
    id: r.id,
    partyId: r.party_id,
    startsAt: new Date(r.starts_at),
    note: r.note,
    recurring: !!r.recurring,
    rsvps: r.rsvps.map((x) => ({ eventId: x.event_id, memberId: x.member_id, ownerId: x.owner_id, status: x.status })),
  }
}

function rethrow(error: { code?: string; message: string }): never {
  if (error.code === 'P0001') throw new DomainError('schedule.rule', error.message)
  throw error
}

export class SupabaseRaidEventRepository implements RaidEventRepository {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async listForParty(partyId: string): Promise<RaidEvent[]> {
    const { data, error } = await this.client
      .from('raid_events')
      .select(EVENT_COLUMNS)
      .eq('party_id', partyId)
      .gte('starts_at', sinceIso())
      .order('starts_at')
      .limit(50)
    if (error) rethrow(error)
    return (data as unknown as EventRow[]).map(toEvent)
  }

  async listAgenda(userId: string): Promise<AgendaEntry[]> {
    const { data: memberships, error } = await this.client
      .from('party_members')
      .select(
        `id, party_id,
        character:characters!party_members_character_id_fkey(name),
        party:parties!party_members_party_id_fkey(name, faction, sanctuary:sanctuaries!parties_sanctuary_id_fkey(name))`,
      )
      .eq('owner_id', userId)
      .eq('status', 'accepted')
    if (error) rethrow(error)

    type Membership = {
      id: string
      party_id: string
      character: { name: string } | null
      party: { name: string; faction: 'elyos' | 'asmodian'; sanctuary: { name: string } | null } | null
    }
    const byParty = new Map((memberships as unknown as Membership[]).map((m) => [m.party_id, m]))
    if (!byParty.size) return []

    const { data: events, error: eventsError } = await this.client
      .from('raid_events')
      .select(EVENT_COLUMNS)
      .in('party_id', [...byParty.keys()])
      .gte('starts_at', sinceIso())
      .order('starts_at')
      .limit(100)
    if (eventsError) rethrow(eventsError)

    return (events as unknown as EventRow[]).map((row) => {
      const m = byParty.get(row.party_id)!
      return {
        event: toEvent(row),
        partyName: m.party?.name ?? 'Party',
        sanctuaryName: m.party?.sanctuary?.name ?? '',
        faction: m.party?.faction ?? 'elyos',
        myMemberId: m.id,
        myCharacterName: m.character?.name ?? '',
      }
    })
  }

  async schedule(partyId: string, startsAt: readonly Date[], note: string | null): Promise<void> {
    const rows = startsAt.map((d) => ({ party_id: partyId, starts_at: d.toISOString(), note }))
    const { error } = await this.client.from('raid_events').insert(rows)
    if (error) rethrow(error)
  }

  async cancel(eventId: string): Promise<void> {
    const { data, error } = await this.client.from('raid_events').delete().eq('id', eventId).select('id')
    if (error) rethrow(error)
    // A RLS não dá erro quando bloqueia: só não apaga.
    if (!data?.length) throw new DomainError('schedule.nothing_changed', 'Não foi possível cancelar: recarregue a página.')
  }

  async respond(eventId: string, memberId: string, status: RsvpStatus): Promise<void> {
    const { error } = await this.client
      .from('raid_rsvps')
      .upsert({ event_id: eventId, member_id: memberId, status }, { onConflict: 'event_id,member_id' })
    if (error) rethrow(error)
  }
}
