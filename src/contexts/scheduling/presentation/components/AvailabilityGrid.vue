<script setup lang="ts">
import { PhCaretDown } from '@phosphor-icons/vue'
import { computed, nextTick, onMounted, ref } from 'vue'
import { WEEKDAYS } from '@/contexts/party/domain/RaidRoutine'
import { cn } from '@/shared/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/presentation/ui/dropdown-menu'
import {
  cellKey,
  clearDay,
  copyDay,
  paint,
  SLOTS_PER_DAY,
  slotLabel,
  type CellKey,
} from '../../domain/availabilityGrid'

/**
 * Grade semanal (7 dias x 48 meias horas), estilo Teams. Clique e arraste para
 * marcar; começar sobre uma célula marcada apaga. Atravessa dias e horas.
 * No celular, a rolagem é pela coluna das horas (arrastar na grade pinta).
 * Teclado: setas movem, Espaço/Enter marca ou desmarca.
 */
const props = defineProps<{ modelValue: ReadonlySet<CellKey> }>()
const emit = defineEmits<{ 'update:modelValue': [value: Set<CellKey>] }>()

const ROW_PX = 18
const FIRST_VISIBLE_SLOT = 34 // 17:00
const slots = Array.from({ length: SLOTS_PER_DAY }, (_, i) => i)

const scroller = ref<HTMLElement | null>(null)
onMounted(() => {
  if (scroller.value) scroller.value.scrollTop = FIRST_VISIBLE_SLOT * ROW_PX
})

const selected = (weekday: number, slot: number) => props.modelValue.has(cellKey(weekday, slot))

// --- arrastar (mouse e toque)
type Pos = { weekday: number; slot: number }
let drag: { mode: 'paint' | 'erase'; from: Pos; before: Set<CellKey> } | null = null
const dragging = ref(false)

function cellAt(x: number, y: number): Pos | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cell]')
  if (!el) return null
  return { weekday: Number(el.dataset.weekday), slot: Number(el.dataset.slot) }
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  const pos = cellAt(e.clientX, e.clientY)
  if (!pos) return
  e.preventDefault()
  keyboard.value = false
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  const before = new Set(props.modelValue)
  drag = { mode: before.has(cellKey(pos.weekday, pos.slot)) ? 'erase' : 'paint', from: pos, before }
  dragging.value = true
  focus.value = pos
  emit('update:modelValue', paint(before, pos, pos, drag.mode))
}

function onPointerMove(e: PointerEvent) {
  if (!drag) return
  const pos = cellAt(e.clientX, e.clientY)
  if (pos) emit('update:modelValue', paint(drag.before, drag.from, pos, drag.mode))
}

function onPointerEnd() {
  drag = null
  dragging.value = false
}

// --- teclado
const focus = ref<Pos>({ weekday: 3, slot: 38 })
/** Contorno de foco só quando a pessoa usa o teclado. */
const keyboard = ref(false)
const focusId = computed(() => `avail-${focus.value.weekday}-${focus.value.slot}`)

function onKeyDown(e: KeyboardEvent) {
  keyboard.value = true
  const f = { ...focus.value }
  switch (e.key) {
    case 'ArrowUp':
      f.slot = Math.max(0, f.slot - 1)
      break
    case 'ArrowDown':
      f.slot = Math.min(SLOTS_PER_DAY - 1, f.slot + 1)
      break
    case 'ArrowLeft':
      f.weekday = Math.max(0, f.weekday - 1)
      break
    case 'ArrowRight':
      f.weekday = Math.min(6, f.weekday + 1)
      break
    case ' ':
    case 'Enter': {
      e.preventDefault()
      const mode = selected(f.weekday, f.slot) ? 'erase' : 'paint'
      emit('update:modelValue', paint(new Set(props.modelValue), f, f, mode))
      return
    }
    default:
      return
  }
  e.preventDefault()
  focus.value = f
  void nextTick(() => document.getElementById(focusId.value)?.scrollIntoView({ block: 'nearest' }))
}

// --- ações por dia
function copyTo(from: number, days: number[]) {
  emit('update:modelValue', copyDay(props.modelValue, from, days))
}
function clear(day: number) {
  emit('update:modelValue', clearDay(props.modelValue, day))
}
const hasDay = (day: number) => slots.some((s) => selected(day, s))
const WORKDAYS = [1, 2, 3, 4, 5]
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
</script>

<template>
  <div class="overflow-hidden rounded-xl border bg-background/40 select-none">
    <!-- Cabeçalho: dias (menu com copiar/limpar) -->
    <div class="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b bg-muted/50">
      <span class="sr-only">Horário</span>
      <span aria-hidden="true" />
      <DropdownMenu v-for="d in WEEKDAYS" :key="d.value">
        <DropdownMenuTrigger
          :class="
            cn(
              'flex items-center justify-center gap-0.5 border-l py-2 text-xs font-semibold transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
              hasDay(d.value) ? 'text-foreground' : 'text-muted-foreground',
            )
          "
          :aria-label="`${d.long}: copiar ou limpar`"
        >
          {{ d.short }}
          <PhCaretDown :size="10" class="max-sm:hidden" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" class="w-52">
          <DropdownMenuLabel class="capitalize">{{ d.long }}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem :disabled="!hasDay(d.value)" @select="copyTo(d.value, WORKDAYS)">
            Copiar para seg a sex
          </DropdownMenuItem>
          <DropdownMenuItem :disabled="!hasDay(d.value)" @select="copyTo(d.value, ALL_DAYS)">
            Copiar para todos os dias
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem :disabled="!hasDay(d.value)" class="text-destructive" @select="clear(d.value)">
            Limpar {{ d.short.toLowerCase() }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <!-- Corpo: 48 meias horas -->
    <div
      ref="scroller"
      class="scroll-thin max-h-[min(26rem,55dvh)] overflow-y-auto overscroll-contain"
    >
      <div
        role="grid"
        aria-label="Disponibilidade na semana, em meias horas"
        :aria-activedescendant="focusId"
        tabindex="0"
        :class="cn('grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] focus-visible:outline-none', dragging && 'cursor-grabbing')"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerEnd"
        @pointercancel="onPointerEnd"
        @keydown="onKeyDown"
        @blur="keyboard = false"
      >
        <div v-for="s in slots" :key="s" role="row" class="contents">
          <!-- Coluna das horas: arrastar aqui rola (no celular) -->
          <div
            role="rowheader"
            class="relative touch-pan-y pr-1.5 text-right text-[10px] leading-none text-muted-foreground tabular-nums"
            :style="{ height: `${ROW_PX}px` }"
          >
            <span v-if="s % 2 === 0" class="absolute -top-1.5 right-1.5">{{ slotLabel(s) }}</span>
          </div>
          <div
            v-for="d in WEEKDAYS"
            :id="`avail-${d.value}-${s}`"
            :key="d.value"
            role="gridcell"
            data-cell
            :data-weekday="d.value"
            :data-slot="s"
            :aria-selected="selected(d.value, s)"
            :aria-label="`${d.long}, ${slotLabel(s)}`"
            :class="
              cn(
                'touch-none border-l transition-colors',
                s % 2 === 0 ? 'border-t border-t-border' : 'border-t border-t-border/25',
                selected(d.value, s) ? 'bg-primary/85 hover:bg-primary' : 'hover:bg-primary/20',
                keyboard && focus.weekday === d.value && focus.slot === s && 'outline-2 -outline-offset-2 outline-ring',
              )
            "
            :style="{ height: `${ROW_PX}px` }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
