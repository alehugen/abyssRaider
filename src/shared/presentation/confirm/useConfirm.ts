import { reactive } from 'vue'

export interface ConfirmOptions {
  title: string
  description?: string
  /** Texto do botão de confirmar (padrão: "Confirmar"). */
  confirmText?: string
  cancelText?: string
  /** Ação destrutiva: botão vermelho. */
  destructive?: boolean
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve: ((ok: boolean) => void) | null
}

/** Estado único: o <ConfirmDialog> montado no App lê daqui. */
export const confirmState = reactive<ConfirmState>({ open: false, title: '', resolve: null })

/** Substitui window.confirm por um AlertDialog do shadcn. Resolve true/false. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  confirmState.resolve?.(false) // fecha um pedido anterior que ficou aberto
  return new Promise((resolve) => {
    Object.assign(confirmState, {
      confirmText: undefined,
      cancelText: undefined,
      description: undefined,
      destructive: false,
      ...options,
      open: true,
      resolve,
    })
  })
}

export function settleConfirm(ok: boolean) {
  const resolve = confirmState.resolve
  confirmState.open = false
  confirmState.resolve = null
  resolve?.(ok)
}

export function useConfirm() {
  return confirm
}
