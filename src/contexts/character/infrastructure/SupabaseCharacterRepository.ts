import type { SupabaseClient } from '@supabase/supabase-js'
import { classNamesFor, type Character, type Faction, type Region } from '../domain/Character'
import type { CharacterRef } from '../domain/CharacterDirectory'
import type { CharacterRepository, PlayerListing, PlayerSearchFilter } from '../domain/CharacterRepository'
import { DomainError } from '@/shared/domain/DomainError'
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

  async findOwners(refs: readonly CharacterRef[]): Promise<Array<CharacterRef & { ownerId: string }>> {
    if (!refs.length) return []
    // A busca é sempre de uma região; filtramos por região + ids e conferimos o servidor aqui.
    const regions = [...new Set(refs.map((r) => r.region))]
    const { data, error } = await this.client
      .from('characters')
      .select('region, server_id, aion_id, owner_id')
      .in('region', regions)
      .in('aion_id', [...new Set(refs.map((r) => r.id))])
    if (error) throw error
    type Row = { region: Region; server_id: number; aion_id: string; owner_id: string }
    const wanted = new Set(refs.map((r) => `${r.region}:${r.serverId}:${r.id}`))
    return (data as Row[])
      .filter((r) => wanted.has(`${r.region}:${r.server_id}:${r.aion_id}`))
      .map((r) => ({ region: r.region, serverId: r.server_id, id: r.aion_id, ownerId: r.owner_id }))
  }

  async searchPlayers(f: PlayerSearchFilter): Promise<PlayerListing[]> {
    let q = this.client
      .from('characters')
      .select(`${CHARACTER_COLUMNS}, owner:profiles!characters_owner_id_fkey(display_name, avatar_url)`)
      .eq('region', f.region)
    if (f.faction) q = q.eq('faction', f.faction)
    if (f.roles?.length) q = q.in('class_name', classNamesFor(f.roles))
    if (f.minItemLevel) q = q.gte('item_level', f.minItemLevel)
    // Tira os curingas do ilike (% e _) e vírgulas/parênteses, que quebram o filtro do PostgREST.
    const name = f.name?.replace(/[%_,()*\\]/g, '').trim()
    if (name) q = q.ilike('name', `%${name}%`)
    if (f.excludeOwnerId) q = q.neq('owner_id', f.excludeOwnerId)

    const { data, error } = await q
      .order('item_level', { ascending: false, nullsFirst: false })
      .order('combat_power', { ascending: false, nullsFirst: false })
      .limit(f.limit ?? 60)
    if (error) throw error
    type Row = CharacterRow & { owner: { display_name: string; avatar_url: string | null } | null }
    return (data as unknown as Row[]).map((r) => ({
      linked: rowToLinked(r),
      ownerName: r.owner?.display_name ?? 'Daeva',
      ownerAvatarUrl: r.owner?.avatar_url ?? null,
    }))
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
      // Trigger characters_keep_identity: o upsert tentou "trocar o dono" de um personagem alheio.
      if (error.code === 'P0001' && error.message.startsWith('A identidade')) throw new CharacterAlreadyClaimedError()
      if (error.code === 'P0001') throw new DomainError('character.rule', error.message)
      throw error
    }
    return rowToLinked(data as CharacterRow)
  }

  async remove(linkId: string): Promise<void> {
    const { error } = await this.client.from('characters').delete().eq('id', linkId)
    if (error) throw error
  }
}
