import { t } from '@/shared/i18n'
import { dateFormat } from '@/shared/i18n/format'
import { APP_TIME_ZONE, tzLabel } from '@/shared/lib/brasilia'
import { formatSlots, nextOccurrences, type RaidRoutine } from '../domain/RaidRoutine'

/** "quinta e sábado às 21:00, toda semana (horário de Brasília)" */
export function formatRoutine(routine: RaidRoutine): string {
  return t('party.routine.weekly', { slots: formatSlots(routine.slots), tz: tzLabel() })
}

/** Próxima raid da rotina, ex.: "qui., 13 de nov., 21:00" (horário de Brasília). */
export function formatNextRaid(routine: RaidRoutine): string | null {
  const next = nextOccurrences(routine, 1)[0]
  return next
    ? dateFormat({
        timeZone: APP_TIME_ZONE,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
      }).format(next)
    : null
}
