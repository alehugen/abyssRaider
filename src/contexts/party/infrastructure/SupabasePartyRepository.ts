import type { SupabaseClient } from '@supabase/supabase-js'
import type { Faction, Region } from '@/contexts/character/domain/Character'
import {
  CHARACTER_COLUMNS,
  rowToLinked,
  type CharacterRow,
} from '@/contexts/character/infrastructure/SupabaseCharacterRepository'
import { DomainError } from '@/shared/domain/DomainError'
import type { Applicant, MemberStatus, Party, PartyDetails, PartyMember, PartySummary } from '../domain/Party'
import type { CreatePartyInput, PartyRepository } from '../domain/PartyRepository'

interface SanctuaryEmbed {
  id: string
  name: string
  min_item_level: number | null
  group_size: number
}

interface PartyRow {
  id: string
  name: string
  sanctuary_id: string
  leader_id: string
  leader_character_id: string
  region: Region
  faction: Faction
  created_at: string
  raid_days: number[] | null
  raid_time: string | null
  time_zone: string | null
  sanctuary: SanctuaryEmbed
}

interface ProfileEmbed {
  display_name: string
  avatar_url: string | null
}

interface MemberRow {
  id: string
  party_id: string
  status: MemberStatus
  created_at: string
  character: CharacterRow
  owner: ProfileEmbed | null
}

// Hints de FK explícitos: evitam ambiguidade no embed do PostgREST.
const PARTY_COLUMNS = `id, name, sanctuary_id, leader_id, leader_character_id, region, faction, created_at,
  raid_days, raid_time, time_zone,
  sanctuary:sanctuaries!parties_sanctuary_id_fkey(id, name, min_item_level, group_size)`

const MEMBER_COLUMNS = `id, party_id, status, created_at,
  character:characters!party_members_character_id_fkey(${CHARACTER_COLUMNS}),
  owner:profiles!party_members_owner_id_fkey(display_name, avatar_url)`

function toParty(r: PartyRow): Party {
  return {
    id: r.id,
    name: r.name,
    sanctuary: {
      id: r.sanctuary.id,
      name: r.sanctuary.name,
      minItemLevel: r.sanctuary.min_item_level,
      groupSize: r.sanctuary.group_size,
    },
    leaderId: r.leader_id,
    leaderCharacterLinkId: r.leader_character_id,
    region: r.region,
    faction: r.faction,
    createdAt: new Date(r.created_at),
    routine:
      r.raid_days?.length && r.raid_time
        ? { days: r.raid_days, time: r.raid_time.slice(0, 5), timeZone: r.time_zone ?? 'America/Sao_Paulo' }
        : null,
  }
}

function toMember(r: MemberRow): PartyMember {
  return {
    id: r.id,
    partyId: r.party_id,
    linked: rowToLinked(r.character),
    ownerName: r.owner?.display_name ?? 'Daeva',
    ownerAvatarUrl: r.owner?.avatar_url ?? null,
    status: r.status,
    createdAt: new Date(r.created_at),
  }
}

/** Erros levantados pelos triggers/funções (errcode P0001) já vêm em português. */
function rethrow(error: { code?: string; message: string }): never {
  if (error.code === 'P0001') throw new DomainError('party.rule', error.message)
  if (error.code === '23505') throw new DomainError('party.duplicate', 'Este personagem já pediu para entrar nesta party.')
  throw error
}

export class SupabasePartyRepository implements PartyRepository {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async listMine(userId: string): Promise<PartySummary[]> {
    const { data: mine, error } = await this.client
      .from('party_members')
      .select('party_id, status')
      .eq('owner_id', userId)
      .neq('status', 'declined')
    if (error) rethrow(error)
    const statusByParty = new Map((mine as Array<{ party_id: string; status: MemberStatus }>).map((m) => [m.party_id, m.status]))
    if (!statusByParty.size) return []

    const { data, error: partiesError } = await this.client
      .from('parties')
      .select(
        `${PARTY_COLUMNS},
        leader:characters!parties_leader_character_id_fkey(name),
        members:party_members!party_members_party_id_fkey(status)`,
      )
      .in('id', [...statusByParty.keys()])
      .order('created_at', { ascending: false })
    if (partiesError) rethrow(partiesError)

