import { describe, expect, it } from 'vitest'
import type { CharacterBuild, Gear, GearDetail } from './CharacterBuild'
import { EXPECTED_SLOTS, sanctuaryGoals, strengthPath } from './strengthPath'

const gear = (slotName: string, enchantLevel = 15, exceedLevel = 0, grade = 'Unique'): Gear => ({
  slot: EXPECTED_SLOTS.indexOf(slotName as never) + 1,
  slotName,
  itemId: 1,
  name: `Peça ${slotName}`,
  grade,
  icon: null,
  enchantLevel,
  exceedLevel,
})

const detail = (over: Partial<GearDetail> = {}): GearDetail => ({
  name: 'x',
  grade: 'Unique',
  gradeName: 'Único',
  icon: null,
  category: '',
  level: 86,
  enchantLevel: 15,
  maxEnchantLevel: 15,
  maxExceedLevel: 5,
  enchantable: true,
  surpassable: false,
  stoneSlots: 0,
  mainStats: [],
  subStats: [],
  skills: [],
  manastones: [],
  ...over,
})

const build = (equipment: Gear[], daevanion: CharacterBuild['daevanion'] = []): CharacterBuild => ({
  itemLevel: 3000,
  stats: [],
  daevanion,
  titles: [],
  equipment,
  pet: null,
  wing: null,
  skills: [],
})

/** Todos os slots, completos: nenhum passo. */
const full = () => EXPECTED_SLOTS.map((s) => gear(s))
const fullDetails = () => new Map(EXPECTED_SLOTS.map((s) => [s, detail()] as [string, GearDetail]))

describe('strengthPath', () => {
  it('personagem completo e no máximo: nenhum passo', () => {
    expect(strengthPath(build(full()), fullDetails())).toEqual([])
  })

  it('aponta espaço vazio, encantar, superar e pedras faltando', () => {
    const equipment = full().filter((g) => g.slotName !== 'Ring2')
    equipment[equipment.findIndex((g) => g.slotName === 'Boots')] = gear('Boots', 11)
    equipment[equipment.findIndex((g) => g.slotName === 'MainHand')] = gear('MainHand', 15, 3)
    const details = fullDetails()
    details.set('MainHand', detail({ surpassable: true }))
    details.set('Torso', detail({ stoneSlots: 4, manastones: [{ name: 'PV', value: '+100', grade: 'Legend' }] }))

    const steps = strengthPath(build(equipment), details)
    const byId = new Map(steps.map((s) => [s.id, s]))
    expect(byId.get('missing:Ring2')).toMatchObject({ title: 'Equipar anel', impact: 'high' })
    expect(byId.get('enchant:Boots')).toMatchObject({
      title: 'Encantar Peça Boots de +11 para +15',
      progress: { current: 11, max: 15 },
    })
    expect(byId.get('exceed:MainHand')).toMatchObject({
      title: 'Superar Peça MainHand: +15 +3 para +15 +4',
      progress: { current: 3, max: 5 },
    })
    expect(byId.get('stones:Torso')).toMatchObject({ title: 'Colocar 3 pedras de mana em Peça Torso' })
    // espaço vazio vem antes de tudo
    expect(steps[0]!.id).toBe('missing:Ring2')
  })

  it('peça bem abaixo do nível das outras: trocar, sem sugerir encantar ela', () => {
    const equipment = full()
    equipment[equipment.findIndex((g) => g.slotName === 'Bracelet1')] = gear('Bracelet1', 10, 0, 'Legend')
    const details = fullDetails()
    details.set('Bracelet1', detail({ level: 43, maxEnchantLevel: 15, stoneSlots: 3 }))
    details.set('Bracelet2', detail({ level: 51 }))

    const ids = strengthPath(build(equipment), details).map((s) => s.id)
    expect(ids).toContain('outdated:Bracelet1')
    expect(ids).not.toContain('enchant:Bracelet1')
    expect(ids).not.toContain('stones:Bracelet1')
  })

  it('anéis iguais nos dois slots viram um passo só', () => {
    const equipment = full().map((g) => (g.slotName.startsWith('Ring') ? { ...gear(g.slotName, 12), name: 'Anel de Kromede' } : g))
    const steps = strengthPath(build(equipment), fullDetails())
    expect(steps.map((s) => s.title)).toEqual(['Encantar Anel de Kromede de +12 para +15 (2 peças)'])
  })

  it('Daevanion: o tabuleiro mais fechado vem primeiro; sem detalhe, só as regras da build', () => {
    const steps = strengthPath(
      build(full(), [
        { id: 1, name: 'Nezekan', icon: null, openNodes: 74, totalNodes: 88 },
        { id: 2, name: 'Azphel', icon: null, openNodes: 31, totalNodes: 152 },
        { id: 3, name: 'Ariel', icon: null, openNodes: 152, totalNodes: 152 },
      ]),
      new Map(),
    )
    expect(steps.map((s) => s.id)).toEqual(['daevanion:2', 'daevanion:1'])
    expect(steps[0]!.reason).toBe('31 de 152 nós abertos (faltam 121).')
  })
})

describe('sanctuaryGoals', () => {
  const list = [
    { name: 'Ludra', minItemLevel: 2800 },
    { name: 'Muspel', minItemLevel: 4500 },
    { name: 'Sem requisito', minItemLevel: null },
  ]
  it('próximo santuário e quanto falta', () => {
    expect(sanctuaryGoals(3104, list)).toEqual({
      next: { name: 'Muspel', minItemLevel: 4500, missing: 1396 },
      reached: [{ name: 'Ludra', minItemLevel: 2800, missing: 0 }],
    })
    expect(sanctuaryGoals(2700, list).next).toMatchObject({ name: 'Ludra', missing: 100 })
    expect(sanctuaryGoals(5000, list).next).toBeNull()
  })
})
