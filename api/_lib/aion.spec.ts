import { describe, expect, it } from 'vitest'
import { decodeId, normalizeCharacter, normalizeSearch, normalizeServers, stripTags } from './aion.js'

describe('API do Aion (normalização)', () => {
  it('limpa o realce e o encoding do id na busca', () => {
    const [first] = normalizeSearch(
      {
        list: [
          {
            characterId: 'tMf1G5JFEh2Qy9U5BXofyyaS2DG-qeR6l4lMJlGuhYA%3D',
            name: '<strong>Lele</strong>',
            race: 1,
            level: 23,
            serverId: 1313,
            serverName: 'Phernos',
            profileImageUrl: '/game_profile_images/aion2global/images?gameServerKey=1313&charKey=1',
            region: 'eu',
          },
        ],
      },
      'eu',
    )
    expect(first).toEqual({
      id: 'tMf1G5JFEh2Qy9U5BXofyyaS2DG-qeR6l4lMJlGuhYA=',
      name: 'Lele',
      faction: 'elyos',
      level: 23,
      region: 'eu',
      serverId: 1313,
      serverName: 'Phernos',
      portraitUrl: 'https://profileimg.plaync.com/game_profile_images/aion2global/images?gameServerKey=1313&charKey=1',
    })
  })

  it('extrai classe, CP e item level do detalhe', () => {
    const character = normalizeCharacter(
      {
        profile: {
          characterId: 'abc=',
          characterName: 'Lele',
          className: 'Assassin',
          characterLevel: 23,
          combatPower: 18207,
          raceId: 2,
          serverId: 2313,
          serverName: 'Munin',
          profileImage: 'https://profileimg.plaync.com/x',
        },
        stat: { statList: [{ type: 'DEX', value: 17 }, { type: 'ItemLevel', value: 298 }] },
      },
      'eu',
    )
    expect(character).toMatchObject({
      id: 'abc=',
      faction: 'asmodian',
      className: 'Assassin',
      combatPower: 18207,
      itemLevel: 298,
      portraitUrl: 'https://profileimg.plaync.com/x',
    })
    expect(normalizeCharacter({}, 'eu')).toBeNull()
  })

  it('normaliza servidores e utilitários', () => {
    expect(normalizeServers({ serverList: [{ raceId: 2, serverId: 2301, serverName: 'X' }] })).toEqual([
      { id: 2301, name: 'X', faction: 'asmodian' },
    ])
    expect(stripTags('<b>a</b>b')).toBe('ab')
    expect(decodeId('%E0%A4%A')).toBe('%E0%A4%A')
  })
})
