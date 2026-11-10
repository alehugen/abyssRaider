/** Formatação de horários sempre no fuso de quem está vendo. */

const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
const fullDay = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

const clean = (s: string) => s.replace('.', '')

export const formatTime = (d: Date) => time.format(d)
export const formatWeekday = (d: Date) => clean(weekday.format(d))
export const formatMonth = (d: Date) => clean(month.format(d))
export const formatFullDay = (d: Date) => fullDay.format(d)

/** "agora", "em 3 horas", "amanhã", "em 5 dias", "começou há 1 hora". */
export function formatRelative(d: Date, now = new Date()): string {
  const minutes = Math.round((d.getTime() - now.getTime()) / 60_000)
  if (Math.abs(minutes) < 5) return 'agora'
  if (minutes < 0) return `começou ${relative.format(Math.round(minutes / 60) || -1, 'hour')}`
  if (minutes < 60) return relative.format(minutes, 'minute')
  if (minutes < 24 * 60) return relative.format(Math.round(minutes / 60), 'hour')
  const days = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  )
  return relative.format(days, 'day')
}

/** Nome legível do fuso do navegador, ex.: "horário de Brasília (America/Sao_Paulo)". */
export function localTimeZoneLabel(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const name = new Intl.DateTimeFormat('pt-BR', { timeZoneName: 'long' })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')?.value
  return name ? `${name} (${zone})` : zone
}

/** Valor para <input type="datetime-local"> a partir de uma data local. */
export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
