import { readonly, ref, type Ref } from 'vue'

/** Assinatura de `registerSW` de `virtual:pwa-register` (injetada para testar). */
export type RegisterSW = (options: {
  immediate?: boolean
  onNeedRefresh?: () => void
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void
}) => (reloadPage?: boolean) => Promise<void>

export interface UpdateEnvironment {
  register: RegisterSW
  document?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> | null
  setInterval?: (fn: () => void, ms: number) => unknown
  clearInterval?: (id: unknown) => void
}

export interface UpdateController {
  /** Há versão nova esperando: mostrar o aviso "Nova versão disponível". */
  needRefresh: Readonly<Ref<boolean>>
  /** Ativa a versão nova e recarrega (só quando a pessoa pede). */
  update: () => Promise<void>
  /** Esconde o aviso; a versão nova entra na próxima abertura do app. */
  dismiss: () => void
  dispose: () => void
}

const HOUR = 60 * 60 * 1000

export function createUpdateController(env: UpdateEnvironment): UpdateController {
  const { register, document: doc } = env
  const every = env.setInterval ?? ((fn, ms) => setInterval(fn, ms))
  const stop = env.clearInterval ?? ((id) => clearInterval(id as ReturnType<typeof setInterval>))
  const needRefresh = ref(false)
  let registration: ServiceWorkerRegistration | undefined
  let timer: unknown = null

  const check = () => {
    if (!registration || registration.installing) return
    void registration.update().catch(() => {}) // sem rede: tenta de novo na próxima
  }
  const onVisible = () => {
    if (doc?.visibilityState === 'visible') check()
  }

  const updateSW = register({
    immediate: true, // procura versão nova ao abrir o app
    onNeedRefresh: () => (needRefresh.value = true),
    onRegisteredSW: (_url, r) => {
      registration = r
      timer = every(check, HOUR)
      doc?.addEventListener('visibilitychange', onVisible)
    },
  })

  return {
    needRefresh: readonly(needRefresh),
    update: () => updateSW(true),
    dismiss: () => (needRefresh.value = false),
    dispose: () => {
      if (timer != null) stop(timer)
      doc?.removeEventListener('visibilitychange', onVisible)
    },
  }
}

let instance: UpdateController | null = null

/** Atualização do app a cada build (singleton). `registerSW` vem do vite-plugin-pwa. */
export function usePwaUpdate(register?: RegisterSW): UpdateController | null {
  if (!instance && register) instance = createUpdateController({ register, document: typeof document === 'undefined' ? null : document })
  return instance
}
