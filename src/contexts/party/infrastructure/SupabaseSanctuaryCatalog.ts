import type { SupabaseClient } from '@supabase/supabase-js'
import type { Sanctuary } from '../domain/Sanctuary'
import type { SanctuaryCatalog } from '../domain/SanctuaryCatalog'

interface SanctuaryRow {
  id: string
  name: string
  min_item_level: number | null
  group_size: number
  image_url: string | null
}

const toSanctuary = (r: SanctuaryRow): Sanctuary => ({
  id: r.id,
  name: r.name,
  minItemLevel: r.min_item_level,
  groupSize: r.group_size,
  imageUrl: r.image_url,
})

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
