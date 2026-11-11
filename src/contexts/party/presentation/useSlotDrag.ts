import { ref } from 'vue'

/** Segurar o dedo esse tempo começa a arrastar (antes disso, deslizar rola a página). */
export const HOLD_MS = 280
const MOUSE_THRESHOLD_PX = 5
const TOUCH_SLOP_PX = 10
const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], [role="menuitem"]'

/**
 * Arrastar e soltar entre vagas numeradas (0..total-1), com mouse, toque ou teclado.
 * Usa pointer events (o drag and drop nativo do HTML não funciona no toque).
 *
 * Marque cada vaga com `data-slot-index="<n>"`; o item inteiro chama
 * `onPointerDown`, e a alça (`data-drag-handle`) chama `onKeyDown`.
 *
 * Teclado: Enter/Espaço pega, setas escolhem a vaga, Enter/Espaço solta, Esc cancela.
 */
export function useSlotDrag(options: { total: () => number; onDrop: (from: number, to: number) => void }) {
  /** Vaga de origem enquanto arrasta. */
  const from = ref<number | null>(null)
  /** Vaga sob o ponteiro (ou escolhida pelas setas). */
  const over = ref<number | null>(null)
  const pointer = ref({ x: 0, y: 0 })
  const mode = ref<'pointer' | 'keyboard' | null>(null)

  function reset() {
    from.value = null
    over.value = null
    mode.value = null
  }

  function drop() {
    const a = from.value
    const b = over.value
    reset()
    if (a != null && b != null && a !== b) options.onDrop(a, b)
  }

  function slotAt(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-slot-index]')
    const n = el ? Number(el.dataset.slotIndex) : NaN
    return Number.isInteger(n) ? n : null
  }

  /**
   * Chamado no pointerdown do item inteiro (a linha do jogador):
   * - na alça (`data-drag-handle`): começa na hora;
   * - mouse no resto da linha: começa depois de mover alguns pixels (clique não arrasta);
   * - toque no resto da linha: segurar ~0,3 s e arrastar (deslizar direto rola a página).
   * Botões e links dentro da linha continuam funcionando normalmente.
   */
  function onPointerDown(event: PointerEvent, index: number) {
    if (event.button !== 0) return
    const target = event.target as Element
    const onHandle = !!target.closest('[data-drag-handle]')
    if (!onHandle && target.closest(INTERACTIVE)) return

    const item = event.currentTarget as HTMLElement
    const origin = { x: event.clientX, y: event.clientY }
    const touch = event.pointerType === 'touch' || event.pointerType === 'pen'
    let started = false
    let timer: ReturnType<typeof setTimeout> | null = null

    // Arrastando com o dedo: impede a página de rolar junto.
    const blockScroll = (e: TouchEvent) => e.preventDefault()
    const blockMenu = (e: Event) => e.preventDefault()

    const begin = (x: number, y: number) => {
      started = true
      try {
        item.setPointerCapture(event.pointerId)
      } catch {
        // ponteiro já liberado: segue sem captura
      }
      from.value = index
      over.value = index
      mode.value = 'pointer'
      pointer.value = { x, y }
      if (touch) {
        window.addEventListener('touchmove', blockScroll, { passive: false })
        navigator.vibrate?.(15)
      }
    }

    const cleanup = () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('touchmove', blockScroll)
      window.removeEventListener('contextmenu', blockMenu)
    }

    const move = (e: PointerEvent) => {
      if (!started) {
        const dist = Math.hypot(e.clientX - origin.x, e.clientY - origin.y)
        if (touch) {
          if (dist > TOUCH_SLOP_PX) cleanup() // está rolando a página, não arrastando
          return
        }
        if (dist < MOUSE_THRESHOLD_PX) return
        begin(e.clientX, e.clientY)
      }
      pointer.value = { x: e.clientX, y: e.clientY }
      over.value = slotAt(e.clientX, e.clientY)
    }

    const end = (e: PointerEvent) => {
      cleanup()
      if (!started) return
      if (e.type === 'pointercancel') reset()
      else drop()
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)

    if (onHandle) {
      event.preventDefault()
      begin(origin.x, origin.y)
    } else if (touch) {
      // Segurar o dedo abre o menu do navegador/seleção de texto: evita isso aqui.
      window.addEventListener('contextmenu', blockMenu)
      timer = setTimeout(() => begin(origin.x, origin.y), HOLD_MS)
    } else {
      event.preventDefault() // sem seleção de texto ao arrastar com o mouse
    }
  }

  function onKeyDown(event: KeyboardEvent, index: number) {
    const last = options.total() - 1
    const picking = mode.value === 'keyboard'
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (!picking) {
          from.value = index
          over.value = index
          mode.value = 'keyboard'
        } else {
          drop()
        }
        break
      case 'ArrowDown':
      case 'ArrowRight':
        if (!picking) return
        event.preventDefault()
        over.value = Math.min(last, (over.value ?? index) + 1)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        if (!picking) return
        event.preventDefault()
        over.value = Math.max(0, (over.value ?? index) - 1)
        break
      case 'Escape':
      case 'Tab':
        if (picking) reset()
        break
    }
  }

  return { from, over, pointer, mode, onPointerDown, onKeyDown, reset }
}
