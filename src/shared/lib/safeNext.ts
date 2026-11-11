/**
 * Destino depois de login/primeiros passos (?next=). Só caminhos internos:
 * barra dupla ou invertida ("//site", "/\site") viraria outro domínio
 * (open redirect).
 */
export function safeNext(next: unknown, fallback = '/'): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')
    ? next
    : fallback
}
