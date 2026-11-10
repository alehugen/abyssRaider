import { ref } from 'vue'

/**
 * Arrastar e soltar entre vagas numeradas (0..total-1), com mouse, toque ou teclado.
 * Usa pointer events (o drag and drop nativo do HTML não funciona no toque).
 *
 * Marque cada vaga com `data-slot-index="<n>"`; a alça de cada item chama
 * `onPointerDown` e `onKeyDown`.
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

  function onPointerDown(event: PointerEvent, index: number) {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget as HTMLElement
    handle.setPointerCapture(event.pointerId)
    from.value = index
    over.value = index
    mode.value = 'pointer'
    pointer.value = { x: event.clientX, y: event.clientY }

    const move = (e: PointerEvent) => {
      pointer.value = { x: e.clientX, y: e.clientY }
      over.value = slotAt(e.clientX, e.clientY)
    }
    const end = (e: PointerEvent) => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
      if (e.type === 'pointercancel') reset()
      else drop()
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
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
