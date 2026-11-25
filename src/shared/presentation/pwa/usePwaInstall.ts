import { computed, readonly, ref, shallowRef, type ComputedRef, type Ref } from 'vue'

/** Convite de instalação do Chrome/Edge/Android (não existe no iOS). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface InstallEnvironment {
  target?: Pick<Window, 'addEventListener' | 'removeEventListener'> | null
  /** matchMedia('(display-mode: standalone)'): o app já roda instalado. */
  standalone?: Pick<MediaQueryList, 'matches'> | null
  navigator?: { userAgent: string; maxTouchPoints?: number; standalone?: boolean } | null
}

export interface InstallController {
  /** O navegador ofereceu a instalação: mostrar o botão "Instalar app". */
  canInstall: ComputedRef<boolean>
  isInstalled: Readonly<Ref<boolean>>
  /** iPhone/iPad: não há convite, a pessoa instala por Compartilhar > Adicionar à Tela de Início. */
  needsManualSteps: ComputedRef<boolean>
  /** Abre o convite do navegador; true se a pessoa aceitou. */
  install: () => Promise<boolean>
  dispose: () => void
}

const isIos = (nav: InstallEnvironment['navigator']) =>
  !!nav && (/iPad|iPhone|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && (nav.maxTouchPoints ?? 0) > 1))

export function createInstallController(env: InstallEnvironment = {}): InstallController {
  const { target, standalone, navigator } = env
  const deferred = shallowRef<BeforeInstallPromptEvent | null>(null)
  const isInstalled = ref(!!standalone?.matches || navigator?.standalone === true)

  const onPrompt = (event: Event) => {
    event.preventDefault() // o app mostra o próprio botão, sem o banner automático
    deferred.value = event as BeforeInstallPromptEvent
  }
  const onInstalled = () => {
    isInstalled.value = true
    deferred.value = null
  }
  target?.addEventListener('beforeinstallprompt', onPrompt)
  target?.addEventListener('appinstalled', onInstalled)

  return {
    canInstall: computed(() => !!deferred.value && !isInstalled.value),
    isInstalled: readonly(isInstalled),
    needsManualSteps: computed(() => !isInstalled.value && isIos(navigator)),
    install: async () => {
      const event = deferred.value
      if (!event) return false
      deferred.value = null // o convite só pode ser usado uma vez
      await event.prompt()
      const { outcome } = await event.userChoice
      return outcome === 'accepted'
    },
    dispose: () => {
      target?.removeEventListener('beforeinstallprompt', onPrompt)
      target?.removeEventListener('appinstalled', onInstalled)
    },
  }
}

/**
 * O botão "Instalar app": aparece quando dá para instalar (convite do navegador ou iPhone/iPad)
 * e some quando o app já roda instalado. `run` diz se abriu o convite ou se a tela deve
 * mostrar os passos manuais do iOS.
 */
export function installAction(controller: InstallController) {
  return {
    visible: computed(() => controller.canInstall.value || controller.needsManualSteps.value),
    run: async (): Promise<'prompted' | 'manual'> => {
      if (controller.canInstall.value) {
        await controller.install()
        return 'prompted'
      }
      return 'manual'
    },
  }
}

let instance: InstallController | null = null

/** Instalação do app (singleton). Crie cedo (main.ts) para não perder o convite do navegador. */
export function usePwaInstall(): InstallController {
  instance ??= createInstallController(
    typeof window === 'undefined'
      ? {}
      : {
          target: window,
          standalone: window.matchMedia?.('(display-mode: standalone)') ?? null,
          navigator: window.navigator as InstallEnvironment['navigator'],
        },
  )
  return instance
}
