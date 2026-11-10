import { describe, expect, it } from 'vitest'
import { formatCombatPower } from './formatCombatPower'

describe('formatCombatPower', () => {
  it('abrevia como o jogo', () => {
    expect(formatCombatPower(950)).toBe('950')
    expect(formatCombatPower(18_207)).toBe('18K')
    expect(formatCombatPower(184_309)).toBe('184K')
    expect(formatCombatPower(188_999)).toBe('188K')
    expect(formatCombatPower(1_000_000)).toBe('1M')
    expect(formatCombatPower(1_250_000)).toBe('1,2M')
  })
})
