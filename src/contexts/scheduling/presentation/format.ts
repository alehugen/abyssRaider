/** Formatação de horários, sempre no horário de Brasília (ver shared/lib/brasilia), no idioma da tela. */
import { t } from '@/shared/i18n'
import { dateFormat, relativeFormat } from '@/shared/i18n/format'
import { APP_TIME_ZONE, brasiliaDayKey, tzLabel } from '@/shared/lib/brasilia'

const opts = { timeZone: APP_TIME_ZONE } as const

const clean = (s: string) => s.replace('.', '')

export { tzLabel }
export const formatTime = (d: Date) => dateFormat({ ...opts, hour: '2-digit', minute: '2-digit' }).format(d)
export const formatWeekday = (d: Date) => clean(dateFormat({ ...opts, weekday: 'short' }).format(d))
export const formatMonth = (d: Date) => clean(dateFormat({ ...opts, month: 'short' }).format(d))
export const formatDayOfMonth = (d: Date) => dateFormat({ ...opts, day: 'numeric' }).format(d)
export const formatFullDay = (d: Date) =>
  dateFormat({ ...opts, weekday: 'long', day: 'numeric', month: 'long' }).format(d)

/** "agora", "em 3 horas", "amanhã", "em 5 dias", "começou há 1 hora" (dias contados em Brasília). */
export function formatRelative(d: Date, now = new Date()): string {
  const relative = relativeFormat()
  const minutes = Math.round((d.getTime() - now.getTime()) / 60_000)
  if (Math.abs(minutes) < 5) return t('scheduling.time.now')
  if (minutes < 0) return t('scheduling.time.startedAgo', { ago: relative.format(Math.round(minutes / 60) || -1, 'hour') })
  if (minutes < 60) return relative.format(minutes, 'minute')
  if (minutes < 24 * 60 && brasiliaDayKey(d) === brasiliaDayKey(now)) {
    return relative.format(Math.round(minutes / 60), 'hour')
  }
  const days = Math.round(
    (Date.parse(`${brasiliaDayKey(d)}T00:00Z`) - Date.parse(`${brasiliaDayKey(now)}T00:00Z`)) / 86_400_000,
  )
  return relative.format(days, 'day')
}
