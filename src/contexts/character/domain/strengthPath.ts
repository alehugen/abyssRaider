import { slotLabel, type CharacterBuild, type Gear, type GearDetail } from './CharacterBuild'

/**
 * Caminho de Fortalecimento: próximos passos para o personagem ficar mais forte,
 * só com os dados da API oficial (build + detalhe de cada peça).
 *
 * As regras comparam o personagem com ele mesmo e com os limites que o próprio
 * jogo informa (encantamento máximo, superar, encaixes de pedra). Não há meta de
 * classe nem cálculo de dano: o impacto é uma estimativa pela importância do slot
 * e pelo tamanho do que falta.
 */

export type StepKind = 'missing' | 'outdated' | 'enchant' | 'exceed' | 'stones' | 'daevanion'
export type Impact = 'high' | 'medium' | 'low'

export interface PathStep {
  id: string
  kind: StepKind
  title: string
  reason: string
  impact: Impact
  /** Barra de progresso (ex.: encantamento 12 de 15). */
  progress: { current: number; max: number } | null
  /** Peça envolvida (ícone e raridade na tela). */
  gear: Pick<Gear, 'slotName' | 'name' | 'grade' | 'icon'> | null
  score: number
}

export const IMPACT_LABEL: Record<Impact, string> = { high: 'Impacto alto', medium: 'Impacto médio', low: 'Impacto baixo' }

/** Peso de cada slot: arma pesa mais que armadura, que pesa mais que acessório. */
function slotWeight(slotName: string): number {
  const base = slotName.replace(/\d+$/, '')
  if (base === 'MainHand') return 1
  if (base === 'SubHand') return 0.75
  if (['Helmet', 'Shoulder', 'Torso', 'Pants', 'Gloves', 'Boots'].includes(base)) return 0.65
  if (['Necklace', 'Earring', 'Ring'].includes(base)) return 0.55
  if (['Cape', 'Belt', 'Bracelet', 'Amulet'].includes(base)) return 0.45
  return 0.35 // runas, arcanas
}

/** Slots que todo personagem nível máximo tem. */
export const EXPECTED_SLOTS = [
  'MainHand', 'SubHand',
  'Helmet', 'Shoulder', 'Torso', 'Pants', 'Gloves', 'Boots', 'Cape', 'Belt',
  'Necklace', 'Earring1', 'Earring2', 'Ring1', 'Ring2', 'Bracelet1', 'Bracelet2', 'Amulet',
  'Rune1', 'Rune2',
  'Arcana1', 'Arcana2', 'Arcana3', 'Arcana4', 'Arcana5',
] as const

/**
 * Famílias de peças que costumam ter o mesmo nível de item: uma peça bem abaixo
 * das outras da família está ficando para trás. (Cinto, amuleto, runas e arcanas
 * são peças de outro tipo e não entram na comparação.)
 */
const FAMILIES: readonly (readonly string[])[] = [
  ['MainHand', 'SubHand', 'Helmet', 'Shoulder', 'Torso', 'Pants', 'Gloves', 'Boots', 'Cape'],
  ['Necklace', 'Earring1', 'Earring2', 'Ring1', 'Ring2'],
  ['Bracelet1', 'Bracelet2'],
]
/** Diferença de nível de item que conta como "ficando para trás". */
const OUTDATED_GAP = 8

function impactOf(score: number): Impact {
  if (score >= 45) return 'high'
  if (score >= 20) return 'medium'
  return 'low'
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]!
}

function step(s: Omit<PathStep, 'impact'>): PathStep {
  const score = Math.round(s.score)
  return { ...s, score, impact: impactOf(score) }
}

const gearRef = (g: Gear) => ({ slotName: g.slotName, name: g.name, grade: g.grade, icon: g.icon })
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Passos ordenados do mais para o menos importante. `details` traz o detalhe de
 * cada peça por slotName; peça sem detalhe (falhou ou ainda carregando) só entra
 * nas regras que dispensam o detalhe.
 */
