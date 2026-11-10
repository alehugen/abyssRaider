import type { Character, CharacterSummary, Region, Server } from './Character'
import type { CharacterBuild, Gear, GearDetail } from './CharacterBuild'

export interface CharacterRef {
  region: Region
  serverId: number
  id: string
}

/** Porta para o diretório oficial do jogo (API do Aion 2, via proxy). Somente leitura. */
export interface CharacterDirectory {
  search(query: { region: Region; name: string; serverId?: number }): Promise<CharacterSummary[]>
  get(ref: CharacterRef): Promise<Character | null>
  servers(region: Region): Promise<Server[]>
  /** Equipamento, atributos e skills; null se o personagem não existe mais. */
  build(ref: CharacterRef): Promise<CharacterBuild | null>
  /** Detalhe de uma peça equipada (atributos, pedras de mana). */
  gear(ref: CharacterRef, gear: Pick<Gear, 'itemId' | 'slot' | 'enchantLevel'>): Promise<GearDetail>
}
