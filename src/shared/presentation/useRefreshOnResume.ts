import { getCurrentScope, onScopeDispose } from 'vue'

/** Voltar para o app costuma disparar visibilitychange e focus juntos: conta uma vez. */
const DEBOUNCE_MS = 2000

/**
 * Chama `fn` quando o app volta para a tela, ganha foco ou a rede volta. No celular
 * (app instalado) o `focus` muitas vezes não dispara ao voltar; o `visibilitychange` sim.
 * Devolve a função para parar.
 */
export function onAppResume(fn: () => void): () => void {
  let last = 0
  const handler = () => {
    if (document.visibilityState === 'hidden') return
    const now = Date.now()
    if (now - last < DEBOUNCE_MS) return
    last = now
    fn()
  }
  document.addEventListener('visibilitychange', handler)
  window.addEventListener('focus', handler)
  window.addEventListener('online', handler)
  return () => {
    document.removeEventListener('visibilitychange', handler)
    window.removeEventListener('focus', handler)
    window.removeEventListener('online', handler)
  }
}

/** Em componentes e composables: para sozinho quando o componente sai da tela. */
export function useRefreshOnResume(fn: () => void): void {
  const stop = onAppResume(fn)
  if (getCurrentScope()) onScopeDispose(stop)
}
