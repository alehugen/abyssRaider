/**
 * Textos de um contexto nos três idiomas. O pt-BR é a fonte: en e es precisam ter
 * exatamente as mesmas chaves (o TypeScript reclama se faltar ou sobrar alguma).
 *
 * Sintaxe do vue-i18n nos textos:
 *   - parâmetros: 'Olá, {name}'  ->  t('ns.key', { name })
 *   - plural:     'nenhum membro | 1 membro | {n} membros'  ->  t('ns.key', n)
 *   - caracteres especiais ({ } @ $ |) vão entre aspas no formato {'@'}.
 */
export type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> }

export interface ContextMessages<T> {
  'pt-BR': T
  en: Shape<T>
  es: Shape<T>
}

export function defineMessages<const T extends Record<string, unknown>>(
  ptBR: T,
  en: Shape<T>,
  es: Shape<T>,
): ContextMessages<T> {
  return { 'pt-BR': ptBR, en, es }
}
