import { describe, expect, it } from 'vitest'
import type { Character } from '@/contexts/character/domain/Character'
import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import {
  canJoin,
  composition,
  groups,
  isFull,
  neededRolesFor,
  openRoles,
  type Party,
  type PartyMember,
} from './Party'

const party: Party = {
  id: 'p1',
  name: 'Ludra de quinta',
  sanctuary: { id: 'ludra', name: 'Abyssal Forge: Ludra', minItemLevel: 2800, groupSize: 10 },
  leaderId: 'u-leader',
  leaderCharacterLinkId: 'leader',
  region: 'la',
  faction: 'asmodian',
  createdAt: new Date(),
}

function linked(linkId: string, c: Partial<Character> = {}): LinkedCharacter {
  return {
    linkId,
    ownerId: `owner-${linkId}`,
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

function member(linkId: string, c: Partial<Character> = {}, status: PartyMember['status'] = 'accepted'): PartyMember {
  return { id: `m-${linkId}`, partyId: 'p1', linked: linked(linkId, c), ownerName: 'x', ownerAvatarUrl: null, status, createdAt: new Date() }
}

describe('Party', () => {
  it('conta a composição só com os aceitos', () => {
    const members = [
      member('a', { className: 'Templar' }),
      member('b', { className: 'Cleric' }),
      member('c', { className: 'Elementalist' }),
      member('d', { className: 'Chanter' }, 'pending'),
    ]
    expect(composition(members, 10)).toEqual({ tank: 1, healer: 1, dps: 1, unknown: 0 })
  })

  it('encaixa o Chanter onde mais falta (cura ou dano)', () => {
    const noHealer = [member('t', { className: 'Templar' }), member('c', { className: 'Chanter' })]
    expect(composition(noHealer, 10)).toMatchObject({ healer: 1, dps: 0 })

    const healersFull = [
      member('h1', { className: 'Cleric' }),
      member('h2', { className: 'Cleric' }),
      member('c', { className: 'Chanter' }),
    ]
    expect(composition(healersFull, 10)).toMatchObject({ healer: 2, dps: 1 })
  })

  it('calcula vagas por papel e quem a party precisa', () => {
    const members = [
      member('leader', { className: 'Templar' }),
      member('t2', { className: 'Templar' }),
      member('h', { className: 'Cleric' }),
    ]
    expect(openRoles(party, members)).toEqual({ tank: 0, healer: 1, dps: 6 })
    expect(neededRolesFor(party, members, 'Templar')).toEqual([])
    expect(neededRolesFor(party, members, 'Chanter')).toEqual(['dps', 'healer'])
  })

  it('monta 2 grupos de 5, líder primeiro e depois por papel', () => {
    const members = [
      member('dps', { className: 'Ranger', combatPower: 100 }),
      member('healer', { className: 'Cleric' }),
      member('leader', { className: 'Sorcerer' }),
      member('tank', { className: 'Templar' }),
    ]
    const [g1, g2] = groups(party, members)
    expect(g1!.map((m) => m?.linked.linkId ?? null)).toEqual(['leader', 'tank', 'healer', 'dps', null])
    expect(g2).toEqual([null, null, null, null, null])
  })

  it('sabe quando está cheia', () => {
    const ten = Array.from({ length: 10 }, (_, i) => member(`m${i}`))
    expect(isFull(party, ten)).toBe(true)
    expect(isFull(party, ten.slice(1))).toBe(false)
  })

  it('valida facção, região e item level para entrar', () => {
    expect(canJoin(party, linked('ok'))).toEqual({ ok: true })
    expect(canJoin(party, linked('x', { faction: 'elyos' })).ok).toBe(false)
    expect(canJoin(party, linked('x', { region: 'eu' })).ok).toBe(false)
    expect(canJoin(party, linked('x', { itemLevel: 2500 })).ok).toBe(false)
  })
})
