import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSlotDrag } from './useSlotDrag'

function slot(index: number): HTMLElement {
  const li = document.createElement('li')
  li.dataset.slotIndex = String(index)
  const inner = document.createElement('span')
  li.appendChild(inner)
  return inner
}

const key = (k: string) => new KeyboardEvent('keydown', { key: k, cancelable: true })

describe('useSlotDrag', () => {
  afterEach(() => vi.restoreAllMocks())

  it('arrasta com o ponteiro e solta na vaga sob ele', () => {
    const onDrop = vi.fn()
    const drag = useSlotDrag({ total: () => 10, onDrop })
    const handle = document.createElement('button')
    handle.setPointerCapture = vi.fn()
    // jsdom não calcula layout: simula a vaga 7 sob o ponteiro
    document.elementFromPoint = vi.fn(() => slot(7))

    handle.addEventListener('pointerdown', (e) => drag.onPointerDown(e as PointerEvent, 2))
    handle.dispatchEvent(Object.assign(new MouseEvent('pointerdown', { button: 0, clientX: 1, clientY: 1 }), { pointerId: 1 }))
    expect(drag.from.value).toBe(2)

    handle.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, clientY: 80 }))
    expect(drag.over.value).toBe(7)
    expect(drag.pointer.value).toEqual({ x: 50, y: 80 })

    handle.dispatchEvent(new MouseEvent('pointerup'))
    expect(onDrop).toHaveBeenCalledWith(2, 7)
    expect(drag.from.value).toBeNull()
  })

  it('cancelar o ponteiro não move nada', () => {
    const onDrop = vi.fn()
    const drag = useSlotDrag({ total: () => 10, onDrop })
    const handle = document.createElement('button')
    handle.setPointerCapture = vi.fn()
    document.elementFromPoint = vi.fn(() => slot(4))
    handle.addEventListener('pointerdown', (e) => drag.onPointerDown(e as PointerEvent, 0))
    handle.dispatchEvent(Object.assign(new MouseEvent('pointerdown', { button: 0 }), { pointerId: 1 }))
    handle.dispatchEvent(new MouseEvent('pointermove'))
    handle.dispatchEvent(new MouseEvent('pointercancel'))
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

  it('setas sem pegar não fazem nada', () => {
    const drag = useSlotDrag({ total: () => 10, onDrop: vi.fn() })
    const e = key('ArrowDown')
    drag.onKeyDown(e, 1)
    expect(e.defaultPrevented).toBe(false)
    expect(drag.over.value).toBeNull()
  })
})
