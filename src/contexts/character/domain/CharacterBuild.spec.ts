import { describe, expect, it } from 'vitest'
import { enchantLabel, groupGear, groupSkills, slotLabel, type Gear, type Skill } from './CharacterBuild'

const gear = (slotName: string, slot = 1): Gear => ({
  slot,
  slotName,
  itemId: slot,
  name: slotName,
  grade: 'Unique',
  icon: null,
  enchantLevel: 0,
  exceedLevel: 0,
})

describe('CharacterBuild', () => {
  it('agrupa o equipamento na ordem do jogo e guarda slots novos em Outros', () => {
    const groups = groupGear([gear('Ring2'), gear('Torso'), gear('MainHand'), gear('Ring1'), gear('Wings9')])
    expect(groups.map((g) => [g.id, g.items.map((i) => i.slotName)])).toEqual([
      ['weapons', ['MainHand']],
      ['armor', ['Torso']],
      ['accessories', ['Ring1', 'Ring2']],
      ['others', ['Wings9']],
    ])
  })

  it('traduz slots numerados e mantém o código dos desconhecidos', () => {
    expect(slotLabel('Earring2')).toBe('Brinco')
    expect(slotLabel('MainHand')).toBe('Arma principal')
    expect(slotLabel('Wings9')).toBe('Wings9')
  })

  it('formata encantamento como o jogo', () => {
    expect(enchantLabel({ enchantLevel: 0, exceedLevel: 0 })).toBe('')
    expect(enchantLabel({ enchantLevel: 15, exceedLevel: 0 })).toBe('+15')
    expect(enchantLabel({ enchantLevel: 15, exceedLevel: 3 })).toBe('+15 +3')
  })

  it('ordena skills: equipadas primeiro, depois nível', () => {
    const s = (id: number, category: Skill['category'], level: number, equipped: boolean): Skill => ({
      id,
      name: String(id),
      icon: null,
      category,
      level,
      equipped,
    })
    const groups = groupSkills([s(1, 'active', 20, false), s(2, 'active', 5, true), s(3, 'passive', 1, false)])
    expect(groups.map((g) => [g.category, g.skills.map((x) => x.id)])).toEqual([
      ['active', [2, 1]],
      ['passive', [3]],
    ])
  })
})
