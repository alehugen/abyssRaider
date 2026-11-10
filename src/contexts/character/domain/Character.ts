export type Faction = 'elyos' | 'asmodian'

export const CHARACTER_CLASSES = [
  'Gladiator',
  'Templar',
  'Assassin',
  'Ranger',
  'Sorcerer',
  'Spiritmaster',
  'Cleric',
  'Chanter',
] as const

export type CharacterClass = (typeof CHARACTER_CLASSES)[number]

export type CombatRole = 'tank' | 'healer' | 'support' | 'dps'

/** Papel padrão de cada classe na montagem da party. */
export const CLASS_ROLE: Record<CharacterClass, CombatRole> = {
  Gladiator: 'dps',
  Templar: 'tank',
  Assassin: 'dps',
  Ranger: 'dps',
  Sorcerer: 'dps',
  Spiritmaster: 'dps',
  Cleric: 'healer',
  Chanter: 'support',
}

export type Region = 'nae' | 'naw' | 'eu' | 'la' | 'as'

export interface Character {
  /** characterId da API oficial (opaco). */
  id: string
  name: string
  faction: Faction
  className: CharacterClass
  level: number
  region: Region
  serverId: number
  serverName: string
  combatPower?: number
  itemLevel?: number
  legionName?: string
  portraitUrl?: string
}