export function strengthPath(build: CharacterBuild, details: ReadonlyMap<string, GearDetail>): PathStep[] {
  const steps: PathStep[] = []
  const bySlot = new Map(build.equipment.map((g) => [g.slotName, g]))

  // 1. Espaço vazio: qualquer peça já soma atributos.
  for (const slot of EXPECTED_SLOTS) {
    if (bySlot.has(slot)) continue
    steps.push(
      step({
        id: `missing:${slot}`,
        kind: 'missing',
        title: `Equipar ${slotLabel(slot).toLowerCase()}`,
        reason: 'Esse espaço está vazio: qualquer peça já soma atributos.',
        progress: null,
        gear: null,
        score: 60 + 40 * slotWeight(slot),
      }),
    )
  }

  // 2. Peça bem abaixo do nível das outras da família: trocar antes de investir nela.
  const outdated = new Set<string>()
  for (const family of FAMILIES) {
    const levels = family
      .map((slot) => ({ slot, level: details.get(slot)?.level ?? null }))
      .filter((x): x is { slot: string; level: number } => x.level != null && bySlot.has(x.slot))
    if (levels.length < 2) continue
    const top = Math.max(...levels.map((x) => x.level))
    const reference = levels.length > 2 ? median(levels.map((x) => x.level)) : top
    for (const { slot, level } of levels) {
      if (reference - level < OUTDATED_GAP) continue
      const g = bySlot.get(slot)!
      outdated.add(slot)
      steps.push(
        step({
          id: `outdated:${slot}`,
          kind: 'outdated',
          title: `Trocar ${g.name}`,
          reason: `${slotLabel(slot)} de nível ${level}; ${
            levels.length === 2 ? 'a outra peça do par é' : 'as outras peças do mesmo tipo são'
          } nível ${reference}. Encantar esta rende menos que trocar.`,
          progress: { current: level, max: reference },
          gear: gearRef(g),
          score: 40 + 50 * slotWeight(slot) * Math.min(1, (reference - level) / 40),
        }),
      )
    }
  }

  for (const g of build.equipment) {
    const d = details.get(g.slotName)
    if (!d || outdated.has(g.slotName)) continue
    const w = slotWeight(g.slotName)
    const max = d.maxEnchantLevel ?? null

    // 3. Encantar até o máximo da peça.
    if (d.enchantable !== false && max && g.enchantLevel < max) {
      const missing = max - g.enchantLevel
      steps.push(
        step({
          id: `enchant:${g.slotName}`,
          kind: 'enchant',
          title: `Encantar ${g.name} de +${g.enchantLevel} para +${max}`,
          reason: `${slotLabel(g.slotName)}: ${plural(missing, 'nível', 'níveis')} até o máximo da peça.`,
          progress: { current: g.enchantLevel, max },
          gear: gearRef(g),
          score: 15 + 60 * w * Math.min(1, missing / 5),
        }),
      )
    }

    // 4. Superar: depois do máximo, os níveis extras (+15 +1 ... +15 +5).
    const maxExceed = d.maxExceedLevel ?? null
    if (d.surpassable && max && g.enchantLevel >= max && maxExceed && g.exceedLevel < maxExceed) {
      const next = g.exceedLevel + 1
      steps.push(
        step({
          id: `exceed:${g.slotName}`,
          kind: 'exceed',
          title: `Superar ${g.name}: +${max} +${g.exceedLevel} para +${max} +${next}`,
          reason: `${slotLabel(g.slotName)}: encantamento no máximo; superar vai até +${max} +${maxExceed}.`,
          progress: { current: g.exceedLevel, max: maxExceed },
          gear: gearRef(g),
          score: 8 + 30 * w * ((maxExceed - g.exceedLevel) / maxExceed),
        }),
      )
    }

    // 5. Encaixes de pedra de mana vazios.
    const slots = d.stoneSlots ?? 0
    const filled = d.manastones?.length ?? 0
    if (slots > filled) {
      const empty = slots - filled
      steps.push(
        step({
          id: `stones:${g.slotName}`,
          kind: 'stones',
          title: `Colocar ${plural(empty, 'pedra de mana', 'pedras de mana')} em ${g.name}`,
          reason: `${slotLabel(g.slotName)} com ${plural(empty, 'encaixe vazio', 'encaixes vazios')} de ${slots}.`,
          progress: { current: filled, max: slots },
          gear: gearRef(g),
          score: 20 + 40 * w * (empty / slots),
        }),
      )
    }
  }

  // 6. Daevanion: nós ainda fechados em cada tabuleiro.
  for (const b of build.daevanion) {
    if (!b.totalNodes || b.openNodes >= b.totalNodes) continue
    const closed = b.totalNodes - b.openNodes
    steps.push(
      step({
        id: `daevanion:${b.id}`,
        kind: 'daevanion',
        title: `Abrir nós do Daevanion de ${b.name}`,
        reason: `${b.openNodes} de ${b.totalNodes} nós abertos (${closed === 1 ? 'falta' : 'faltam'} ${closed}).`,
        progress: { current: b.openNodes, max: b.totalNodes },
        gear: null,
        score: 10 + 35 * (closed / b.totalNodes),
      }),
    )
  }

  return mergeTwins(steps).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

/** Peças iguais nos dois slots do par (anéis, brincos) viram um passo só. */
function mergeTwins(steps: PathStep[]): PathStep[] {
  const byTitle = new Map<string, PathStep[]>()
  for (const s of steps) byTitle.set(s.title, [...(byTitle.get(s.title) ?? []), s])
  return [...byTitle.values()].map((group) =>
    group.length === 1 ? group[0]! : { ...group[0]!, title: `${group[0]!.title} (${group.length} peças)` },
  )
}

export interface SanctuaryGoal {
  name: string
  minItemLevel: number
  /** Quanto falta (0 = já pode entrar). */
  missing: number
}

/**
 * Próximo santuário que o item level ainda não alcança e os já alcançados.
 * Só santuários com item level mínimo.
 */
export function sanctuaryGoals(
  itemLevel: number | null,
  sanctuaries: ReadonlyArray<{ name: string; minItemLevel: number | null }>,
): { next: SanctuaryGoal | null; reached: SanctuaryGoal[] } {
  const level = itemLevel ?? 0
  const goals = sanctuaries
    .filter((s): s is { name: string; minItemLevel: number } => s.minItemLevel != null)
    .map((s) => ({ name: s.name, minItemLevel: s.minItemLevel, missing: Math.max(0, s.minItemLevel - level) }))
    .sort((a, b) => a.minItemLevel - b.minItemLevel)
  return { next: goals.find((g) => g.missing > 0) ?? null, reached: goals.filter((g) => g.missing === 0) }
}
