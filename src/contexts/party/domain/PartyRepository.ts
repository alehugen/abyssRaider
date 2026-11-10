import type { Faction, Region } from '@/contexts/character/domain/Character'
import type { Applicant, PartyDetails, PartySummary } from './Party'
import type { RaidRoutine } from './RaidRoutine'

export interface CreatePartyInput {
  name: string
  sanctuaryId: string
  /** Personagem do líder (LinkedCharacter.linkId). */
  characterLinkId: string
  routine: RaidRoutine
}

export interface PartyRepository {
  listMine(userId: string): Promise<PartySummary[]>
  /** Parties da mesma região e facção, com membros, para a busca por vaga. */
  listOpen(filter: { region: Region; faction: Faction }): Promise<PartyDetails[]>
  get(partyId: string): Promise<PartyDetails | null>
  /** Cria a party com o personagem do líder já dentro. Devolve o id. */
  create(input: CreatePartyInput): Promise<string>
  remove(partyId: string): Promise<void>

  requestJoin(partyId: string, characterLinkId: string, ownerId: string): Promise<void>
  decide(memberId: string, status: 'accepted' | 'declined'): Promise<void>
  /** Sair, cancelar pedido ou (líder) remover alguém. */
  removeMember(memberId: string): Promise<void>

  /** Quem aplicou no santuário e ainda está aguardando. */
  listApplicants(sanctuaryId: string): Promise<Applicant[]>
  recruit(partyId: string, applicationId: string): Promise<void>
}
