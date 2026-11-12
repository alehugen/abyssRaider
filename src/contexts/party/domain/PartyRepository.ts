import type { Region } from '@/contexts/character/domain/Character'
import type { Membership } from '../application/inviteOptions'
import type { PartyDetails, PartySummary } from './Party'
import type { RaidRoutine, RoutineSlot } from './RaidRoutine'

export interface CreatePartyInput {
  name: string
  sanctuaryId: string
  /** Personagem do líder (LinkedCharacter.linkId). */
  characterLinkId: string
  /** Recorrência (opcional): sem ela, cada raid é marcada na semana pela disponibilidade. */
  routine?: RaidRoutine | null
}

export interface PartyRepository {
  listMine(userId: string): Promise<PartySummary[]>
  /** Parties ativas da região (as duas facções), com membros, para a busca por vaga. */
  listOpen(filter: { region: Region }): Promise<PartyDetails[]>
  get(partyId: string): Promise<PartyDetails | null>
  /** Cria a party com o personagem do líder já dentro. Devolve o id. */
  create(input: CreatePartyInput): Promise<string>
  remove(partyId: string): Promise<void>
  /** Líder: finaliza agora (vira histórico; raids futuras são canceladas). */
  finish(partyId: string): Promise<void>
  /** Líder: grava a vaga de cada membro aceito. */
  setLayout(partyId: string, layout: ReadonlyArray<{ memberId: string; slot: number }>): Promise<void>
  /** Líder: liga, muda ou (lista vazia) desliga a recorrência. Devolve quantas raids foram criadas agora. */
  setRecurrence(partyId: string, slots: readonly RoutineSlot[]): Promise<number>

  requestJoin(partyId: string, characterLinkId: string, ownerId: string): Promise<void>
  decide(memberId: string, status: 'accepted' | 'declined'): Promise<void>
  /** Sair, cancelar pedido ou (líder) remover alguém. */
  removeMember(memberId: string): Promise<void>

  /** Líder convida um personagem. Se ele já tinha pedido vaga, o pedido é aceito ('accepted'). */
  invite(partyId: string, characterLinkId: string): Promise<'invited' | 'accepted'>
  /** O jogador convidado aceita (recusar = removeMember). */
  acceptInvite(memberId: string): Promise<void>
  /** Quem está, pediu ou foi convidado nestas parties (para a busca de jogadores). */
  listMemberships(partyIds: readonly string[]): Promise<Membership[]>
}
