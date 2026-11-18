import { t } from '@/shared/i18n'
import type { Character } from '@/contexts/character/domain/Character'

/** Santuário: conteúdo de raid do Aion 2 (ex.: Abyssal Forge: Ludra). */
export interface Sanctuary {
  /** slug estável, ex.: "ludra" */
  id: string
  name: string
  /** Item level mínimo para entrar; null = sem requisito. */
  minItemLevel: number | null
  /** Tamanho do grupo (Ludra: 10, em duas parties de 5). */
  groupSize: number
  /** Arte de fundo (opcional), usada no topo da página da party. */
  imageUrl?: string | null
}

export type Eligibility = { ok: true } | { ok: false; reason: string }

export function eligibility(character: Pick<Character, 'itemLevel'>, sanctuary: Sanctuary): Eligibility {
  if (sanctuary.minItemLevel == null) return { ok: true }
  if (character.itemLevel == null) {
    return { ok: false, reason: t('party.eligibility.refreshCharacter') }
  }
  if (character.itemLevel < sanctuary.minItemLevel) {
    return {
      ok: false,
      reason: t('party.eligibility.itemLevel', {
        min: sanctuary.minItemLevel,
        missing: sanctuary.minItemLevel - character.itemLevel,
      }),
    }
  }
  return { ok: true }
}
