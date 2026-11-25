import { readonly, ref, type Ref } from 'vue'

type EventTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>

export interface OnlineEnvironment {
  navigator?: { onLine: boolean } | null
  target?: EventTarget | null
}

export interface OnlineState {
  online: Readonly<Ref<boolean>>
  dispose: () => void
}

/** Estado da conexão (eventos online/offline do navegador). */
export function createOnlineState(env: OnlineEnvironment = {}): OnlineState {
  const { navigator, target } = env
  const online = ref(navigator?.onLine ?? true)
  const up = () => (online.value = true)
  const down = () => (online.value = false)
  target?.addEventListener('online', up)
  target?.addEventListener('offline', down)
  return {
    online: readonly(online),
    dispose: () => {
      target?.removeEventListener('online', up)
      target?.removeEventListener('offline', down)
    },
  }
}

let instance: OnlineState | null = null

/** Conexão do aparelho (singleton). Offline, a interface avisa e as ações que precisam de rede explicam o motivo. */
export function useOnline(): OnlineState {
  instance ??= createOnlineState(typeof window === 'undefined' ? {} : { navigator: window.navigator, target: window })
  return instance
}
