/**
 * Texto legível para qualquer erro. Os erros do Supabase (PostgrestError) são
 * objetos comuns com `message`/`code`, não instâncias de Error: String(e) virava
 * "[object Object]".
 */
export function errorMessage(e: unknown): string {
  if (typeof e === 'string') return e
  if (e && typeof e === 'object') {
    const { message, code } = e as { message?: unknown; code?: unknown }
    // Coluna/tabela/função ausente: quase sempre migration que não foi rodada.
    if (code === '42703' || code === '42P01' || code === 'PGRST202' || code === 'PGRST204') {
      return `O banco está desatualizado: rode as migrations pendentes do Supabase. (${String(message ?? code)})`
    }
    if (typeof message === 'string' && message) return message
  }
  return 'Algo deu errado. Tente de novo.'
}
