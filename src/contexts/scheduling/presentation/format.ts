/** Formatação de horários, sempre no horário de Brasília (ver shared/lib/brasilia). */
import { APP_TIME_ZONE, brasiliaDayKey, TZ_LABEL } from '@/shared/lib/brasilia'

const opts = { timeZone: APP_TIME_ZONE } as const
const time = new Intl.DateTimeFormat('pt-BR', { ...opts, hour: '2-digit', minute: '2-digit' })
const weekday = new Intl.DateTimeFormat('pt-BR', { ...opts, weekday: 'short' })
const month = new Intl.DateTimeFormat('pt-BR', { ...opts, month: 'short' })
const dayOfMonth = new Intl.DateTimeFormat('pt-BR', { ...opts, day: 'numeric' })
const fullDay = new Intl.DateTimeFormat('pt-BR', { ...opts, weekday: 'long', day: 'numeric', month: 'long' })
const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

const clean = (s: string) => s.replace('.', '')

export { TZ_LABEL }
export const formatTime = (d: Date) => time.format(d)
export const formatWeekday = (d: Date) => clean(weekday.format(d))
export const formatMonth = (d: Date) => clean(month.format(d))
export const formatDayOfMonth = (d: Date) => dayOfMonth.format(d)
export const formatFullDay = (d: Date) => fullDay.format(d)

/** "agora", "em 3 horas", "amanhã", "em 5 dias", "começou há 1 hora" (dias contados em Brasília). */
export function formatRelative(d: Date, now = new Date()): string {
  const minutes = Math.round((d.getTime() - now.getTime()) / 60_000)
  if (Math.abs(minutes) < 5) return 'agora'
  if (minutes < 0) return `começou ${relative.format(Math.round(minutes / 60) || -1, 'hour')}`
  if (minutes < 60) return relative.format(minutes, 'minute')
  if (minutes < 24 * 60 && brasiliaDayKey(d) === brasiliaDayKey(now)) {
    return relative.format(Math.round(minutes / 60), 'hour')
  }
  const days = Math.round(
    (Date.parse(`${brasiliaDayKey(d)}T00:00Z`) - Date.parse(`${brasiliaDayKey(now)}T00:00Z`)) / 86_400_000,
  )
  return relative.format(days, 'day')
}
