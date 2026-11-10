import type { Character } from './Character'
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
}
