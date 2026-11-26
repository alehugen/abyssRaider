import { safePath, SW_MESSAGE } from '@/sw/pushHandlers'

export interface ServiceWorkerHandlers {
  /** Tocou numa notificação com o app aberto: caminho do app para navegar. */
  onOpen: (path: string) => void
  /** Chegou um push com o app aberto. */
  onPush: () => void
}

/** Ouve as mensagens do service worker (src/sw/pushHandlers.ts). Devolve a função para parar. */
export function listenToServiceWorker(
  handlers: ServiceWorkerHandlers,
  container: EventTarget | null = typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : null,
): () => void {
  if (!container) return () => {}
  const onMessage = (event: Event) => {
    const data = (event as MessageEvent).data as { type?: unknown; url?: unknown } | null
    if (data?.type === SW_MESSAGE.push) handlers.onPush()
    else if (data?.type === SW_MESSAGE.open && typeof data.url === 'string') {
      const path = safePath(data.url)
      if (path === data.url) handlers.onOpen(path)
    }
  }
  container.addEventListener('message', onMessage)
  return () => container.removeEventListener('message', onMessage)
}

interface BadgeNavigator {
  setAppBadge?: (count?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/** Número de não lidas no ícone do app instalado (iOS 16.4+, Chrome/Edge). Sem suporte: nada. */
export function setAppBadge(count: number, nav: BadgeNavigator = typeof navigator === 'undefined' ? {} : navigator): void {
  const done = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.()
  void done?.catch(() => {})
}
