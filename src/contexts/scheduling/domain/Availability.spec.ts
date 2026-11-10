import { describe, expect, it } from 'vitest'
import {
  bestSlots,
  formatRow,
  isFree,
  nextSlotStart,
  routineFit,
  rowsToWindows,
  windowsToRows,
  type TimeWindow,
} from './Availability'

const h = (hh: number, mm = 0) => hh * 60 + mm
const QUA = 3
const QUI = 4
const SEX = 5
const SAB = 6

describe('Availability', () => {
  it('sugere a interseção: 19-22 e 17-21 dá 19-21 com os dois', () => {
    const a = rowsToWindows([{ days: [QUA, QUI], start: h(19), end: h(22) }])
    const b = rowsToWindows([{ days: [QUA], start: h(17), end: h(21) }])
    const [best] = bestSlots([a, b])
    expect(best).toEqual({ weekday: QUA, start: h(19), end: h(21), people: [0, 1] })
  })

  it('prefere mais pessoas e, no empate, o trecho mais longo; ignora trechos curtos', () => {
    const a: TimeWindow[] = [{ weekday: QUA, start: h(19), end: h(22) }, { weekday: SAB, start: h(14), end: h(18) }]
    const b: TimeWindow[] = [{ weekday: QUA, start: h(20), end: h(21) }, { weekday: SAB, start: h(15), end: h(18) }]
    const c: TimeWindow[] = [{ weekday: QUA, start: h(20), end: h(20, 30) }]
    // Quarta 20:00-20:30 tem os 3, mas só 30 min: fica de fora. O trecho curto
    // do C não quebra a faixa de A e B (20:00-21:00).
    const slots = bestSlots([a, b, c], { limit: 3 })
    expect(slots).toEqual([
      { weekday: SAB, start: h(15), end: h(18), people: [0, 1] },
      { weekday: QUA, start: h(20), end: h(21), people: [0, 1] },
      { weekday: SAB, start: h(14), end: h(18), people: [0] },
    ])
  })

  it('faixa que passa da meia-noite vira duas janelas e volta para uma linha', () => {
    const rows = [{ days: [SEX], start: h(23), end: h(1) }]
    const windows = rowsToWindows(rows)
    expect(windows).toEqual([
      { weekday: SEX, start: h(23), end: 1440 },
      { weekday: SAB, start: 0, end: h(1) },
    ])
    expect(windowsToRows(windows)).toEqual(rows)
    expect(isFree(windows, SEX, h(23, 30))).toBe(true)
    expect(isFree(windows, SEX, h(0, 30))).toBe(false)
  })

  it('agrupa dias com o mesmo horário e formata', () => {
    const rows = windowsToRows(rowsToWindows([
      { days: [QUI, QUA], start: h(19), end: h(22) },
      { days: [SAB], start: h(14), end: 0 },
    ]))
    expect(rows.map(formatRow)).toEqual(['qua e qui, 19:00 às 22:00', 'sáb, 14:00 às 00:00'])
  })

  it('acha a próxima data do horário sugerido nesta semana', () => {
    // terça 10/11/2026, 20:00 em Brasília (23:00 UTC)
    const now = new Date('2026-11-10T23:00:00Z')
    expect(nextSlotStart({ weekday: QUA, start: h(19) }, now).toISOString()).toBe('2026-11-11T22:00:00.000Z')
    // terça 19:00 já passou: vai para a próxima terça
    expect(nextSlotStart({ weekday: 2, start: h(19) }, now).toISOString()).toBe('2026-11-17T22:00:00.000Z')
    // terça 21:00 ainda vem hoje
    expect(nextSlotStart({ weekday: 2, start: h(21) }, now).toISOString()).toBe('2026-11-11T00:00:00.000Z')
  })

  it('confere a rotina da party com a disponibilidade', () => {
    const w = rowsToWindows([{ days: [QUA, QUI], start: h(19), end: h(22) }])
    expect(routineFit(w, { days: [QUA, QUI, SEX], time: '21:00' })).toEqual({ free: [QUA, QUI], busy: [SEX] })
    // 21:30 só deixa 30 min livres
    expect(routineFit(w, { days: [QUA], time: '21:30' })).toEqual({ free: [], busy: [QUA] })
  })
})
