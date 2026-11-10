import type { SupabaseClient } from '@supabase/supabase-js'
import type { Character, Faction, Region } from '../domain/Character'
import type { CharacterRepository } from '../domain/CharacterRepository'
import { CharacterAlreadyClaimedError, type LinkedCharacter } from '../domain/LinkedCharacter'

export interface CharacterRow {
  id: string
  owner_id: string
  aion_id: string
  region: Region
  server_id: number
  server_name: string
  name: string
  faction: Faction
  class_name: string
  level: number
  combat_power: number | null
  item_level: number | null
  portrait_url: string | null
  synced_at: string
}

export function rowToLinked(row: CharacterRow): LinkedCharacter {
  const character: Character = {
    id: row.aion_id,
    name: row.name,
    faction: row.faction,
    className: row.class_name,
    level: row.level,
    region: row.region,
    serverId: row.server_id,
    serverName: row.server_name,
    ...(row.combat_power != null ? { combatPower: row.combat_power } : {}),
    ...(row.item_level != null ? { itemLevel: row.item_level } : {}),
    ...(row.portrait_url ? { portraitUrl: row.portrait_url } : {}),
  }
  return { linkId: row.id, ownerId: row.owner_id, character, syncedAt: new Date(row.synced_at) }
}

export function characterToRow(ownerId: string, c: Character): Omit<CharacterRow, 'id' | 'synced_at'> {
  return {
    owner_id: ownerId,
    aion_id: c.id,
    region: c.region,
    server_id: c.serverId,
    server_name: c.serverName,
    name: c.name,
    faction: c.faction,
    class_name: c.className,
    level: c.level,
    combat_power: c.combatPower ?? null,
    item_level: c.itemLevel ?? null,
    portrait_url: c.portraitUrl ?? null,
  }
}

export const CHARACTER_COLUMNS =
  'id, owner_id, aion_id, region, server_id, server_name, name, faction, class_name, level, combat_power, item_level, portrait_url, synced_at'

export class SupabaseCharacterRepository implements CharacterRepository {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async listByOwner(ownerId: string): Promise<LinkedCharacter[]> {
    const { data, error } = await this.client
      .from('characters')
      .select(CHARACTER_COLUMNS)
      .eq('owner_id', ownerId)
      .order('combat_power', { ascending: false, nullsFirst: false })
    if (error) throw error
    return (data as CharacterRow[]).map(rowToLinked)
  }

  async save(ownerId: string, character: Character): Promise<LinkedCharacter> {
    const row = { ...characterToRow(ownerId, character), synced_at: new Date().toISOString() }
    // O upsert por (region, server_id, aion_id) só atualiza linhas do próprio dono (RLS);
    // se o personagem for de outra conta, a policy de update barra e cai no erro abaixo.
    const { data, error } = await this.client
      .from('characters')
      .upsert(row, { onConflict: 'region,server_id,aion_id' })
      .select(CHARACTER_COLUMNS)
      .single()
    if (error) {
      // 42501 = RLS; PGRST116 = upsert não devolveu linha (update barrado pela policy).
      if (error.code === '42501' || error.code === 'PGRST116' || error.code === '23505') {
        throw new CharacterAlreadyClaimedError()
      }
      throw error
    }
    return rowToLinked(data as CharacterRow)
  }

  async remove(linkId: string): Promise<void> {
    const { error } = await this.client.from('characters').delete().eq('id', linkId)
    if (error) throw error
  }
}
