/**
 * Intl no idioma atual. Os formatadores ficam em cache por idioma + opções; como
 * `intlLocale()` é reativo, quem chama dentro de template/computed atualiza ao
 * trocar o idioma.
 */
import { intlLocale } from './index'

const cache = new Map<string, unknown>()

function cached<T>(kind: string, options: object, make: (locale: string) => T): T {
  const locale = intlLocale()
  const key = `${kind}|${locale}|${JSON.stringify(options)}`
  let f = cache.get(key) as T | undefined
  if (!f) {
    f = make(locale)
    cache.set(key, f)
  }
  return f
}

export const dateFormat = (options: Intl.DateTimeFormatOptions) =>
  cached('date', options, (l) => new Intl.DateTimeFormat(l, options))

export const numberFormat = (options: Intl.NumberFormatOptions = {}) =>
  cached('number', options, (l) => new Intl.NumberFormat(l, options))

export const relativeFormat = (options: Intl.RelativeTimeFormatOptions = { numeric: 'auto' }) =>
  cached('relative', options, (l) => new Intl.RelativeTimeFormat(l, options))

export const listFormat = (options: Intl.ListFormatOptions = { style: 'long', type: 'conjunction' }) =>
  cached('list', options, (l) => new Intl.ListFormat(l, options))
