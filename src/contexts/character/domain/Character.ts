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

/** Papel padrão de cada classe na montagem da party (sujeito a revisão). */
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

export const ROLE_LABEL: Record<CombatRole, string> = {
  tank: 'tanque',
  healer: 'cura',
  support: 'suporte',
  dps: 'dano',
}

/** A API às vezes usa o nome interno (Elementalist) em vez do exibido (Spiritmaster). */
const CLASS_ALIASES: Record<string, CharacterClass> = { Elementalist: 'Spiritmaster' }

export function normalizeClassName(value: string): string {
  return CLASS_ALIASES[value] ?? value
}

export function isCharacterClass(value: string): value is CharacterClass {
  return (CHARACTER_CLASSES as readonly string[]).includes(value)
}

/** A API pode trazer classes novas; nesse caso não há papel sugerido. */
export function roleOf(className: string): CombatRole | null {
  const name = normalizeClassName(className)
  return isCharacterClass(name) ? CLASS_ROLE[name] : null
}

export const REGIONS = ['nae', 'naw', 'eu', 'la', 'as'] as const
export type Region = (typeof REGIONS)[number]

export const REGION_LABEL: Record<Region, string> = {
  nae: 'América do Norte (Leste)',
  naw: 'América do Norte (Oeste)',
  eu: 'Europa',
  la: 'América Latina',
  as: 'Ásia / Oceania',
}

/** Resultado da busca: a API não traz classe, CP nem item level aqui. */
export interface CharacterSummary {
  /** characterId da API oficial (opaco). */
  id: string
  name: string
  faction: Faction
  level: number
  region: Region
  serverId: number
  serverName: string
  portraitUrl?: string
}

export interface Server {
  id: number
  name: string
  faction: Faction
}

export interface Character {
  /** characterId da API oficial (opaco). */
  id: string
  name: string
  faction: Faction
  /** Normalmente um CharacterClass, mas aceita classes novas vindas da API. */
  className: string
  level: number
  region: Region
  serverId: number
  serverName: string
  combatPower?: number
  itemLevel?: number
  legionName?: string
  portraitUrl?: string
}
