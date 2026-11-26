/// <reference lib="webworker" />
/**
 * Service worker do app (vite-plugin-pwa, modo injectManifest).
 *  - precache da interface (abre offline) e aviso de versão nova (SKIP_WAITING só quando a pessoa pede);
 *  - dados (Supabase e /api) nunca passam pelo cache; as fontes vêm no precache (@fontsource);
 *  - push: mostra a notificação e abre a página certa ao tocar.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { openFromNotification, showPush } from './pushHandlers'

declare let self: ServiceWorkerGlobalScope

// "Atualizar" no aviso de nova versão (usePwaUpdate -> updateSW(true)).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Rotas do app abrem o index.html do cache; /api é dado e vai sempre à rede.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }))

self.addEventListener('push', (event) => {
  const nav = self.navigator as WorkerNavigator & { setAppBadge?: () => Promise<void> }
  event.waitUntil(
    showPush(
      { registration: self.registration, clients: self.clients, setAppBadge: nav.setAppBadge?.bind(nav) },
      event.data,
    ),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(openFromNotification(self.clients, event.notification.data, self.location.origin))
})
