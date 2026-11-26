import { readonly, ref, type Ref } from 'vue'
import { t } from '@/shared/i18n'
import { errorMessage } from '@/shared/lib/errorMessage'
import { DEFAULT_PUSH_PREFERENCES, type PushDeviceRepository, type PushPreferences } from '../../domain/PushDevice'

/**
 * loading      ainda conferindo
 * unsupported  navegador sem push
 * needsInstall iPhone/iPad: só funciona com o app na Tela de Início
 * unconfigured build sem a chave VAPID
 * denied       a pessoa bloqueou as notificações no navegador
 * off / on     neste aparelho, nesta conta
 */
export type PushStatus = 'loading' | 'unsupported' | 'needsInstall' | 'unconfigured' | 'denied' | 'off' | 'on'

export interface BrowserPushSubscription {
  endpoint: string
  p256dh: string
  auth: string
  unsubscribe(): Promise<boolean>
}

/** O que o controlador usa do navegador (injetado para testar). */
export interface PushBrowser {
  supported: boolean
  permission(): NotificationPermission
  requestPermission(): Promise<NotificationPermission>
  getSubscription(): Promise<BrowserPushSubscription | null>
  subscribe(applicationServerKey: Uint8Array<ArrayBuffer>): Promise<BrowserPushSubscription>
}

export interface PushEnvironment {
  repo: PushDeviceRepository
  browser: PushBrowser
  vapidKey: string | undefined
  locale: () => string
  /** iPhone/iPad fora da Tela de Início. */
  needsInstall: () => boolean
}

export interface PushController {
  status: Readonly<Ref<PushStatus>>
  preferences: Readonly<Ref<PushPreferences>>
  busy: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  refresh(): Promise<void>
  enable(): Promise<void>
  disable(): Promise<void>
  setPreferences(p: PushPreferences): Promise<void>
  /** Ao sair da conta: este aparelho para de receber as notificações dela. */
  forgetDevice(): Promise<void>
}

/** Chave pública VAPID (base64url) no formato que o pushManager.subscribe pede. */
export function urlBase64ToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export function createPushController(env: PushEnvironment): PushController {
  const { repo, browser } = env
  const status = ref<PushStatus>('loading')
  const preferences = ref<PushPreferences>({ ...DEFAULT_PUSH_PREFERENCES })
  const busy = ref(false)
  const error = ref<string | null>(null)

  /** Estados em que não há o que ligar ou desligar. */
  function blocked(): PushStatus | null {
    if (!browser.supported) return env.needsInstall() ? 'needsInstall' : 'unsupported'
    if (!env.vapidKey) return 'unconfigured'
    if (browser.permission() === 'denied') return 'denied'
    return null
  }

  async function run(task: () => Promise<void>) {
    busy.value = true
    error.value = null
    try {
      await task()
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      busy.value = false
    }
  }

  const save = (sub: BrowserPushSubscription, prefs: PushPreferences) =>
    repo.save({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, locale: env.locale(), preferences: prefs })

  async function refresh() {
    const b = blocked()
    if (b) return void (status.value = b)
    await run(async () => {
      const sub = await browser.getSubscription()
      const row = sub ? await repo.find(sub.endpoint) : null
      if (!sub || !row) return void (status.value = 'off')
      preferences.value = row.preferences
      status.value = 'on'
      if (row.locale !== env.locale()) await save(sub, row.preferences)
    })
    if (status.value === 'loading') status.value = 'off'
  }

  async function enable() {
    const b = blocked()
    if (b) return void (status.value = b)
    await run(async () => {
      // Pedido direto no toque (sem await antes): o iPhone só mostra o pedido dentro do gesto.
      const permission = browser.permission() === 'granted' ? 'granted' : await browser.requestPermission()
      if (permission === 'denied') return void (status.value = 'denied')
      if (permission !== 'granted') {
        // O pedido não apareceu ou foi fechado sem resposta: nada de ficar calado.
        status.value = 'off'
        error.value = t('notifications.push.notAsked')
        return
      }
      const sub = (await browser.getSubscription()) ?? (await browser.subscribe(urlBase64ToUint8Array(env.vapidKey!)))
      await save(sub, preferences.value)
      status.value = 'on'
    })
    if (status.value === 'loading') status.value = 'off'
  }

  async function disable() {
    await run(async () => {
      const sub = await browser.getSubscription()
      if (sub) {
        await repo.remove(sub.endpoint)
        await sub.unsubscribe()
      }
      status.value = 'off'
    })
  }

  async function setPreferences(next: PushPreferences) {
    const previous = preferences.value
    preferences.value = next
    await run(async () => {
      const sub = await browser.getSubscription()
      if (sub) await save(sub, next)
    })
    if (error.value) preferences.value = previous
  }

  async function forgetDevice() {
    if (!browser.supported || browser.permission() !== 'granted') return
    try {
      const sub = await browser.getSubscription()
      if (sub) {
        await repo.remove(sub.endpoint).catch(() => {})
        await sub.unsubscribe()
      }
    } catch {
      /* sem rede: o banco apaga quando o serviço de push recusar */
    }
    if (status.value === 'on') status.value = 'off'
  }

  return {
    status: readonly(status),
    preferences: readonly(preferences) as Readonly<Ref<PushPreferences>>,
    busy: readonly(busy),
    error: readonly(error),
    refresh,
    enable,
    disable,
    setPreferences,
    forgetDevice,
  }
}
