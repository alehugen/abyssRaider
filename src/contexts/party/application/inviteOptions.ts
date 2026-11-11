import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import type { MemberStatus, PartySummary } from '../domain/Party'

/** Quem já está (ou foi chamado) numa party: base para saber se dá para convidar. */
export interface Membership {
  partyId: string
  characterLinkId: string
  ownerId: string
  status: MemberStatus
}

export type InviteState =
  | 'can-invite'
  /** Pediu para entrar: convidar = aceitar o pedido. */
  | 'requested'
  | 'invited'
  | 'member'
  | 'blocked'

export interface InviteOption {
  summary: PartySummary
  state: InviteState
  /** Motivo quando bloqueado (ex.: item level abaixo do mínimo). */
  reason: string | null
}

/**
 * Para cada party que o usuário lidera, o que dá para fazer com este personagem.
 * As mesmas regras são garantidas no banco (invite_to_party / check_party_member).
 */
export function inviteOptions(
  led: readonly PartySummary[],
  linked: LinkedCharacter,
  memberships: readonly Membership[],
): InviteOption[] {
  const c = linked.character
  return led.map((summary) => {
    const p = summary.party
    const mine = memberships.find((m) => m.partyId === p.id && m.characterLinkId === linked.linkId)
    const option = (state: InviteState, reason: string | null = null): InviteOption => ({ summary, state, reason })

    if (mine?.status === 'accepted') return option('member')
    if (mine?.status === 'invited') return option('invited')
    if (summary.acceptedCount >= p.sanctuary.groupSize) return option('blocked', 'Party completa')
    if (mine?.status === 'pending') return option('requested')

    if (c.region !== p.region) return option('blocked', 'Outra região')
    if (p.sanctuary.minItemLevel && (c.itemLevel ?? 0) < p.sanctuary.minItemLevel) {
      return option('blocked', `Item level abaixo de ${p.sanctuary.minItemLevel}`)
    }
    const otherChar = memberships.some(
      (m) => m.partyId === p.id && m.ownerId === linked.ownerId && m.characterLinkId !== linked.linkId && m.status !== 'declined',
    )
    if (otherChar) return option('blocked', 'Já tem outro personagem na party')
    return option('can-invite')
  })
}
