/** Datas escolhidas para agendar de uma vez: sem repetidas e em ordem. */

/** Máximo de raids criadas num agendamento (uma semana com raid todo dia). */
export const MAX_SCHEDULE_DATES = 7

const sorted = (dates: readonly Date[]) => [...dates].sort((a, b) => a.getTime() - b.getTime())

export function hasDate(dates: readonly Date[], date: Date): boolean {
  return dates.some((d) => d.getTime() === date.getTime())
}

/** Inclui a data (se ainda não estiver e houver espaço). */
export function addDate(dates: readonly Date[], date: Date): Date[] {
  if (hasDate(dates, date) || dates.length >= MAX_SCHEDULE_DATES) return [...dates]
  return sorted([...dates, date])
}

export function removeDate(dates: readonly Date[], date: Date): Date[] {
  return dates.filter((d) => d.getTime() !== date.getTime())
}

/** Marca ou desmarca (botões de sugestão). */
export function toggleDate(dates: readonly Date[], date: Date): Date[] {
  return hasDate(dates, date) ? removeDate(dates, date) : addDate(dates, date)
}
