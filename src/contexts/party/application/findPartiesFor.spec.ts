import { describe, expect, it } from 'vitest'
import type { Character } from '@/contexts/character/domain/Character'
import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import type { Party, PartyDetails, PartyMember } from '../domain/Party'
import { findPartiesFor } from './findPartiesFor'

function linked(linkId: string, ownerId: string, c: Partial<Character> = {}): LinkedCharacter {
  return {
    linkId,
    ownerId,
    syncedAt: new Date(),
    character: {
      id: linkId,
      name: linkId,
      faction: 'asmodian',
      className: 'Gladiator',
      level: 45,
      region: 'la',
      serverId: 2401,
      serverName: 'Siel',
      itemLevel: 3000,
      ...c,
    },
  }
}

function details(id: string, classes: string[], over: Partial<Party> = {}): PartyDetails {
  const party: Party = {
    id,
    name: id,
    sanctuary: { id: 'ludra', name: 'Ludra', minItemLevel: 2800, groupSize: 10 },
    leaderId: `leader-${id}`,
    leaderCharacterLinkId: `${id}-0`,
    region: 'la',
    faction: 'asmodian',
    createdAt: new Date(),
    ...over,
  }
  const members: PartyMember[] = classes.map((className, i) => ({
    id: `${id}-m${i}`,
    partyId: id,
    linked: linked(`${id}-${i}`, i === 0 ? party.leaderId : `${id}-owner${i}`, { className }),
    ownerName: 'x',
    ownerAvatarUrl: null,
    status: 'accepted',
    createdAt: new Date(),
  }))
  return { party, members }
}

describe('findPartiesFor', () => {
  const cleric = linked('me', 'me-owner', { className: 'Cleric' })
  const ids = (list: Array<{ details: PartyDetails }>) => list.map((m) => m.details.party.id)

  it('separa quem precisa do papel de quem já tem o papel completo', () => {
    const needsHealer = details('a', ['Templar', 'Gladiator'])
    const healersFull = details('b', ['Cleric', 'Cleric'])
    const result = findPartiesFor(cleric, [needsHealer, healersFull])
    expect(ids(result.needYou)).toEqual(['a'])
    expect(result.needYou[0]!.needed).toEqual(['healer'])
    expect(ids(result.noRoleSlot)).toEqual(['b'])
    expect(result.noRoleSlot[0]!.needed).toEqual([])
  })

  it('mostra parties da outra facção (raid é entre facções), separa as suas e ignora cheias e outra região', () => {
    const elyos = details('e', ['Templar'], { faction: 'elyos' })
    const outraRegiao = details('r', ['Templar'], { region: 'eu' })
    const mine = details('m', ['Templar'], { leaderId: 'me-owner' })
    const full = details('f', Array.from({ length: 10 }, () => 'Gladiator'))
    const result = findPartiesFor(cleric, [elyos, outraRegiao, mine, full])
    expect(result.needYou.map((m) => m.details.party.id)).toEqual(['e'])
    expect(result.noRoleSlot).toEqual([])
    expect(result.mine.map((d) => d.party.id)).toEqual(['m'])
  })

  it('Chanter casa com parties que precisam de dano ou de cura', () => {
    const chanter = linked('ch', 'ch-owner', { className: 'Chanter' })
    const result = findPartiesFor(chanter, [details('a', ['Templar', 'Cleric', 'Cleric'])])
    expect(result.needYou[0]!.needed).toEqual(['dps'])
  })
})
