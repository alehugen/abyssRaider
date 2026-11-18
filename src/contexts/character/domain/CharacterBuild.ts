import { t } from '@/shared/i18n'

/**
 * Build de um personagem como o jogo mostra: equipamento, atributos, skills,
 * Daevanion e títulos. Somente leitura, vinda da API oficial (nomes em pt-BR).
 */

export interface Stat {
  type: string
  name: string
  value: number
  /** base = Poder, Agilidade...; divine = atributos dos deuses (Justiça [Nezekan]...). */
  kind: 'base' | 'divine'
  effects: string[]
}

export interface Gear {
  slot: number
  /** Código do slot na API: MainHand, Torso, Ring1, Arcana3... */
  slotName: string
  itemId: number
  name: string
  grade: string
  icon: string | null
  enchantLevel: number
  /** Encantamento além do máximo (+15 +3). */
  exceedLevel: number
}

export interface Skill {
  id: number
  name: string
  icon: string | null
  category: 'active' | 'passive' | 'dp'
  level: number
  equipped: boolean
}

export interface CharacterBuild {
  itemLevel: number | null
  stats: Stat[]
  daevanion: Array<{ id: number; name: string; icon: string | null; openNodes: number; totalNodes: number }>
  titles: Array<{ category: string; name: string; grade: string; effects: string[] }>
  equipment: Gear[]
  pet: { name: string; icon: string | null; level: number } | null
  wing: { name: string; icon: string | null; grade: string; enchantLevel: number } | null
  skills: Skill[]
}

export interface GearDetail {
  name: string
  grade: string
  gradeName: string
  icon: string | null
  category: string
  level: number | null
  enchantLevel: number
  maxEnchantLevel: number | null
  /** Até onde dá para superar depois do máximo (+15 +5); null = não informado. */
  maxExceedLevel: number | null
  enchantable: boolean
  surpassable: boolean
  /** Encaixes de pedra de mana da peça (0 = sem encaixe). */
  stoneSlots: number
  mainStats: Array<{ name: string; value: string; extra: string | null }>
  subStats: Array<{ name: string; value: string }>
  skills: Array<{ name: string; icon: string | null; level: number }>
  manastones: Array<{ name: string; value: string; grade: string }>
}

// ---------------------------------------------------------------- slots

const SLOT_KEYS = [
  'MainHand',
  'SubHand',
  'Helmet',
  'Shoulder',
  'Torso',
  'Pants',
  'Gloves',
  'Boots',
  'Cape',
  'Belt',
  'Necklace',
  'Earring',
  'Ring',
  'Bracelet',
  'Amulet',
  'Rune',
  'Arcana',
] as const
const isSlotKey = (v: string): boolean => (SLOT_KEYS as readonly string[]).includes(v)

/** "Ring2" -> "Anel" (no idioma atual); slots novos caem no código da API. */
export function slotLabel(slotName: string): string {
  const key = isSlotKey(slotName) ? slotName : slotName.replace(/\d+$/, '')
  return isSlotKey(key) ? t(`character.slots.${key}`) : slotName
}

export const GEAR_GROUPS = [
  { id: 'weapons', slots: ['MainHand', 'SubHand'] },
  { id: 'armor', slots: ['Helmet', 'Shoulder', 'Torso', 'Pants', 'Gloves', 'Boots', 'Cape', 'Belt'] },
  {
    id: 'accessories',
    slots: ['Necklace', 'Earring1', 'Earring2', 'Ring1', 'Ring2', 'Bracelet1', 'Bracelet2', 'Amulet'],
  },
  { id: 'runes', slots: ['Rune1', 'Rune2'] },
  { id: 'arcana', slots: ['Arcana1', 'Arcana2', 'Arcana3', 'Arcana4', 'Arcana5'] },
] as const

/** Agrupa o equipamento na ordem da tela do jogo. Slots desconhecidos vão para "Outros". */
export function groupGear(equipment: readonly Gear[]): Array<{ id: string; label: string; items: Gear[] }> {
  const bySlot = new Map(equipment.map((g) => [g.slotName, g]))
  const known = new Set<string>(GEAR_GROUPS.flatMap((g) => g.slots))
  const groups: Array<{ id: string; label: string; items: Gear[] }> = GEAR_GROUPS.map((g) => ({
    id: g.id,
    label: t(`character.gearGroups.${g.id}`),
    items: g.slots.map((s) => bySlot.get(s)).filter((x): x is Gear => !!x),
  }))
  const others = equipment.filter((g) => !known.has(g.slotName))
  if (others.length) groups.push({ id: 'others', label: t('character.gearGroups.others'), items: others })
  return groups.filter((g) => g.items.length)
}

/** "+15", "+15 +3" ou "" quando não encantado. */
export function enchantLabel(gear: Pick<Gear, 'enchantLevel' | 'exceedLevel'>): string {
  if (!gear.enchantLevel) return ''
  return gear.exceedLevel ? `+${gear.enchantLevel} +${gear.exceedLevel}` : `+${gear.enchantLevel}`
}

/** Rótulo traduzido de cada categoria de skill (getters: leem o idioma atual). */
export const SKILL_CATEGORY_LABEL: Readonly<Record<Skill['category'], string>> = {
  get active() {
    return t('character.skillCategories.active')
  },
  get passive() {
    return t('character.skillCategories.passive')
  },
  get dp() {
    return t('character.skillCategories.dp')
  },
}

const TITLE_CATEGORIES = ['Attack', 'Defense', 'Etc']

export function titleCategoryLabel(category: string): string {
  return TITLE_CATEGORIES.includes(category) ? t(`character.titleCategories.${category}`) : category
}

/** Skills por categoria, equipadas primeiro e depois por nível. */
export function groupSkills(skills: readonly Skill[]): Array<{ category: Skill['category']; skills: Skill[] }> {
  return (['active', 'passive', 'dp'] as const)
    .map((category) => ({
      category,
      skills: skills
        .filter((s) => s.category === category)
        .sort((a, b) => Number(b.equipped) - Number(a.equipped) || b.level - a.level),
    }))
    .filter((g) => g.skills.length)
}
