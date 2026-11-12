import { zonedToInstant } from '@/shared/lib/brasilia'

/**
 * Recorrência da party: em quais dias da semana ela raida e a que horas (cada dia
 * com seu horário). Com recorrência, o app cria sozinho as raids da semana e a
 * party não é finalizada automaticamente.
 * O app usa sempre o horário de Brasília (APP_TIME_ZONE); o fuso fica salvo para o caso de mudar.
 */
export interface RaidRoutine {
  /** Um horário por dia, ordenado por dia (0 = domingo ... 6 = sábado). */
  slots: RoutineSlot[]
  /** Fuso IANA, ex.: "America/Sao_Paulo". */
  timeZone: string
}

export interface RoutineSlot {
  day: number
  /** "HH:MM" (24 h) */
  time: string
}

export const WEEKDAYS = [
  { value: 0, short: 'Dom', long: 'domingo' },
  { value: 1, short: 'Seg', long: 'segunda' },
  { value: 2, short: 'Ter', long: 'terça' },
  { value: 3, short: 'Qua', long: 'quarta' },
  { value: 4, short: 'Qui', long: 'quinta' },
  { value: 5, short: 'Sex', long: 'sexta' },
  { value: 6, short: 'Sáb', long: 'sábado' },
] as const

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function normalizeDays(days: readonly number[]): number[] {
  return [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
}

export { zonedToInstant }

/** Data "de parede" (ano, mês, dia) de um instante num fuso. */
function wallDate(instant: Date, timeZone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { y: get('year'), m: get('month') - 1, d: get('day') }
}

/** Um horário por dia, ordenado; descarta dias e horários inválidos (o último horário de um dia vence). */
export function normalizeSlots(slots: readonly RoutineSlot[]): RoutineSlot[] {
  const byDay = new Map<number, string>()
  for (const s of slots) if (Number.isInteger(s.day) && s.day >= 0 && s.day <= 6 && isValidTime(s.time)) byDay.set(s.day, s.time)
  return [...byDay].sort(([a], [b]) => a - b).map(([day, time]) => ({ day, time }))
}

export function routineDays(routine: RaidRoutine): number[] {
  return routine.slots.map((s) => s.day)
}

/** Próximas `count` raids da rotina a partir de `from`. */
export function nextOccurrences(routine: RaidRoutine, count = 1, from = new Date()): Date[] {
  const slots = normalizeSlots(routine.slots)
  if (!slots.length) return []
  const today = wallDate(from, routine.timeZone)
  const result: Date[] = []
  for (let i = 0; i < 7 * (count + 1) && result.length < count; i++) {
    const day = new Date(Date.UTC(today.y, today.m, today.d + i))
    const slot = slots.find((s) => s.day === day.getUTCDay())
    if (!slot) continue
    const [h, min] = slot.time.split(':').map(Number) as [number, number]
    const instant = zonedToInstant(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, min, routine.timeZone)
    if (instant.getTime() > from.getTime()) result.push(instant)
  }
  return result
}

/** "quinta e sábado", "segunda, quarta e sexta", "todos os dias". */
export function formatDays(days: readonly number[]): string {
  if (days.length === 7) return 'todos os dias'
  const names = normalizeDays(days).map((d) => WEEKDAYS[d]!.long)
  return joinPt(names)
}

/** "quinta e sábado às 21:00", "quinta às 21:00 e sábado às 15:00". */
export function formatSlots(slots: readonly RoutineSlot[]): string {
  const groups = new Map<string, number[]>()
  for (const s of normalizeSlots(slots)) groups.set(s.time, [...(groups.get(s.time) ?? []), s.day])
  return joinPt([...groups].map(([time, days]) => `${formatDays(days)} às ${time}`))
}

function joinPt(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}`
}
