/// <reference lib="webworker" />
/**
 * Service worker do app (vite-plugin-pwa, modo injectManifest).
 *  - precache da interface (abre offline) e aviso de versão nova (SKIP_WAITING só quando a pessoa pede);
 *  - dados (Supabase e /api) nunca passam pelo cache;
 *  - push: mostra a notificação e abre a página certa ao tocar.
 */
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'
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

// Fontes do Google: a interface continua com a tipografia certa sem rede.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
)

self.addEventListener('push', (event) => {
  event.waitUntil(showPush(self.registration, event.data))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(openFromNotification(self.clients, event.notification.data, self.location.origin))
})
