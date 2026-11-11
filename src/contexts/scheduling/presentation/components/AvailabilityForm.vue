<script setup lang="ts">
import { PhCircleNotch, PhPlus, PhTrash } from '@phosphor-icons/vue'
import { computed, ref } from 'vue'
import { WEEKDAYS } from '@/contexts/party/domain/RaidRoutine'
import { errorMessage } from '@/shared/lib/errorMessage'
import { Button } from '@/shared/presentation/ui/button'
import { Input } from '@/shared/presentation/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/shared/presentation/ui/toggle-group'
import { formatMinutes, parseTime, rowsToWindows, windowsToRows } from '../../domain/Availability'
import { useAvailabilityStore } from '../useAvailabilityStore'

/**
 * Formulário da disponibilidade semanal (usado no diálogo e no passo 2 dos
 * primeiros passos). Começa com o que está salvo; exige ao menos uma faixa.
 */
withDefaults(defineProps<{ submitLabel?: string; cancelable?: boolean }>(), {
  submitLabel: 'Salvar',
  cancelable: false,
})
const emit = defineEmits<{ saved: []; cancel: [] }>()

const store = useAvailabilityStore()

interface DraftRow {
  key: number
  days: string[]
  start: string
  end: string
}

let nextKey = 0
const newRow = (days: string[] = [], start = '19:00', end = '23:00'): DraftRow => ({ key: nextKey++, days, start, end })

const saved = windowsToRows(store.windows)
const draft = ref<DraftRow[]>(
  saved.length ? saved.map((r) => newRow(r.days.map(String), formatMinutes(r.start), formatMinutes(r.end))) : [newRow()],
)
const saving = ref(false)
const error = ref<string | null>(null)

function rowProblem(row: DraftRow): string | null {
  if (!row.days.length) return 'Escolha ao menos um dia.'
  const start = parseTime(row.start)
  const end = parseTime(row.end)
  if (start == null || end == null) return 'Preencha início e fim.'
  if (start === end) return 'Início e fim iguais.'
  return null
}

/** Linhas sem dia são ignoradas; precisa de ao menos uma válida. */
const filled = computed(() => draft.value.filter((r) => r.days.length))
const valid = computed(() => filled.value.length > 0 && filled.value.every((r) => !rowProblem(r)))

const crossesMidnight = (row: DraftRow) => {
  const s = parseTime(row.start)
  const e = parseTime(row.end)
  return s != null && e != null && e < s && e > 0
}

async function save() {
  if (!valid.value) return
  saving.value = true
  error.value = null
  try {
    const windows = rowsToWindows(
      filled.value.map((r) => ({ days: r.days.map(Number), start: parseTime(r.start)!, end: parseTime(r.end)! })),
    )
    await store.save(windows)
    emit('saved')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="space-y-3" @submit.prevent="save">
    <fieldset v-for="(row, i) in draft" :key="row.key" class="space-y-2 rounded-xl border bg-background/40 p-3">
      <legend class="sr-only">Faixa {{ i + 1 }}</legend>
      <ToggleGroup
        v-model="row.days"
        type="multiple"
        variant="outline"
        class="grid w-full grid-cols-7"
        :aria-label="`Dias da faixa ${i + 1}`"
      >
        <ToggleGroupItem
          v-for="d in WEEKDAYS"
          :key="d.value"
          :value="String(d.value)"
          :aria-label="d.long"
          class="px-0 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {{ d.short }}
        </ToggleGroupItem>
      </ToggleGroup>
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <label class="flex items-center gap-2">
          Das <Input v-model="row.start" type="time" required class="w-28" />
        </label>
        <label class="flex items-center gap-2">
          às <Input v-model="row.end" type="time" required class="w-28" />
        </label>
        <Button
          v-if="draft.length > 1"
          type="button"
          size="icon"
          variant="ghost"
          class="ml-auto size-8 text-muted-foreground hover:text-destructive"
          :aria-label="`Remover faixa ${i + 1}`"
          @click="draft.splice(i, 1)"
        >
          <PhTrash />
        </Button>
      </div>
      <p v-if="row.days.length && rowProblem(row)" class="text-[13px] text-warning">{{ rowProblem(row) }}</p>
      <p v-else-if="crossesMidnight(row)" class="text-[13px] text-muted-foreground">Termina no dia seguinte.</p>
    </fieldset>

    <Button type="button" variant="outline" size="sm" @click="draft.push(newRow())">
      <PhPlus /> Adicionar faixa
    </Button>

    <p v-if="!filled.length" class="text-[13px] text-muted-foreground">
      Marque pelo menos um dia: a disponibilidade é usada para montar as raids.
    </p>
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>

    <div class="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
      <Button v-if="cancelable" type="button" variant="ghost" @click="emit('cancel')">Cancelar</Button>
      <Button type="submit" :disabled="!valid || saving">
        <PhCircleNotch v-if="saving" class="animate-spin" />
        {{ submitLabel }}
      </Button>
    </div>
  </form>
</template>
