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

  it('lista só parties que precisam do papel do personagem', () => {
    const needsHealer = details('a', ['Templar', 'Gladiator'])
    const healersFull = details('b', ['Cleric', 'Cleric'])
    const result = findPartiesFor(cleric, [needsHealer, healersFull])
    expect(result.map((m) => m.details.party.id)).toEqual(['a'])
    expect(result[0]!.needed).toEqual(['healer'])
  })

  it('ignora outra facção e parties onde a conta já está', () => {
    const elyos = details('e', ['Templar'], { faction: 'elyos' })
    const mine = details('m', ['Templar'], { leaderId: 'me-owner' })
    expect(findPartiesFor(cleric, [elyos, mine])).toEqual([])
  })

  it('Chanter casa com parties que precisam de dano ou de cura', () => {
    const chanter = linked('ch', 'ch-owner', { className: 'Chanter' })
    const result = findPartiesFor(chanter, [details('a', ['Templar', 'Cleric', 'Cleric'])])
    expect(result[0]!.needed).toEqual(['dps'])
  })
})
