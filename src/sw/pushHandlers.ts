/**
 * Push no service worker (src/sw/sw.ts). Tipos só estruturais para testar fora
 * do service worker. O texto chega pronto de /api/push/send (api/_lib/push.ts).
 */

/** Mensagens do service worker para as abas abertas (ouvidas em src/shared/presentation/pwa/swMessages.ts). */
export const SW_MESSAGE = {
  /** Chegou um push: o sino confere na hora. */
  push: 'abyssraider:push',
  /** Tocou numa notificação com o app aberto: navega pelo router, sem recarregar. */
  open: 'abyssraider:open',
} as const

export interface PushPayload {
  title: string
  body: string
  /** Caminho dentro do app. */
  url: string
  tag?: string
}

interface PushDataLike {
  json(): unknown
}

const DUMMY_ORIGIN = 'https://app.invalid'
const str = (v: unknown) => (typeof v === 'string' ? v : '')
/** Só caminhos do próprio app ("/parties/1"), nunca outro site (nem "//x" ou "/\x"). */
export function safePath(v: unknown): string {
  const s = str(v)
  if (!s.startsWith('/')) return '/'
  try {
    const u = new URL(s, DUMMY_ORIGIN)
    return u.origin === DUMMY_ORIGIN ? u.pathname + u.search + u.hash : '/'
  } catch {
    return '/'
  }
}

export function parsePushPayload(data: PushDataLike | null | undefined): PushPayload {
  let raw: unknown = null
  try {
    raw = data?.json() ?? null
  } catch {
    raw = null
  }
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return { title: str(o.title) || 'AbyssRaider', body: str(o.body), url: safePath(o.url), tag: str(o.tag) || undefined }
}

interface ShowEnv {
  registration: { showNotification(title: string, options: Record<string, unknown>): Promise<void> }
  clients: { matchAll(options?: { type: 'window'; includeUncontrolled: boolean }): Promise<ReadonlyArray<{ postMessage(m: unknown): void }>> }
  /** navigator.setAppBadge do service worker (iOS 16.4+ instalado, Chrome/Edge no computador). */
  setAppBadge?: () => Promise<void>
}

export async function showPush(env: ShowEnv, data: PushDataLike | null | undefined): Promise<void> {
  const p = parsePushPayload(data)
  await env.registration.showNotification(p.title, {
    body: p.body,
    ...(p.tag ? { tag: p.tag, renotify: true } : {}),
    icon: '/pwa-192x192.png',
    // Ícone pequeno da barra do Android: só a forma conta (branco sobre transparente).
    // Sem ele, o Android mostrava um quadrado.
    badge: '/notification-badge.png',
    data: { url: p.url },
  })
  await env.setAppBadge?.().catch(() => {})
  const tabs = await env.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const tab of tabs) tab.postMessage({ type: SW_MESSAGE.push })
}

interface WindowClientLike {
  url: string
  focused?: boolean
  visibilityState?: string
  focus(): Promise<unknown>
  postMessage(message: unknown): void
}

interface ClientsLike {
  matchAll(options: { type: 'window'; includeUncontrolled: boolean }): Promise<readonly WindowClientLike[]>
  openWindow(url: string): Promise<unknown>
}

/**
 * Toque na notificação: com o app aberto, traz a aba para a frente (antes de qualquer
 * espera: o navegador só permite foco logo após o toque) e pede para o app navegar pelo
 * router, sem recarregar. Com o app fechado, abre uma janela.
 */
export async function openFromNotification(clients: ClientsLike, data: unknown, origin: string): Promise<void> {
  const path = safePath(typeof data === 'object' && data !== null ? (data as Record<string, unknown>).url : null)
  const tabs = (await clients.matchAll({ type: 'window', includeUncontrolled: true })).filter((c) => c.url.startsWith(origin))
  const tab = tabs.find((c) => c.focused) ?? tabs.find((c) => c.visibilityState === 'visible') ?? tabs[0]
  if (tab) {
    try {
      await tab.focus()
      tab.postMessage({ type: SW_MESSAGE.open, url: path })
      return
    } catch {
      /* não deixou focar: abre outra janela */
    }
  }
  await clients.openWindow(new URL(path, origin).href)
}
