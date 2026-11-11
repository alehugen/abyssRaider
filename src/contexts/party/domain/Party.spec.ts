import { describe, expect, it } from 'vitest'
import type { Character } from '@/contexts/character/domain/Character'
import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import {
  canJoin,
  joinBlockedMessage,
  composition,
  assignRoles,
  groups,
  moveInLayout,
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

  it('Gladiator é tanque ou dano: vira tanque se falta tanque, senão dano', () => {
    const g = member('g', { className: 'Gladiator' })
    expect(assignRoles([member('c', { className: 'Cleric' }), g], 10).get(g.id)).toBe('tank')
    const tanks = [member('t1', { className: 'Templar' }), member('t2', { className: 'Templar' })]
    expect(assignRoles([...tanks, g], 10).get(g.id)).toBe('dps')
  })

  it('respeita vagas fixas e encaixa os outros nas livres', () => {
    const members = [
      { ...member('leader', { className: 'Sorcerer' }), slot: 7 },
      member('tank', { className: 'Templar' }),
      { ...member('healer', { className: 'Cleric' }), slot: 0 },
      // vaga já ocupada pelo healer: vira automático
      { ...member('dps', { className: 'Ranger' }), slot: 0 },
    ]
    const ids = groups(party, members).flat().map((m) => m?.linked.linkId ?? null)
    expect(ids).toEqual(['healer', 'tank', 'dps', null, null, null, null, 'leader', null, null])
  })

  it('move ou troca de vaga e devolve a formação inteira', () => {
    const grid = groups(party, [member('leader'), member('a'), member('b')])
    // leader 0, a 1, b 2 -> leva o "a" para o grupo 2 (vaga vazia)
    expect(moveInLayout(grid, 1, 6)).toEqual([
      { memberId: 'm-leader', slot: 0 },
      { memberId: 'm-b', slot: 2 },
      { memberId: 'm-a', slot: 6 },
    ])
    // troca leader (0) com b (2)
    expect(moveInLayout(grid, 0, 2).map((x) => [x.memberId, x.slot])).toEqual([
      ['m-b', 0],
      ['m-a', 1],
      ['m-leader', 2],
    ])
    // arrastar vaga vazia não faz nada
    expect(moveInLayout(grid, 5, 0)).toHaveLength(3)
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

  it('explica por que não dá para entrar (facção é o caso comum)', () => {
    // party do teste: asmodian, região la
    expect(joinBlockedMessage(party, [linked('ok')])).toBeNull()
    expect(joinBlockedMessage(party, [])).toBeNull()
    expect(joinBlockedMessage(party, [linked('e', { faction: 'elyos' })])).toBe(
      'Esta party é Asmodian e seus personagens são Elyos. No Aion 2 as facções não fazem party juntas: procure uma party Elyos ou crie a sua.',
    )
    expect(canJoin(party, linked('e', { faction: 'elyos' }))).toEqual({ ok: false, reason: 'Elyos (party Asmodian)' })
    expect(joinBlockedMessage(party, [linked('r', { region: 'eu' })])).toContain('outra região')
    expect(joinBlockedMessage(party, [linked('i', { itemLevel: 2500 }), linked('e', { faction: 'elyos' })])).toContain(
      'Veja o motivo',
    )
  })
})
