import type { Directive } from 'vue'

/**
 * v-glare: reflexo de luz que segue o ponteiro + leve inclinação 3D (estilo carta).
 * Só escreve variáveis CSS (--mx, --my, --rx, --ry); o visual fica em `.glare-card` (main.css).
 * Ignora toque e respeita prefers-reduced-motion (o CSS desliga a inclinação).
 */
const MAX_TILT = 1.5 // graus

type GlareEl = HTMLElement & { __glare?: { move: (e: PointerEvent) => void; leave: () => void } }

export const vGlare: Directive<GlareEl> = {
  mounted(el) {
    el.classList.add('glare-card')
    let frame = 0

    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width
        const y = (e.clientY - rect.top) / rect.height
        el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`)
        el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`)
        el.style.setProperty('--rx', `${((0.5 - y) * MAX_TILT * 2).toFixed(2)}deg`)
        el.style.setProperty('--ry', `${((x - 0.5) * MAX_TILT * 2).toFixed(2)}deg`)
      })
    }
    const leave = () => {
      cancelAnimationFrame(frame)
      el.style.setProperty('--rx', '0deg')
      el.style.setProperty('--ry', '0deg')
    }

    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    el.__glare = { move, leave }
  },
  unmounted(el) {
    if (!el.__glare) return
    el.removeEventListener('pointermove', el.__glare.move)
    el.removeEventListener('pointerleave', el.__glare.leave)
    delete el.__glare
  },
}
