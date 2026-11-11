import type { Character, CombatRole, Faction, Region } from './Character'
import type { CharacterRef } from './CharacterDirectory'
import type { LinkedCharacter } from './LinkedCharacter'

/** Personagem vinculado de outro jogador, como aparece na busca de jogadores. */
export interface PlayerListing {
  linked: LinkedCharacter
  ownerName: string
  ownerAvatarUrl: string | null
}

export interface PlayerSearchFilter {
  region: Region
  faction?: Faction | null
  /** Qualquer um dos papéis (Chanter entra em dano e em cura). */
  roles?: readonly CombatRole[]
  minItemLevel?: number | null
  /** Parte do nome do personagem. */
  name?: string
  /** Normalmente a conta logada: não lista os próprios personagens. */
  excludeOwnerId?: string | null
  limit?: number
}

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
  /** Busca de jogadores: maior item level primeiro. */
  searchPlayers(filter: PlayerSearchFilter): Promise<PlayerListing[]>
}
