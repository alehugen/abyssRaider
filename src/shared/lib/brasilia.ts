/**
 * O app inteiro usa o horário de Brasília como referência: horários são digitados,
 * guardados (rotina) e exibidos nele, sempre com o rótulo explícito, porque há
 * jogadores em outros fusos do Brasil e de fora.
 * No banco os instantes continuam em UTC (timestamptz).
 */
export const APP_TIME_ZONE = 'America/Sao_Paulo'
export const TZ_LABEL = 'horário de Brasília'

export interface WallClock {
  y: number
  /** 0 = janeiro */
  m: number
  d: number
  h: number
  min: number
  /** 0 = domingo */
  weekday: number
}

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
})
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Data e hora "de parede" em Brasília para um instante. */
export function toBrasilia(instant: Date): WallClock {
  const parts = partsFormat.formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    y: Number(get('year')),
    m: Number(get('month')) - 1,
    d: Number(get('day')),
    h: Number(get('hour')),
    min: Number(get('minute')),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
  }
}

/** Diferença (ms) entre o relógio de um fuso e o UTC num instante. */
function zoneOffset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(instant / 1000) * 1000
}

/** Instante UTC de uma data/hora "de parede" num fuso (padrão: Brasília). */
export function zonedToInstant(y: number, m: number, d: number, h: number, min: number, timeZone = APP_TIME_ZONE): Date {
  const guess = Date.UTC(y, m, d, h, min)
  let instant = guess - zoneOffset(guess, timeZone)
  instant = guess - zoneOffset(instant, timeZone) // segunda passada acerta viradas de horário de verão
  return new Date(instant)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Valor para <input type="datetime-local">, em Brasília. */
export function toBrasiliaInputValue(instant: Date): string {
  const w = toBrasilia(instant)
  return `${w.y}-${pad(w.m + 1)}-${pad(w.d)}T${pad(w.h)}:${pad(w.min)}`
}

/** Lê "AAAA-MM-DDTHH:MM" como horário de Brasília. */
export function fromBrasiliaInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!match) return null
  const [, y, mo, d, h, min] = match.map(Number) as [number, number, number, number, number, number]
  return zonedToInstant(y, mo - 1, d, h, min)
}

/** Chave do dia em Brasília (para agrupar e comparar dias). */
export function brasiliaDayKey(instant: Date): string {
  const w = toBrasilia(instant)
  return `${w.y}-${pad(w.m + 1)}-${pad(w.d)}`
}
