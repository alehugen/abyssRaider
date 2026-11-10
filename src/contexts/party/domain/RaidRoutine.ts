import { zonedToInstant } from '@/shared/lib/brasilia'

/**
 * Rotina de raid da party: dias da semana e horário de início.
 * O app usa sempre o horário de Brasília (APP_TIME_ZONE); o fuso fica salvo para o caso de mudar.
 */
export interface RaidRoutine {
  /** 0 = domingo ... 6 = sábado, ordenados e sem repetição. */
  days: number[]
  /** "HH:MM" (24 h) */
  time: string
  /** Fuso IANA de quem criou, ex.: "America/Sao_Paulo". */
  timeZone: string
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

/** Próximas `count` raids da rotina a partir de `from`. */
export function nextOccurrences(routine: RaidRoutine, count = 1, from = new Date()): Date[] {
  if (!routine.days.length || !isValidTime(routine.time)) return []
  const [h, min] = routine.time.split(':').map(Number) as [number, number]
  const today = wallDate(from, routine.timeZone)
  const result: Date[] = []
  for (let i = 0; i < 7 * (count + 1) && result.length < count; i++) {
    const day = new Date(Date.UTC(today.y, today.m, today.d + i))
    if (!routine.days.includes(day.getUTCDay())) continue
    const instant = zonedToInstant(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, min, routine.timeZone)
    if (instant.getTime() > from.getTime()) result.push(instant)
  }
  return result
}

/** "quinta e sábado", "segunda, quarta e sexta", "todos os dias". */
export function formatDays(days: readonly number[]): string {
  if (days.length === 7) return 'todos os dias'
  const names = normalizeDays(days).map((d) => WEEKDAYS[d]!.long)
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`
}
