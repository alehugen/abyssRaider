import { APP_TIME_ZONE, TZ_LABEL } from '@/shared/lib/brasilia'
import { formatSlots, nextOccurrences, type RaidRoutine } from '../domain/RaidRoutine'

/** "quinta e sábado às 21:00, toda semana (horário de Brasília)" */
export function formatRoutine(routine: RaidRoutine): string {
  return `${formatSlots(routine.slots)}, toda semana (${TZ_LABEL})`
}

const nextFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** Próxima raid da rotina, ex.: "qui., 13 de nov., 21:00" (horário de Brasília). */
export function formatNextRaid(routine: RaidRoutine): string | null {
  const next = nextOccurrences(routine, 1)[0]
  return next ? nextFormat.format(next) : null
}
