import { useCharactersStore } from '@/contexts/character/presentation/useCharactersStore'
import { safeNext as safeNextPath } from '@/shared/lib/safeNext'
import { useAvailabilityStore } from '@/contexts/scheduling/presentation/useAvailabilityStore'

/**
 * Primeiros passos obrigatórios: 1) vincular um personagem, 2) informar a
 * disponibilidade. Sem os dois, as parties não conseguem sugerir horário nem
 * achar o jogador.
 */
export type OnboardingStep = 'character' | 'availability'

/**
 * O passo que falta, ou null se a conta já está pronta. Se não der para
 * carregar (rede, Supabase fora), não bloqueia: devolve null.
 */
export async function pendingOnboardingStep(): Promise<OnboardingStep | null> {
  const characters = useCharactersStore()
  const availability = useAvailabilityStore()
  await Promise.all([characters.loaded ? null : characters.load(), availability.load()])

  if (characters.loaded && !characters.items.length) return 'character'
  if (availability.loaded && !availability.windows.length) return 'availability'
  return null
}

/** Destino ao concluir os primeiros passos (padrão: parties). */
export function safeNext(next: unknown, fallback = '/parties'): string {
  return safeNextPath(next, fallback)
}
