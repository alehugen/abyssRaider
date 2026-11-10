import { WEEKDAYS } from '@/contexts/party/domain/RaidRoutine'

/**
 * Disponibilidade semanal de um jogador, sempre no horário de Brasília.
 *
 * TimeWindow é o formato guardado: uma faixa [start, end) em minutos dentro de
 * UM dia. "Sexta 23:00 às 01:00" vira sexta 1380-1440 + sábado 0-60.
 * AvailabilityRow é o formato da tela: vários dias com o mesmo horário, e o fim
 * pode ser menor que o início (passa da meia-noite).
 */
export interface TimeWindow {
  /** 0 = domingo ... 6 = sábado */
  weekday: number
  start: number
  end: number
}

export interface AvailabilityRow {
  days: number[]
  start: number
  /** Se end <= start, a faixa termina no dia seguinte. */
  end: number
}

/** Uma faixa de horário com quantas pessoas (e quais) estão livres nela. */
export interface Slot {
  weekday: number
  start: number
  end: number
  /** Índices das pessoas livres (na ordem recebida). */
  people: number[]
}

export const DAY_MINUTES = 24 * 60
/** Tempo mínimo livre para contar como "dá para fazer a raid". */
export const MIN_SESSION_MINUTES = 60

export function parseTime(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** 1140 -> "19:00"; meia-noite no fim do dia (1440) -> "00:00". */
export function formatMinutes(minutes: number): string {
  const m = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Faixa de um dia (podendo passar da meia-noite) em janelas por dia. */
export function spanToWindows(weekday: number, start: number, end: number): TimeWindow[] {
  if (start === end) return []
  if (end > start) return [{ weekday, start, end }]
  const parts: TimeWindow[] = [{ weekday, start, end: DAY_MINUTES }]
  if (end > 0) parts.push({ weekday: (weekday + 1) % 7, start: 0, end })
  return parts
}

/** Ordena e junta faixas sobrepostas ou encostadas no mesmo dia. */
export function normalizeWindows(windows: readonly TimeWindow[]): TimeWindow[] {
  const sorted = windows
    .filter((w) => w.end > w.start)
    .map((w) => ({ ...w }))
    .sort((a, b) => a.weekday - b.weekday || a.start - b.start)
  const result: TimeWindow[] = []
  for (const w of sorted) {
    const last = result.at(-1)
    if (last && last.weekday === w.weekday && w.start <= last.end) last.end = Math.max(last.end, w.end)
    else result.push(w)
  }
  return result
}

export function rowsToWindows(rows: readonly AvailabilityRow[]): TimeWindow[] {
  return normalizeWindows(rows.flatMap((r) => r.days.flatMap((d) => spanToWindows(d, r.start, r.end))))
}

/** Volta para o formato da tela: refaz as faixas que passam da meia-noite e agrupa dias com o mesmo horário. */
export function windowsToRows(windows: readonly TimeWindow[]): AvailabilityRow[] {
  const list = normalizeWindows(windows)
  const used = new Set<TimeWindow>()
  const spans: Array<{ weekday: number; start: number; end: number }> = []
  for (const w of list) {
    if (used.has(w)) continue
    used.add(w)
    const next = w.end === DAY_MINUTES && w.start > 0
      ? list.find((n) => !used.has(n) && n.weekday === (w.weekday + 1) % 7 && n.start === 0 && n.end < DAY_MINUTES)
      : undefined
    if (next) {
      used.add(next)
      spans.push({ weekday: w.weekday, start: w.start, end: next.end })
    } else {
      spans.push({ weekday: w.weekday, start: w.start, end: w.end === DAY_MINUTES ? 0 : w.end })
    }
  }
  const rows = new Map<string, AvailabilityRow>()
  for (const s of spans) {
    const key = `${s.start}-${s.end}`
    const row = rows.get(key)
    if (row) row.days.push(s.weekday)
    else rows.set(key, { days: [s.weekday], start: s.start, end: s.end })
  }
  return [...rows.values()].sort((a, b) => a.days[0]! - b.days[0]! || a.start - b.start)
}

/** "quarta e quinta, 19:00 às 22:00" */
export function formatRow(row: AvailabilityRow): string {
  const names = [...row.days].sort((a, b) => a - b).map((d) => WEEKDAYS[d]!.short.toLowerCase())
  const days = names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`
  return `${days}, ${formatMinutes(row.start)} às ${formatMinutes(row.end)}`
}

export function formatSlot(slot: Pick<Slot, 'weekday' | 'start' | 'end'>): string {
  return `${WEEKDAYS[slot.weekday]!.long}, ${formatMinutes(slot.start)} às ${formatMinutes(slot.end)}`
}

/**
 * Melhores horários em comum. Para cada dia, corta nos pontos em que alguém
 * entra ou sai e vê quem está livre em cada trecho. Para cada grupo de pessoas
 * encontrado, estende o trecho para os lados enquanto todas elas continuam
 * livres: assim um trecho curto com mais gente não "quebra" a faixa maior.
 * Ordena por mais pessoas e, no empate, pela faixa mais longa. Ignora faixas
 * menores que `minMinutes`.
 *
 * Ex.: A qua 19-22 e B qua 17-21 -> qua 19:00-21:00 com A e B.
 */
export function bestSlots(
  people: ReadonlyArray<readonly TimeWindow[]>,
  { minMinutes = MIN_SESSION_MINUTES, limit = 3, minPeople = 1 } = {},
): Slot[] {
  const perPerson = people.map((ws) => normalizeWindows(ws))
  const found = new Map<string, Slot>()

  for (let weekday = 0; weekday < 7; weekday++) {
    const points = new Set<number>()
    perPerson.forEach((ws) =>
      ws.filter((w) => w.weekday === weekday).forEach((w) => points.add(w.start).add(w.end)),
    )
    const cuts = [...points].sort((a, b) => a - b)
    const segments = cuts.slice(0, -1).map((start, i) => {
      const end = cuts[i + 1]!
      const who = perPerson.flatMap((ws, idx) =>
        ws.some((w) => w.weekday === weekday && w.start <= start && w.end >= end) ? [idx] : [],
      )
      return { start, end, who: new Set(who) }
    })

    segments.forEach((seg, i) => {
      if (!seg.who.size) return
      const covers = (j: number) => {
        const s = segments[j]
        return !!s && [...seg.who].every((p) => s.who.has(p))
      }
      let first = i
      let last = i
      while (covers(first - 1) && segments[first - 1]!.end === segments[first]!.start) first--
      while (covers(last + 1) && segments[last + 1]!.start === segments[last]!.end) last++
      const slot: Slot = {
        weekday,
        start: segments[first]!.start,
        end: segments[last]!.end,
        people: [...seg.who].sort((a, b) => a - b),
      }
      found.set(`${weekday}:${slot.start}:${slot.end}:${slot.people.join(',')}`, slot)
    })
  }

  return [...found.values()]
    .filter((s) => s.people.length >= minPeople && s.end - s.start >= minMinutes)
    .sort(
      (a, b) =>
        b.people.length - a.people.length ||
        b.end - b.start - (a.end - a.start) ||
        a.weekday - b.weekday ||
        a.start - b.start,
    )
    .slice(0, limit)
}

/** Está livre de `start` até `start + minutes` nesse dia (pode atravessar a meia-noite)? */
export function isFree(windows: readonly TimeWindow[], weekday: number, start: number, minutes = MIN_SESSION_MINUTES): boolean {
  const needed = spanToWindows(weekday, start, (start + minutes) % DAY_MINUTES)
  const list = normalizeWindows(windows)
  return needed.every((n) => list.some((w) => w.weekday === n.weekday && w.start <= n.start && w.end >= n.end))
}

/** Dias da rotina (dias + horário de início) em que a pessoa está livre. */
export function routineFit(
  windows: readonly TimeWindow[],
  routine: { days: readonly number[]; time: string },
): { free: number[]; busy: number[] } {
  const start = parseTime(routine.time)
  const free: number[] = []
  const busy: number[] = []
  for (const d of routine.days) (start != null && isFree(windows, d, start) ? free : busy).push(d)
  return { free, busy }
}
