/**
 * Texto, no idioma da tela, para qualquer erro mostrado ao usuário.
 *
 * Só passam as mensagens que são nossas: erros de regra do banco (P0001),
 * DomainError e HttpError (da nossa API). Elas vêm em português e são traduzidas
 * por serverMessages. Erros conhecidos do Supabase/rede viram textos de
 * common.errors; o resto vira uma mensagem genérica (o original vai para o
 * console, para depurar), nunca "new row violates row-level security policy...".
 */
import { t } from '@/shared/i18n'
import { translateServerMessage } from '@/shared/i18n/serverMessages'

const BY_CODE: Record<string, string> = {
  '42501': 'forbidden',
  PGRST301: 'sessionExpired',
  PGRST303: 'sessionExpired',
  '23505': 'duplicate',
  '23503': 'foreignKey',
  '22P02': 'invalidData',
  '57014': 'serverTimeout',
  PGRST116: 'notFound',
}

const err = (key: string, params?: Record<string, unknown>) => t(`common.errors.${key}`, params ?? {})

/** Coluna/tabela/função ausente: quase sempre migration que não foi rodada. */
const MIGRATION_CODES = new Set(['42703', '42P01', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])

const TRUSTED_ERRORS = new Set(['DomainError', 'HttpError'])

export function errorMessage(e: unknown): string {
  if (typeof e === 'string') return translateServerMessage(e)
  if (!e || typeof e !== 'object') return err('generic')

  const { message, code, name } = e as { message?: unknown; code?: unknown; name?: unknown }
  const text = typeof message === 'string' ? message : ''

  // Mensagens nossas (banco, API, domínio): vêm em português e são traduzidas aqui.
  if (code === 'P0001' && text) return translateServerMessage(text)
  if (typeof name === 'string' && TRUSTED_ERRORS.has(name) && text) {
    if (code === 'app.not_configured') return err('notConfigured')
    return translateServerMessage(text)
  }
  if (typeof code === 'string' && MIGRATION_CODES.has(code)) return err('migration', { detail: text || code })
  if (typeof code === 'string' && BY_CODE[code]) return err(BY_CODE[code])

  if (/provider.*(disabled|not enabled)|unsupported provider/i.test(text)) return err('discordProvider')
  if (/row-level security|permission denied/i.test(text)) return err('forbidden')
  if (/jwt|session.*(expired|missing)|refresh token/i.test(text)) return err('sessionExpired')
  if (name === 'AbortError' || name === 'TimeoutError' || /timed? ?out/i.test(text)) return err('timeout')
  if (/failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(text)) return err('offline')

  console.error(e)
  return err('generic')
}
