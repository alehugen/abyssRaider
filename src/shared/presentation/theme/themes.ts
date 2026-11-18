import { t } from '@/shared/i18n'

export type ColorScheme = 'light' | 'dark'

export interface ThemeDefinition {
  id: string
  /** Nome da facção (igual em todos os idiomas). */
  label: string
  /** Traduzida a cada leitura (getter), para acompanhar o idioma. */
  readonly description: string
  scheme: ColorScheme
  /** Cor de amostra exibida no seletor (não depende do tema ativo). */
  swatch: string
}

/**
 * Temas do app, inspirados nas facções de Aion 2.
 * As cores ficam em src/app/styles/themes.css, em blocos `[data-theme='<id>']`.
 */
export const THEMES = [
  {
    id: 'elyos',
    label: 'Elyos',
    get description() {
      return t('app.theme.elyos')
    },
    scheme: 'light',
    swatch: 'oklch(0.75 0.14 80)',
  },
  {
    id: 'asmodian',
    label: 'Asmodian',
    get description() {
      return t('app.theme.asmodian')
    },
    scheme: 'dark',
    swatch: 'oklch(0.62 0.21 305)',
  },
  {
    id: 'abyss',
    label: 'Abyss',
    get description() {
      return t('app.theme.abyss')
    },
    scheme: 'dark',
    swatch: 'oklch(0.74 0.13 195)',
  },
] as const satisfies readonly ThemeDefinition[]

export type ThemeId = (typeof THEMES)[number]['id']
export type ThemePreference = ThemeId | 'system'

/** Tema usado quando a preferência é "system". */
export const SYSTEM_THEME: Record<ColorScheme, ThemeId> = {
  light: 'elyos',
  dark: 'asmodian',
}

export function getTheme(id: ThemeId): ThemeDefinition {
  return THEMES.find((t) => t.id === id)!
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || THEMES.some((t) => t.id === value)
}
