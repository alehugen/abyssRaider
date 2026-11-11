import { afterEach, describe, expect, it, vi } from 'vitest'
import { HOLD_MS, useSlotDrag } from './useSlotDrag'

function slot(index: number): HTMLElement {
  const li = document.createElement('li')
  li.dataset.slotIndex = String(index)
  const inner = document.createElement('span')
  li.appendChild(inner)
  return inner
}

/** Linha do jogador: <li> com alça, texto e um botão (inspecionar). */
function row(drag: ReturnType<typeof useSlotDrag>, index: number) {
  const li = document.createElement('li')
  li.setPointerCapture = vi.fn()
  const handle = document.createElement('button')
  handle.dataset.dragHandle = ''
  const text = document.createElement('span')
  const button = document.createElement('button')
  li.append(handle, text, button)
  document.body.appendChild(li)
  li.addEventListener('pointerdown', (e) => drag.onPointerDown(e as PointerEvent, index))
  return { li, handle, text, button }
}

const ev = (type: string, x = 0, y = 0, pointerType = 'mouse') =>
  Object.assign(new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true }), {
    pointerId: 1,
    pointerType,
  })

const key = (k: string) => new KeyboardEvent('keydown', { key: k, cancelable: true })

describe('useSlotDrag', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('pela alça começa na hora e solta na vaga sob o ponteiro', () => {
    const onDrop = vi.fn()
    const drag = useSlotDrag({ total: () => 10, onDrop })
    const { handle } = row(drag, 2)
    document.elementFromPoint = vi.fn(() => slot(7))

    handle.dispatchEvent(ev('pointerdown', 1, 1))
    expect(drag.from.value).toBe(2)
    window.dispatchEvent(ev('pointermove', 50, 80))
    expect(drag.over.value).toBe(7)
    expect(drag.pointer.value).toEqual({ x: 50, y: 80 })
    window.dispatchEvent(ev('pointerup', 50, 80))
    expect(onDrop).toHaveBeenCalledWith(2, 7)
    expect(drag.from.value).toBeNull()
  })

  it('mouse na linha: só arrasta depois de mover (clique não arrasta)', () => {
    const onDrop = vi.fn()
    const drag = useSlotDrag({ total: () => 10, onDrop })
    const { text } = row(drag, 1)
    document.elementFromPoint = vi.fn(() => slot(6))

    text.dispatchEvent(ev('pointerdown', 10, 10))
    window.dispatchEvent(ev('pointermove', 12, 11))
    expect(drag.from.value).toBeNull() // tremida de clique
    window.dispatchEvent(ev('pointerup', 12, 11))
    expect(onDrop).not.toHaveBeenCalled()

    text.dispatchEvent(ev('pointerdown', 10, 10))
    window.dispatchEvent(ev('pointermove', 10, 40))
    expect(drag.from.value).toBe(1)
    window.dispatchEvent(ev('pointerup', 10, 40))
    expect(onDrop).toHaveBeenCalledWith(1, 6)
  })

  it('botões dentro da linha continuam sendo botões', () => {
    const drag = useSlotDrag({ total: () => 10, onDrop: vi.fn() })
    const { button } = row(drag, 1)
    const down = ev('pointerdown', 10, 10)
    button.dispatchEvent(down)
    window.dispatchEvent(ev('pointermove', 10, 60))
    expect(drag.from.value).toBeNull()
    expect(down.defaultPrevented).toBe(false)
  })

  it('toque: deslizar rola a página; segurar e arrastar move', () => {
    vi.useFakeTimers()
    const onDrop = vi.fn()
    const drag = useSlotDrag({ total: () => 10, onDrop })
    const { text } = row(drag, 3)
    document.elementFromPoint = vi.fn(() => slot(8))

    // deslizou antes de completar o "segurar": é rolagem
    text.dispatchEvent(ev('pointerdown', 10, 10, 'touch'))
    window.dispatchEvent(ev('pointermove', 10, 40, 'touch'))
    vi.advanceTimersByTime(HOLD_MS + 50)
    expect(drag.from.value).toBeNull()

    // segurou: começa a arrastar
    text.dispatchEvent(ev('pointerdown', 10, 10, 'touch'))
    vi.advanceTimersByTime(HOLD_MS + 10)
    expect(drag.from.value).toBe(3)
    window.dispatchEvent(ev('pointermove', 10, 90, 'touch'))
    window.dispatchEvent(ev('pointerup', 10, 90, 'touch'))
    expect(onDrop).toHaveBeenCalledWith(3, 8)
  })

  it('cancelar o ponteiro não move nada', () => {
    const onDrop = vi.fn()
    const drag = useSlotDrag({ total: () => 10, onDrop })
    const { handle } = row(drag, 0)
    document.elementFromPoint = vi.fn(() => slot(4))
    handle.dispatchEvent(ev('pointerdown'))
    window.dispatchEvent(ev('pointermove'))
    window.dispatchEvent(ev('pointercancel'))
    expect(onDrop).not.toHaveBeenCalled()
    expect(drag.mode.value).toBeNull()
  })

  it('teclado: Enter pega, setas escolhem (com limite), Enter solta, Esc cancela', () => {
    const onDrop = vi.fn()
    const drag = useSlotDrag({ total: () => 10, onDrop })

    drag.onKeyDown(key('Enter'), 8)
    expect(drag.mode.value).toBe('keyboard')
    drag.onKeyDown(key('ArrowDown'), 8)
    drag.onKeyDown(key('ArrowDown'), 8)
    drag.onKeyDown(key('ArrowDown'), 8)
    expect(drag.over.value).toBe(9) // não passa da última vaga
    drag.onKeyDown(key('Enter'), 8)
    expect(onDrop).toHaveBeenCalledWith(8, 9)

    drag.onKeyDown(key(' '), 3)
    drag.onKeyDown(key('ArrowUp'), 3)
    drag.onKeyDown(key('Escape'), 3)
    expect(onDrop).toHaveBeenCalledTimes(1)
    expect(drag.from.value).toBeNull()
  })
})
