export type ShareResult = 'shared' | 'copied' | 'prompted' | 'cancelled'

export interface ShareEnv {
  share?: (data: { url: string; title?: string }) => Promise<void>
  writeText?: (text: string) => Promise<void>
  prompt?: (message: string, value: string) => void
  /** Tela de toque: o compartilhar do sistema é o natural (no computador, copiar). */
  touch?: boolean
  promptLabel?: string
}

/** Navegador de verdade (promptLabel vem de quem chama: o texto é traduzido). */
export function browserShareEnv(promptLabel?: string): ShareEnv {
  if (typeof navigator === 'undefined') return {}
  return {
    share: navigator.share ? (d) => navigator.share(d) : undefined,
    writeText: navigator.clipboard ? (t) => navigator.clipboard.writeText(t) : undefined,
    prompt: (m, v) => void window.prompt(m, v),
    touch: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    promptLabel,
  }
}

/**
 * Compartilha um link como um app: no celular, o menu do sistema; no computador, copia.
 * Sem área de transferência, mostra o link para copiar à mão.
 */
export async function shareLink(link: { url: string; title?: string }, env: ShareEnv = browserShareEnv()): Promise<ShareResult> {
  if (env.touch && env.share) {
    try {
      await env.share({ url: link.url, title: link.title })
      return 'shared'
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelled'
      // Outro erro (ex.: sem permissão): cai para copiar.
    }
  }
  try {
    if (!env.writeText) throw new Error('sem área de transferência')
    await env.writeText(link.url)
    return 'copied'
  } catch {
    env.prompt?.(env.promptLabel ?? '', link.url)
    return 'prompted'
  }
}
