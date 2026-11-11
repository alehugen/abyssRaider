import { describe, expect, it } from 'vitest'
import { rowsToWindows } from './Availability'
import { cellKey, cellsToWindows, clearDay, copyDay, paint, slotLabel, windowsToCells } from './availabilityGrid'

const h = (hh: number, mm = 0) => hh * 60 + mm
const QUA = 3
const QUI = 4
const SEX = 5
const SAB = 6

describe('grade de disponibilidade', () => {
  it('ida e volta entre faixas e células, inclusive passando da meia-noite', () => {
    const windows = rowsToWindows([
      { days: [QUA, QUI], start: h(19), end: h(22) },
      { days: [SEX], start: h(23), end: h(1) },
    ])
    const cells = windowsToCells(windows)
    expect(cells.has(cellKey(QUA, 38))).toBe(true) // 19:00
    expect(cells.has(cellKey(QUA, 44))).toBe(false) // 22:00
    expect(cells.has(cellKey(SEX, 47))).toBe(true) // 23:30
    expect(cells.has(cellKey(SAB, 1))).toBe(true) // 00:30
    expect(cellsToWindows(cells)).toEqual(windows)
  })

  it('faixa fora da meia hora arredonda para fora (19:15-20:10 marca 19:00-20:30)', () => {
    const cells = windowsToCells([{ weekday: QUA, start: h(19, 15), end: h(20, 10) }])
    expect(cellsToWindows(cells)).toEqual([{ weekday: QUA, start: h(19), end: h(20, 30) }])
  })

  it('arrastar pinta e apaga um retângulo entre dias e horas', () => {
    const painted = paint(new Set(), { weekday: QUA, slot: 38 }, { weekday: QUI, slot: 43 }, 'paint')
    expect(cellsToWindows(painted)).toEqual([
      { weekday: QUA, start: h(19), end: h(22) },
      { weekday: QUI, start: h(19), end: h(22) },
    ])
    const erased = paint(painted, { weekday: QUI, slot: 42 }, { weekday: QUI, slot: 43 }, 'erase')
    expect(cellsToWindows(erased)).toContainEqual({ weekday: QUI, start: h(19), end: h(21) })
  })

  it('copia e limpa um dia', () => {
    const qua = windowsToCells([{ weekday: QUA, start: h(19), end: h(22) }])
    const copied = copyDay(qua, QUA, [1, 2, QUA, QUI, SEX])
    expect(cellsToWindows(copied).map((w) => w.weekday)).toEqual([1, 2, QUA, QUI, SEX])
    expect(cellsToWindows(clearDay(copied, QUA)).map((w) => w.weekday)).toEqual([1, 2, QUI, SEX])
  })

  it('rótulos de horário', () => {
    expect(slotLabel(0)).toBe('00:00')
    expect(slotLabel(39)).toBe('19:30')
  })
})