    type Row = PartyRow & { leader: { name: string } | null; members: Array<{ status: MemberStatus }> }
    return (data as unknown as Row[]).map((r) => ({
      party: toParty(r),
      leaderCharacterName: r.leader?.name ?? '?',
      acceptedCount: r.members.filter((m) => m.status === 'accepted').length,
      myStatus: r.leader_id === userId ? 'leader' : (statusByParty.get(r.id) ?? 'pending'),
    }))
  }

  async listOpen(filter: { region: Region; faction: Faction }): Promise<PartyDetails[]> {
    const { data, error } = await this.client
      .from('parties')
      .select(`${PARTY_COLUMNS}, members:party_members!party_members_party_id_fkey(${MEMBER_COLUMNS})`)
      .eq('region', filter.region)
      .eq('faction', filter.faction)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) rethrow(error)
    type Row = PartyRow & { members: MemberRow[] }
    return (data as unknown as Row[]).map((r) => ({ party: toParty(r), members: r.members.map(toMember) }))
  }

  async get(partyId: string): Promise<PartyDetails | null> {
    const [{ data: party, error }, { data: members, error: membersError }] = await Promise.all([
      this.client.from('parties').select(PARTY_COLUMNS).eq('id', partyId).maybeSingle(),
      this.client.from('party_members').select(MEMBER_COLUMNS).eq('party_id', partyId).order('created_at'),
    ])
    if (error) rethrow(error)
    if (membersError) rethrow(membersError)
    if (!party) return null
    return {
      party: toParty(party as unknown as PartyRow),
      members: (members as unknown as MemberRow[]).map(toMember),
    }
  }

  async create(input: CreatePartyInput): Promise<string> {
    const { data, error } = await this.client.rpc('create_party', {
      p_name: input.name,
      p_sanctuary_id: input.sanctuaryId,
      p_character_id: input.characterLinkId,
      p_raid_days: input.routine.days,
      p_raid_time: input.routine.time,
      p_time_zone: input.routine.timeZone,
    })
    if (error) rethrow(error)
    return data as string
  }

  async remove(partyId: string): Promise<void> {
    const { error } = await this.client.from('parties').delete().eq('id', partyId)
    if (error) rethrow(error)
  }

  async requestJoin(partyId: string, characterLinkId: string, ownerId: string): Promise<void> {
    const { error } = await this.client
      .from('party_members')
      .insert({ party_id: partyId, character_id: characterLinkId, owner_id: ownerId, status: 'pending' })
    if (error) rethrow(error)
  }

  async decide(memberId: string, status: 'accepted' | 'declined'): Promise<void> {
    const { error } = await this.client.from('party_members').update({ status }).eq('id', memberId)
    if (error) rethrow(error)
  }

  async removeMember(memberId: string): Promise<void> {
    const { error } = await this.client.from('party_members').delete().eq('id', memberId)
    if (error) rethrow(error)
  }

  async listApplicants(sanctuaryId: string): Promise<Applicant[]> {
    const { data, error } = await this.client
      .from('raid_applications')
      .select(
        `id, created_at,
        character:characters!raid_applications_character_id_fkey(${CHARACTER_COLUMNS}),
        owner:profiles!raid_applications_owner_id_fkey(display_name)`,
      )
      .eq('sanctuary_id', sanctuaryId)
      .eq('status', 'pending')
      .order('created_at')
    if (error) rethrow(error)
    type Row = { id: string; created_at: string; character: CharacterRow; owner: { display_name: string } | null }
    return (data as unknown as Row[]).map((r) => ({
      applicationId: r.id,
      linked: rowToLinked(r.character),
      ownerName: r.owner?.display_name ?? 'Daeva',
      appliedAt: new Date(r.created_at),
    }))
  }

  async recruit(partyId: string, applicationId: string): Promise<void> {
    const { error } = await this.client.rpc('recruit_application', {
      p_party_id: partyId,
      p_application_id: applicationId,
    })
    if (error) rethrow(error)
  }
}
