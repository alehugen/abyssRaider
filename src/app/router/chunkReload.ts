/**
 * Depois de um deploy novo, uma aba aberta com a versão antiga pede arquivos de
 * página (AgendaView-<hash>.js) que não existem mais e a navegação quebra.
 * Quando isso acontece, recarregamos uma vez direto no destino, já com a versão
 * nova. A trava evita recarregar em loop se o erro for outro.
 */

const RELOAD_KEY = 'abyss-raider:chunk-reload-at'
const LOOP_WINDOW_MS = 10_000

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|expected a JavaScript.*MIME type/i

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '')
  return CHUNK_ERROR.test(message)
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>

/** Recarrega em `path` (ou na página atual), no máximo uma vez a cada 10 s. Devolve se recarregou. */
export function reloadOnce(
  path?: string,
  env: { storage?: Storage | null; now?: number; navigate?: (url: string) => void } = {},
): boolean {
  const storage = env.storage === undefined ? safeSession() : env.storage
  const now = env.now ?? Date.now()
  try {
    const last = Number(storage?.getItem(RELOAD_KEY) ?? 0)
    if (now - last < LOOP_WINDOW_MS) return false
    storage?.setItem(RELOAD_KEY, String(now))
  } catch {
    // sem storage: recarrega mesmo assim (no pior caso, uma vez por clique)
  }
  const navigate = env.navigate ?? ((url: string) => window.location.assign(url))
  navigate(path ?? window.location.href)
  return true
}

function safeSession(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}
