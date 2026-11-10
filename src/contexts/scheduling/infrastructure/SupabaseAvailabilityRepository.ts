import type { SupabaseClient } from '@supabase/supabase-js'
import type { Faction, Region } from '@/contexts/character/domain/Character'
import { DomainError } from '@/shared/domain/DomainError'
import type { TimeWindow } from '../domain/Availability'
import type { AvailabilityRepository } from '../domain/AvailabilityRepository'

interface WindowRow {
  owner_id?: string
  weekday: number
  start_minute: number
  end_minute: number
}

const toWindow = (r: WindowRow): TimeWindow => ({ weekday: r.weekday, start: r.start_minute, end: r.end_minute })

function rethrow(error: { code?: string; message: string }): never {
  if (error.code === 'P0001') throw new DomainError('availability.rule', error.message)
  throw error
}

export class SupabaseAvailabilityRepository implements AvailabilityRepository {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async listByOwner(ownerId: string): Promise<TimeWindow[]> {
    return (await this.listByOwners([ownerId])).get(ownerId) ?? []
  }

  async listByOwners(ownerIds: readonly string[]): Promise<Map<string, TimeWindow[]>> {
    const result = new Map<string, TimeWindow[]>()
    if (!ownerIds.length) return result
    const { data, error } = await this.client
      .from('availability')
      .select('owner_id, weekday, start_minute, end_minute')
      .in('owner_id', [...new Set(ownerIds)])
      .order('weekday')
      .order('start_minute')
    if (error) rethrow(error)
    for (const row of data as WindowRow[]) {
      const list = result.get(row.owner_id!) ?? []
      list.push(toWindow(row))
      result.set(row.owner_id!, list)
    }
    return result
  }

  async save(windows: readonly TimeWindow[]): Promise<void> {
    const { error } = await this.client.rpc('set_availability', {
      p_windows: windows.map((w) => ({ weekday: w.weekday, start: w.start, end: w.end })),
    })
    if (error) rethrow(error)
  }

  async demand(region: Region, faction: Faction): Promise<TimeWindow[]> {
    const { data, error } = await this.client.rpc('availability_demand', { p_region: region, p_faction: faction })
    if (error) rethrow(error)
    return (data as WindowRow[]).map(toWindow)
  }
}
