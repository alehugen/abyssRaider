import { useCharactersStore } from '@/contexts/character/presentation/useCharactersStore'
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

/** Só caminhos internos (evita redirecionar para outro site via ?next=). */
export function safeNext(next: unknown, fallback = '/parties'): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : fallback
}
