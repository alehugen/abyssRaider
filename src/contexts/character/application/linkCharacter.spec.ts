import { describe, expect, it, vi } from 'vitest'
import type { Character } from '../domain/Character'
import type { CharacterDirectory } from '../domain/CharacterDirectory'
import type { CharacterRepository } from '../domain/CharacterRepository'
import {
  CharacterLimitReachedError,
  CharacterNotFoundError,
  MAX_CHARACTERS_PER_ACCOUNT,
  type LinkedCharacter,
} from '../domain/LinkedCharacter'
import { linkCharacter } from './linkCharacter'

const lele: Character = {
  id: 'abc=',
  name: 'Lele',
  faction: 'elyos',
  className: 'Assassin',
  level: 23,
  region: 'eu',
  serverId: 1313,
  serverName: 'Phernos',
  combatPower: 18207,
}
const ref = { region: 'eu' as const, serverId: 1313, id: 'abc=' }
const linked = (c: Character, i = 0): LinkedCharacter => ({ linkId: `l${i}`, ownerId: 'u1', character: c, syncedAt: new Date() })

function deps(found: Character | null) {
  const directory: CharacterDirectory = { search: vi.fn(), servers: vi.fn(), get: vi.fn(async () => found), build: vi.fn(), gear: vi.fn() }
  const repository: CharacterRepository = {
    listByOwner: vi.fn(),
    remove: vi.fn(),
    findOwners: vi.fn(async () => []),
    searchPlayers: vi.fn(async () => []),
    save: vi.fn(async (ownerId, character) => ({ linkId: 'new', ownerId, character, syncedAt: new Date() })),
  }
  return { directory, repository }
}

describe('linkCharacter', () => {
  it('busca os dados completos e salva para o dono', async () => {
    const d = deps(lele)
    const result = await linkCharacter(d, 'u1', ref, [])
    expect(d.directory.get).toHaveBeenCalledWith(ref)
    expect(d.repository.save).toHaveBeenCalledWith('u1', lele)
    expect(result.character.combatPower).toBe(18207)
  })

  it('falha se o personagem não existir na API', async () => {
    await expect(linkCharacter(deps(null), 'u1', ref, [])).rejects.toBeInstanceOf(CharacterNotFoundError)
  })

  it('respeita o limite, mas permite atualizar um já vinculado', async () => {
    const full = Array.from({ length: MAX_CHARACTERS_PER_ACCOUNT }, (_, i) =>
      linked({ ...lele, id: i === 0 ? 'abc=' : `x${i}` }, i),
    )
    await expect(linkCharacter(deps(lele), 'u1', { ...ref, id: 'novo' }, full)).rejects.toBeInstanceOf(
      CharacterLimitReachedError,
    )
    await expect(linkCharacter(deps(lele), 'u1', ref, full)).resolves.toBeTruthy()
  })
})
