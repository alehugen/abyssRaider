import { numberFormat } from '@/shared/i18n/format'

/**
 * CP abreviado como no jogo: 184.309 -> "184K", 1.250.000 -> "1,2M".
 * Arredonda para baixo para nunca mostrar mais do que o personagem tem.
 */
export function formatCombatPower(value: number): string {
  if (value >= 1_000_000) {
    const millions = Math.floor(value / 100_000) / 10
    return `${numberFormat({ maximumFractionDigits: 1 }).format(millions)}M`
  }
  if (value >= 1_000) return `${Math.floor(value / 1_000)}K`
  return String(value)
}

/** Valor completo para tooltip / leitor de tela: "184.309" (no idioma atual). */
export function formatCombatPowerFull(value: number): string {
  return numberFormat().format(value)
}
