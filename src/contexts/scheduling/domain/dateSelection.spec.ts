import { describe, expect, it } from 'vitest'
import { addDate, MAX_SCHEDULE_DATES, removeDate, toggleDate } from './dateSelection'

const d = (iso: string) => new Date(iso)
const iso = (dates: Date[]) => dates.map((x) => x.toISOString())

describe('dateSelection', () => {
  it('mantém em ordem e sem repetidas', () => {
    let dates = addDate([], d('2026-11-12T22:00:00Z'))
    dates = addDate(dates, d('2026-11-11T22:00:00Z'))
    dates = addDate(dates, d('2026-11-12T22:00:00Z'))
    expect(iso(dates)).toEqual(['2026-11-11T22:00:00.000Z', '2026-11-12T22:00:00.000Z'])
  })

  it('marca e desmarca', () => {
    const qua = d('2026-11-11T22:00:00Z')
    const qui = d('2026-11-12T22:00:00Z')
    let dates = toggleDate([qua], qui)
    expect(dates).toHaveLength(2)
    dates = toggleDate(dates, new Date(qua.getTime())) // outra instância, mesmo instante
    expect(iso(dates)).toEqual([qui.toISOString()])
    expect(removeDate(dates, qui)).toEqual([])
  })

  it('respeita o limite', () => {
    const many = Array.from({ length: MAX_SCHEDULE_DATES }, (_, i) => new Date(Date.UTC(2026, 10, 11 + i, 22)))
    expect(addDate(many, d('2026-12-01T22:00:00Z'))).toHaveLength(MAX_SCHEDULE_DATES)
  })
})
