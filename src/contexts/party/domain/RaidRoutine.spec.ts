import { describe, expect, it } from 'vitest'
import { formatDays, isValidTime, nextOccurrences, normalizeDays, zonedToInstant } from './RaidRoutine'

describe('RaidRoutine', () => {
  it('converte horário de parede de um fuso para UTC', () => {
    // Brasília é UTC-3 (sem horário de verão desde 2019)
    expect(zonedToInstant(2026, 10, 13, 21, 0, 'America/Sao_Paulo').toISOString()).toBe('2026-11-14T00:00:00.000Z')
    expect(zonedToInstant(2026, 10, 13, 21, 0, 'UTC').toISOString()).toBe('2026-11-13T21:00:00.000Z')
  })

  it('acha as próximas raids da rotina, pulando as que já passaram', () => {
    const routine = { days: [4, 6], time: '21:00', timeZone: 'America/Sao_Paulo' }
    // quinta 12/11/2026 às 20:00 em Brasília (23:00 UTC)
    const from = new Date('2026-11-12T23:00:00Z')
    expect(nextOccurrences(routine, 3, from).map((d) => d.toISOString())).toEqual([
      '2026-11-13T00:00:00.000Z', // qui 12, 21:00
      '2026-11-15T00:00:00.000Z', // sáb 14, 21:00
      '2026-11-20T00:00:00.000Z', // qui 19, 21:00
    ])
    // já passou das 21:00 de quinta: a próxima é sábado
    expect(nextOccurrences(routine, 1, new Date('2026-11-13T01:00:00Z'))[0]!.toISOString()).toBe(
      '2026-11-15T00:00:00.000Z',
    )
  })

  it('valida e formata', () => {
    expect(isValidTime('21:00')).toBe(true)
    expect(isValidTime('24:00')).toBe(false)
    expect(normalizeDays([6, 4, 4, 9])).toEqual([4, 6])
    expect(formatDays([4, 6])).toBe('quinta e sábado')
    expect(formatDays([1, 3, 5])).toBe('segunda, quarta e sexta')
    expect(formatDays([0, 1, 2, 3, 4, 5, 6])).toBe('todos os dias')
  })
})
