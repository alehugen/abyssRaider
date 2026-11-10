import type { SupabaseClient } from '@supabase/supabase-js'
import { AlreadyAppliedError, NotEligibleError, type ApplicationStatus, type RaidApplication } from '../domain/RaidApplication'
import type { RaidApplicationRepository, SanctuaryCatalog } from '../domain/RaidApplicationRepository'
import type { Sanctuary } from '../domain/Sanctuary'

interface SanctuaryRow {
  id: string
  name: string
  min_item_level: number | null
  group_size: number
  image_url: string | null
}

interface ApplicationRow {
  id: string
  character_id: string
  sanctuary_id: string
  status: ApplicationStatus
  created_at: string
}

const toSanctuary = (r: SanctuaryRow): Sanctuary => ({
  id: r.id,
  name: r.name,
  minItemLevel: r.min_item_level,
  groupSize: r.group_size,
  imageUrl: r.image_url,
})

const toApplication = (r: ApplicationRow): RaidApplication => ({
  id: r.id,
  characterLinkId: r.character_id,
  sanctuaryId: r.sanctuary_id,
  status: r.status,
  createdAt: new Date(r.created_at),
})

const APP_COLUMNS = 'id, character_id, sanctuary_id, status, created_at'

export class SupabaseSanctuaryCatalog implements SanctuaryCatalog {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async listActive(): Promise<Sanctuary[]> {
    const { data, error } = await this.client
      .from('sanctuaries')
      .select('id, name, min_item_level, group_size, image_url')
      .eq('active', true)
      .order('sort_order')
    if (error) throw error
    return (data as SanctuaryRow[]).map(toSanctuary)
  }
}

export class SupabaseRaidApplicationRepository implements RaidApplicationRepository {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async listByOwner(ownerId: string): Promise<RaidApplication[]> {
    const { data, error } = await this.client
      .from('raid_applications')
      .select(APP_COLUMNS)
      .eq('owner_id', ownerId)
      .order('created_at')
    if (error) throw error
    return (data as ApplicationRow[]).map(toApplication)
  }

  async create(characterLinkId: string, sanctuaryId: string): Promise<RaidApplication> {
    const { data, error } = await this.client
      .from('raid_applications')
      .insert({ character_id: characterLinkId, sanctuary_id: sanctuaryId })
      .select(APP_COLUMNS)
      .single()
    if (error) {
      if (error.code === '23505') throw new AlreadyAppliedError()
      // Mensagem do trigger de elegibilidade no banco (item level / santuário fechado).
      if (error.code === 'P0001') throw new NotEligibleError(error.message)
      throw error
    }
    return toApplication(data as ApplicationRow)
  }

  async withdraw(applicationId: string): Promise<void> {
    const { error } = await this.client.from('raid_applications').delete().eq('id', applicationId)
    if (error) throw error
  }
}
