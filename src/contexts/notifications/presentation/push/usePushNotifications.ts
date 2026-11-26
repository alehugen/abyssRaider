import { getContainer } from '@/app/container'
import { DomainError } from '@/shared/domain/DomainError'
import { currentLocale } from '@/shared/i18n'
import { usePwaInstall } from '@/shared/presentation/pwa/usePwaInstall'
import { createPushController, type BrowserPushSubscription, type PushBrowser, type PushController } from './pushController'

/** Push do navegador de verdade (service worker do app em src/sw/sw.ts). */
export function createBrowserPush(win: Window & typeof globalThis = window): PushBrowser {
  const nav = win.navigator
  const supported = 'serviceWorker' in nav && 'PushManager' in win && 'Notification' in win

  async function registration(): Promise<ServiceWorkerRegistration> {
    const r = await nav.serviceWorker.getRegistration()
    if (r) return r
    // Logo na primeira abertura o service worker pode ainda estar instalando. Em `npm run dev` ele não existe.
    return Promise.race([
      nav.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new DomainError('push.no_service_worker', 'O app ainda está carregando. Tente de novo em instantes.')), 5000),
      ),
    ])
  }

  const wrap = (s: PushSubscription): BrowserPushSubscription => {
    const keys = s.toJSON().keys ?? {}
    return { endpoint: s.endpoint, p256dh: keys.p256dh ?? '', auth: keys.auth ?? '', unsubscribe: () => s.unsubscribe() }
  }

  return {
    supported,
    permission: () => win.Notification.permission,
    requestPermission: () => win.Notification.requestPermission(),
    getSubscription: async () => {
      // Sem service worker registrado não há inscrição: responde na hora (sair da conta não espera).
      const r = await nav.serviceWorker.getRegistration()
      const s = r ? await r.pushManager.getSubscription() : null
      return s ? wrap(s) : null
    },
    subscribe: async (applicationServerKey) =>
      wrap(await (await registration()).pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })),
  }
}

/** O que o aparelho informa, para diagnosticar quando o pedido de permissão não aparece. */
export async function pushDiagnostics(win: Window & typeof globalThis = window): Promise<Array<[string, string]>> {
  const nav = win.navigator
  const yes = (v: boolean) => (v ? 'sim' : 'não')
  const rows: Array<[string, string]> = [
    ['Instalado (tela cheia)', yes(!!win.matchMedia?.('(display-mode: standalone)').matches || (nav as { standalone?: boolean }).standalone === true)],
    ['Service worker', yes('serviceWorker' in nav)],
    ['PushManager', yes('PushManager' in win)],
    ['Notification', yes('Notification' in win)],
    ['Permissão', 'Notification' in win ? win.Notification.permission : '-'],
    ['Chave VAPID no build', yes(!!import.meta.env.VITE_VAPID_PUBLIC_KEY)],
  ]
  if ('serviceWorker' in nav) {
    try {
      const r = await nav.serviceWorker.getRegistration()
      rows.push(['Service worker registrado', r ? (r.active ? 'ativo' : 'instalando') : 'não'])
      const s = r && 'pushManager' in r ? await r.pushManager.getSubscription() : null
      rows.push(['Inscrição no navegador', yes(!!s)])
    } catch (e) {
      rows.push(['Service worker registrado', `erro: ${String(e)}`])
    }
  }
  rows.push(['Navegador', nav.userAgent])
  return rows
}

let instance: PushController | null = null

/** Notificações push neste aparelho (singleton). */
export function usePushNotifications(): PushController {
  if (!instance) {
    const install = usePwaInstall()
    instance = createPushController({
      repo: getContainer().pushDeviceRepository,
      browser: createBrowserPush(),
      vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY || undefined,
      locale: currentLocale,
      needsInstall: () => install.needsManualSteps.value,
    })
  }
  return instance
}
