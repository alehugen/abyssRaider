import { DAY_MINUTES, normalizeWindows, type TimeWindow } from './Availability'

/**
 * Grade semanal da disponibilidade (estilo Teams): 7 dias x 48 células de 30 min.
 * A grade é só a forma de editar; o que se guarda continua sendo TimeWindow.
 *
 * Célula = `${weekday}:${slot}`, com slot 0 = 00:00-00:30 ... 47 = 23:30-00:00.
 */
export const SLOT_MINUTES = 30
export const SLOTS_PER_DAY = DAY_MINUTES / SLOT_MINUTES

export type CellKey = `${number}:${number}`

export const cellKey = (weekday: number, slot: number): CellKey => `${weekday}:${slot}`

export function parseCell(key: string): { weekday: number; slot: number } {
  const [d, s] = key.split(':').map(Number)
  return { weekday: d!, slot: s! }
}

/** Faixas salvas -> células marcadas (faixa parcial marca a célula inteira). */
export function windowsToCells(windows: readonly TimeWindow[]): Set<CellKey> {
  const cells = new Set<CellKey>()
  for (const w of normalizeWindows(windows)) {
    const first = Math.floor(w.start / SLOT_MINUTES)
    const last = Math.ceil(w.end / SLOT_MINUTES) - 1
    for (let s = first; s <= last; s++) cells.add(cellKey(w.weekday, s))
  }
  return cells
}

/** Células marcadas -> faixas (células seguidas no mesmo dia viram uma faixa). */
export function cellsToWindows(cells: ReadonlySet<string>): TimeWindow[] {
  const windows: TimeWindow[] = []
  for (let weekday = 0; weekday < 7; weekday++) {
    let start: number | null = null
    for (let slot = 0; slot <= SLOTS_PER_DAY; slot++) {
      const on = slot < SLOTS_PER_DAY && cells.has(cellKey(weekday, slot))
      if (on && start == null) start = slot
      if (!on && start != null) {
        windows.push({ weekday, start: start * SLOT_MINUTES, end: slot * SLOT_MINUTES })
        start = null
      }
    }
  }
  return windows
}

/** Retângulo entre duas células (arrastar pode atravessar dias e horas). */
export function cellsBetween(a: { weekday: number; slot: number }, b: { weekday: number; slot: number }): CellKey[] {
  const keys: CellKey[] = []
  for (let d = Math.min(a.weekday, b.weekday); d <= Math.max(a.weekday, b.weekday); d++) {
    for (let s = Math.min(a.slot, b.slot); s <= Math.max(a.slot, b.slot); s++) keys.push(cellKey(d, s))
  }
  return keys
}

/** Aplica pintar/apagar num retângulo, partindo do estado de antes do arrasto. */
export function paint(
  before: ReadonlySet<CellKey>,
  from: { weekday: number; slot: number },
  to: { weekday: number; slot: number },
  mode: 'paint' | 'erase',
): Set<CellKey> {
  const next = new Set(before)
  for (const k of cellsBetween(from, to)) {
    if (mode === 'paint') next.add(k)
    else next.delete(k)
  }
  return next
}

/** Copia as horas de um dia para outros (substitui o que havia neles). */
export function copyDay(cells: ReadonlySet<CellKey>, from: number, to: readonly number[]): Set<CellKey> {
  const next = new Set(cells)
  for (const day of to) {
    if (day === from) continue
    for (let s = 0; s < SLOTS_PER_DAY; s++) {
      if (cells.has(cellKey(from, s))) next.add(cellKey(day, s))
      else next.delete(cellKey(day, s))
    }
  }
  return next
}

export function clearDay(cells: ReadonlySet<CellKey>, day: number): Set<CellKey> {
  return new Set([...cells].filter((k) => parseCell(k).weekday !== day))
}

/** "19:00" para o slot 38. */
export function slotLabel(slot: number): string {
  const m = slot * SLOT_MINUTES
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
