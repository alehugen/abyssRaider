import type { CharacterDirectory, CharacterRef } from '../domain/CharacterDirectory'
import type { CharacterRepository } from '../domain/CharacterRepository'
import {
  CharacterLimitReachedError,
  CharacterNotFoundError,
  MAX_CHARACTERS_PER_ACCOUNT,
  type LinkedCharacter,
} from '../domain/LinkedCharacter'

interface Deps {
  directory: CharacterDirectory
  repository: CharacterRepository
}

/**
 * Busca os dados completos na API oficial (classe, CP, item level) e salva o
 * snapshot vinculado ao dono. Também serve para "atualizar" um já vinculado.
 */
export async function linkCharacter(
  { directory, repository }: Deps,
  ownerId: string,
  ref: CharacterRef,
  current: readonly LinkedCharacter[],
): Promise<LinkedCharacter> {
  const alreadyMine = current.some((l) => l.character.id === ref.id && l.character.serverId === ref.serverId)
  if (!alreadyMine && current.length >= MAX_CHARACTERS_PER_ACCOUNT) throw new CharacterLimitReachedError()

  const character = await directory.get(ref)
  if (!character) throw new CharacterNotFoundError()
  return repository.save(ownerId, character)
}
