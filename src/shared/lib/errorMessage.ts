/**
 * Texto em português para qualquer erro mostrado ao usuário.
 *
 * Só passam direto as mensagens que sabemos estar em português: erros de regra
 * do banco (P0001), DomainError e HttpError (da nossa API). Erros conhecidos do
 * Supabase/rede são traduzidos; o resto vira uma mensagem genérica (o original
 * vai para o console, para depurar). Antes, "new row violates row-level
 * security policy..." e "Failed to fetch" chegavam em inglês na tela.
 */
const GENERIC = 'Algo deu errado. Tente de novo.'

const BY_CODE: Record<string, string> = {
  '42501': 'Você não tem permissão para fazer isso.',
  PGRST301: 'Sua sessão expirou. Entre de novo.',
  PGRST303: 'Sua sessão expirou. Entre de novo.',
  '23505': 'Isso já existe (talvez já tenha sido feito).',
  '23503': 'Algo ligado a isso foi removido. Recarregue a página.',
  '22P02': 'Link ou dado inválido.',
  '57014': 'O servidor demorou demais. Tente de novo.',
  PGRST116: 'Não encontrado. Pode ter sido removido.',
}

/** Coluna/tabela/função ausente: quase sempre migration que não foi rodada. */
const MIGRATION_CODES = new Set(['42703', '42P01', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])

const TRUSTED_ERRORS = new Set(['DomainError', 'HttpError'])

export function errorMessage(e: unknown): string {
  if (typeof e === 'string') return e
  if (!e || typeof e !== 'object') return GENERIC

  const { message, code, name } = e as { message?: unknown; code?: unknown; name?: unknown }
  const text = typeof message === 'string' ? message : ''

  if (code === 'P0001' && text) return text
  if (typeof name === 'string' && TRUSTED_ERRORS.has(name) && text) return text
  if (typeof code === 'string' && MIGRATION_CODES.has(code)) {
    return `O banco está desatualizado: rode as migrations pendentes do Supabase. (${text || code})`
  }
  if (typeof code === 'string' && BY_CODE[code]) return BY_CODE[code]

  if (/provider.*(disabled|not enabled)|unsupported provider/i.test(text)) {
    return 'O login com Discord não está habilitado no Supabase (Authentication → Providers).'
  }
  if (/row-level security|permission denied/i.test(text)) return BY_CODE['42501']!
  if (/jwt|session.*(expired|missing)|refresh token/i.test(text)) return 'Sua sessão expirou. Entre de novo.'
  if (name === 'AbortError' || name === 'TimeoutError' || /timed? ?out/i.test(text)) {
    return 'Demorou demais para responder. Tente de novo.'
  }
  if (/failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(text)) {
    return 'Sem conexão com o servidor. Confira sua internet e tente de novo.'
  }

  console.error(e)
  return GENERIC
}
