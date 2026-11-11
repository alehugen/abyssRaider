import { describe, expect, it } from 'vitest'
import { classNamesFor, type Character } from '@/contexts/character/domain/Character'
import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import type { PartySummary } from '../domain/Party'
import { inviteOptions, type Membership } from './inviteOptions'

const summary = (id: string, over: Partial<PartySummary> = {}): PartySummary => ({
  party: {
    id,
    name: id,
    sanctuary: { id: 'ludra', name: 'Ludra', minItemLevel: 2800, groupSize: 10 },
    leaderId: 'leader',
    leaderCharacterLinkId: 'lc',
    region: 'la',
    faction: 'asmodian',
    createdAt: new Date(),
  },
  leaderCharacterName: 'Líder',
  acceptedCount: 4,
  myStatus: 'leader',
  ...over,
})

const linked = (c: Partial<Character> = {}): LinkedCharacter => ({
  linkId: 'c1',
  ownerId: 'u1',
  syncedAt: new Date(),
  character: {
    id: 'aion',
    name: 'Bia',
    faction: 'asmodian',
    className: 'Cleric',
    level: 45,
    region: 'la',
    serverId: 1,
    serverName: 'Siel',
    itemLevel: 3000,
    ...c,
  },
})

const states = (led: PartySummary[], l: LinkedCharacter, ms: Membership[] = []) =>
  inviteOptions(led, l, ms).map((o) => [o.summary.party.id, o.state, o.reason])

describe('inviteOptions', () => {
  it('libera quando cabe, e explica quando não dá', () => {
    expect(
      states(
        [
          summary('ok'),
          summary('cheia', { acceptedCount: 10 }),
          summary('elyos', {
            party: { ...summary('elyos').party, faction: 'elyos' },
          }),
          summary('eu', {
            party: { ...summary('eu').party, region: 'eu' },
          }),
        ],
        linked(),
      ),
    ).toEqual([
      ['ok', 'can-invite', null],
      ['cheia', 'blocked', 'Party completa'],
      ['elyos', 'can-invite', null], // raid é entre facções
      ['eu', 'blocked', 'Outra região'],
    ])
    expect(states([summary('ok')], linked({ itemLevel: 2500 }))).toEqual([
      ['ok', 'blocked', 'Item level abaixo de 2800'],
    ])
  })

  it('reconhece quem já está, foi convidado ou pediu vaga', () => {
    const m = (status: Membership['status'], partyId: string): Membership => ({
      partyId,
      characterLinkId: 'c1',
      ownerId: 'u1',
      status,
    })
    expect(
      states([summary('a'), summary('b'), summary('c'), summary('d')], linked(), [
        m('accepted', 'a'),
        m('invited', 'b'),
        m('pending', 'c'),
        m('declined', 'd'),
      ]).map(([, s]) => s),
    ).toEqual(['member', 'invited', 'requested', 'can-invite'])
  })

  it('bloqueia se a conta já tem outro personagem na party', () => {
    const other: Membership = { partyId: 'a', characterLinkId: 'c2', ownerId: 'u1', status: 'accepted' }
    expect(states([summary('a')], linked(), [other])).toEqual([['a', 'blocked', 'Já tem outro personagem na party']])
  })

  it('classes por papel incluem os nomes internos da API', () => {
    expect(classNamesFor(['healer'])).toEqual(['Cleric', 'Chanter'])
    expect(classNamesFor(['dps'])).toEqual(expect.arrayContaining(['Spiritmaster', 'Elementalist', 'Brawler', 'Fighter', 'Chanter']))
    expect(classNamesFor(['tank'])).toEqual(['Gladiator', 'Templar'])
  })
})
