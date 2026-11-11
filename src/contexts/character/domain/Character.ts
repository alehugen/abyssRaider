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
  'Brawler',
] as const

export type CharacterClass = (typeof CHARACTER_CLASSES)[number]

export type CombatRole = 'tank' | 'healer' | 'dps'

/**
 * Papéis que cada classe pode cumprir na party; o primeiro é o principal.
 * Híbridos: Gladiator entra como tanque ou dano; Chanter como dano ou cura.
 */
export const CLASS_ROLES: Record<CharacterClass, readonly CombatRole[]> = {
  Gladiator: ['tank', 'dps'],
  Templar: ['tank'],
  Assassin: ['dps'],
  Ranger: ['dps'],
  Sorcerer: ['dps'],
  Spiritmaster: ['dps'],
  Cleric: ['healer'],
  Chanter: ['dps', 'healer'],
  Brawler: ['dps'],
}

export const ROLE_LABEL: Record<CombatRole, string> = {
  tank: 'tanque',
  healer: 'cura',
  dps: 'dano',
}

/** A API às vezes usa o nome interno (Elementalist, Fighter) em vez do exibido. */
const CLASS_ALIASES: Record<string, CharacterClass> = {
  Elementalist: 'Spiritmaster',
  Fighter: 'Brawler',
}

export function normalizeClassName(value: string): string {
  const titled = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
  return CLASS_ALIASES[titled] ?? titled
}

export function isCharacterClass(value: string): value is CharacterClass {
  return (CHARACTER_CLASSES as readonly string[]).includes(value)
}

/** Todos os papéis possíveis; vazio se a API trouxer uma classe desconhecida. */
export function rolesOf(className: string): readonly CombatRole[] {
  const name = normalizeClassName(className)
  return isCharacterClass(name) ? CLASS_ROLES[name] : []
}

/** Papel principal (o primeiro da lista), ou null para classe desconhecida. */
export function roleOf(className: string): CombatRole | null {
  return rolesOf(className)[0] ?? null
}

/**
 * Nomes de classe (como a API grava) que cumprem algum dos papéis, incluindo os
 * nomes internos. Ex.: dano -> Gladiator, ..., Spiritmaster, Elementalist, Chanter, ...
 */
export function classNamesFor(roles: readonly CombatRole[]): string[] {
  const names = CHARACTER_CLASSES.filter((c) => CLASS_ROLES[c].some((r) => roles.includes(r)))
  const aliases = Object.entries(CLASS_ALIASES)
    .filter(([, target]) => names.includes(target))
    .map(([alias]) => alias)
  return [...names, ...aliases]
}

/** "dano/cura" para híbridos. */
export function rolesLabel(className: string): string {
  return rolesOf(className).map((r) => ROLE_LABEL[r]).join('/')
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
