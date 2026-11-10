import type { Character } from './Character'
import type { CharacterRef } from './CharacterDirectory'
import type { LinkedCharacter } from './LinkedCharacter'

/** Porta de persistência dos personagens vinculados. */
export interface CharacterRepository {
  listByOwner(ownerId: string): Promise<LinkedCharacter[]>
  /**
   * Cria o vínculo ou atualiza o snapshot (mesmo personagem, mesmo dono).
   * Lança CharacterAlreadyClaimedError se outra conta já tiver o personagem.
   */
  save(ownerId: string, character: Character): Promise<LinkedCharacter>
  remove(linkId: string): Promise<void>
  /**
   * Quais destes personagens do jogo já estão vinculados, e a quem.
   * Usado na busca para mostrar "já vinculado" antes de tentar.
   */
  findOwners(refs: readonly CharacterRef[]): Promise<Array<CharacterRef & { ownerId: string }>>
}
