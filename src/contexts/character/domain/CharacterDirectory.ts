import type { Character, CharacterSummary, Region, Server } from './Character'

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
}
