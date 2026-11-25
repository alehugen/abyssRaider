/**
 * Push no service worker (src/sw/sw.ts). Tipos só estruturais para testar fora
 * do service worker. O texto chega pronto de /api/push/send (api/_lib/push.ts).
 */

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

const str = (v: unknown) => (typeof v === 'string' ? v : '')
/** Só caminhos do próprio app ("/parties/1"), nunca outro site. */
const safePath = (v: unknown) => {
  const s = str(v)
  return s.startsWith('/') && !s.startsWith('//') ? s : '/'
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

export async function showPush(
  registration: { showNotification(title: string, options: Record<string, unknown>): Promise<void> },
  data: PushDataLike | null | undefined,
): Promise<void> {
  const p = parsePushPayload(data)
  await registration.showNotification(p.title, {
    body: p.body,
    ...(p.tag ? { tag: p.tag, renotify: true } : {}),
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    data: { url: p.url },
  })
}

interface WindowClientLike {
  url: string
  focus(): Promise<unknown>
  navigate?(url: string): Promise<unknown>
}

interface ClientsLike {
  matchAll(options: { type: 'window'; includeUncontrolled: boolean }): Promise<readonly WindowClientLike[]>
  openWindow(url: string): Promise<unknown>
}

/** Toque na notificação: reaproveita a aba do app, se houver, senão abre uma. */
export async function openFromNotification(clients: ClientsLike, data: unknown, origin: string): Promise<void> {
  const path = safePath(typeof data === 'object' && data !== null ? (data as Record<string, unknown>).url : null)
  const target = new URL(path, origin).href
  const tabs = await clients.matchAll({ type: 'window', includeUncontrolled: true })
  const tab = tabs.find((c) => c.url.startsWith(origin))
  if (tab?.navigate) {
    try {
      await tab.navigate(target)
      await tab.focus()
      return
    } catch {
      /* aba de outro service worker: abre outra */
    }
  }
  await clients.openWindow(target)
}
