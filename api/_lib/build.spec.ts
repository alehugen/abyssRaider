import { describe, expect, it } from 'vitest'
import { normalizeBuild, normalizeItem } from './aion.js'

// Recortes de respostas reais de /api/character/info e /equipment (lang=pt-BR).
const info = {
  profile: { characterId: 'abc=', characterName: 'Lu' },
  stat: {
    statList: [
      { type: 'STR', name: 'Poder', value: 31, statSecondList: ['Aumento de Ataque +3.1%'] },
      { type: 'INT', name: 'Inteligência', value: 0, statSecondList: null },
      { type: 'Justice', name: 'Justiça [Nezekan]', value: 41, statSecondList: ['Aumento de Defesa +4.1%'] },
      { type: 'ItemLevel', name: '아이템레벨', value: 2810, statSecondList: [] },
    ],
  },
  title: {
    titleList: [
      { equipCategory: 'Defense', name: 'Iluminador', grade: 'Legend', equipStatList: [{ desc: 'Defesa +200' }] },
    ],
  },
  daevanion: {
    boardList: [
      { id: 51, name: 'Nezekan', icon: 'https://x/a.png', open: 1, openNodeCount: 63, totalNodeCount: 88 },
      { id: 52, name: 'Zikel', icon: 'https://x/b.png', open: 0, openNodeCount: 0, totalNodeCount: 88 },
    ],
  },
}

const equipment = {
  equipment: {
    equipmentList: [
      { slotPos: 5, slotPosName: 'Torso', id: 210130053, name: 'Peitoral de Nuakum', grade: 'Unique', icon: 'https://x/t.png', enchantLevel: 15, exceedLevel: 0 },
      { slotPos: 1, slotPosName: 'MainHand', id: 110130051, name: 'Espadão', grade: 'Unique', icon: 'https://x/w.png', enchantLevel: 15, exceedLevel: 3 },
    ],
  },
  petwing: {
    pet: { name: 'Manduri', icon: 'https://x/p.png', level: 3 },
    wing: { name: 'Asas', icon: 'https://x/wi.png', grade: 'Rare', enchantLevel: 0 },
    wingSkin: { name: null },
  },
  skill: {
    skillList: [
      { id: 1, name: 'Golpe', icon: 'https://x/s.png', category: 'Active', skillLevel: 14, equip: 1, acquired: 1 },
      { id: 2, name: 'Comando', icon: 'https://x/d.png', category: 'Dp', skillLevel: 0, equip: 0, acquired: 0 },
      { id: 3, name: 'Foco', icon: 'https://x/f.png', category: 'Passive', skillLevel: 5, equip: 0, acquired: 1 },
    ],
  },
}

describe('normalizeBuild', () => {
  const build = normalizeBuild(info, equipment)!

  it('separa item level, atributos base e divinos', () => {
    expect(build.itemLevel).toBe(2810)
    expect(build.stats.map((s) => [s.type, s.kind])).toEqual([
      ['STR', 'base'],
      ['INT', 'base'],
      ['Justice', 'divine'],
    ])
    expect(build.stats[1]!.effects).toEqual([])
  })

  it('ordena o equipamento pelo slot e mantém encantamento', () => {
    expect(build.equipment.map((g) => g.slotName)).toEqual(['MainHand', 'Torso'])
    expect(build.equipment[0]).toMatchObject({ itemId: 110130051, enchantLevel: 15, exceedLevel: 3 })
  })

  it('só traz skills aprendidas e tabuleiros abertos', () => {
    expect(build.skills.map((s) => [s.name, s.category, s.equipped])).toEqual([
      ['Golpe', 'active', true],
      ['Foco', 'passive', false],
    ])
    expect(build.daevanion.map((b) => b.name)).toEqual(['Nezekan'])
    expect(build.titles[0]).toEqual({ category: 'Defense', name: 'Iluminador', grade: 'Legend', effects: ['Defesa +200'] })
    expect(build.pet).toEqual({ name: 'Manduri', icon: 'https://x/p.png', level: 3 })
    expect(build.wing?.grade).toBe('Rare')
  })

  it('devolve null sem perfil', () => {
    expect(normalizeBuild({}, equipment)).toBeNull()
  })
})

describe('normalizeItem', () => {
  it('lê atributos, pedras de mana e ignora bônus zerado', () => {
    const item = normalizeItem({
      id: 110130051,
      name: 'Espadão',
      grade: 'Unique',
      gradeName: 'Único',
      categoryName: 'Espadão',
      level: 86,
      enchantLevel: 15,
      maxEnchantLevel: 15,
      maxExceedEnchantLevel: 5,
      enchantable: true,
      surpassable: true,
      magicStoneSlotCount: 4,
      mainStats: [
        { name: 'Ataque', value: '508', extra: '146' },
        { name: 'Precisão', value: '100', extra: '0' },
      ],
      subStats: [{ name: 'Velocidade de Combate', value: '12.3%' }],
      subSkills: [{ name: 'Golpe Aéreo', icon: 'https://x/k.png', level: 1 }],
      magicStoneStat: [{ name: 'Defesa', value: '+100', grade: 'Unique' }],
    })!
    expect(item.mainStats).toEqual([
      { name: 'Ataque', value: '508', extra: '146' },
      { name: 'Precisão', value: '100', extra: null },
    ])
    expect(item.gradeName).toBe('Único')
    expect([item.maxExceedLevel, item.enchantable, item.surpassable, item.stoneSlots]).toEqual([5, true, true, 4])
    expect(normalizeItem({ id: 1, maxEnchantLevel: 10 })).toMatchObject({ maxExceedLevel: null, enchantable: true, surpassable: false, stoneSlots: 0 })
    expect(item.manastones).toEqual([{ name: 'Defesa', value: '+100', grade: 'Unique' }])
    expect(item.skills[0]!.name).toBe('Golpe Aéreo')
  })
})
