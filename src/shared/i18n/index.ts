/**
 * Idiomas do app: português (padrão), inglês e espanhol.
 *
 * Uso (componentes, stores e domínio):
 *   import { t } from '@/shared/i18n'
 *   t('party.view.title')            // no <script> e no <template> (imports do <script setup> valem no template)
 *   t('party.members', n)            // plural
 *
 * `t` é reativo: lido num template ou computed, atualiza ao trocar o idioma. Por isso
 * não guarde texto traduzido em constante de módulo (`const LABEL = t(...)`): use uma
 * função (`const label = () => t(...)`) ou computed.
 *
 * Os textos ficam em `src/contexts/<contexto>/i18n.ts` (ver messages.ts).
 */
import { createI18n } from 'vue-i18n'
import { messages } from './messages'

export const LOCALES = [
  { id: 'pt-BR', label: 'Português', short: 'PT', intl: 'pt-BR' },
  { id: 'en', label: 'English', short: 'EN', intl: 'en-US' },
  { id: 'es', label: 'Español', short: 'ES', intl: 'es-419' },
] as const
export type Locale = (typeof LOCALES)[number]['id']

const STORAGE_KEY = 'abyssraider.locale'
export const DEFAULT_LOCALE: Locale = 'pt-BR'

const isLocale = (v: unknown): v is Locale => LOCALES.some((l) => l.id === v)

/** Escolha salva > idioma do navegador (en*, es*) > português. */
export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLocale(saved)) return saved
  } catch {
    /* sem storage (aba anônima etc.) */
  }
  const langs = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])
  for (const lang of langs) {
    const l = lang.toLowerCase()
    if (l.startsWith('pt')) return 'pt-BR'
    if (l.startsWith('en')) return 'en'
    if (l.startsWith('es')) return 'es'
  }
  return DEFAULT_LOCALE
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages,
  missingWarn: import.meta.env.DEV,
  fallbackWarn: false,
})

/** Tradução global (funciona fora de componentes; ver o topo do arquivo). */
export const t = i18n.global.t

export function currentLocale(): Locale {
  return i18n.global.locale.value as Locale
}

/** Locale para Intl (datas, números). */
export function intlLocale(): string {
  return LOCALES.find((l) => l.id === currentLocale())?.intl ?? 'pt-BR'
}

export function setLocale(locale: Locale): void {
  i18n.global.locale.value = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* sem storage */
  }
  applyHtmlLang()
}

export function applyHtmlLang(): void {
  if (typeof document !== 'undefined') document.documentElement.lang = currentLocale()
}
