<script setup lang="ts">
import { PhCircleNotch, PhEraser } from '@phosphor-icons/vue'
import { computed, ref } from 'vue'
import { TZ_LABEL } from '@/shared/lib/brasilia'
import { errorMessage } from '@/shared/lib/errorMessage'
import { Button } from '@/shared/presentation/ui/button'
import { formatRow, windowsToRows } from '../../domain/Availability'
import { cellsToWindows, windowsToCells, type CellKey } from '../../domain/availabilityGrid'
import { useAvailabilityStore } from '../useAvailabilityStore'
import AvailabilityGrid from './AvailabilityGrid.vue'

/**
 * Formulário da disponibilidade semanal (diálogo e passo 2 dos primeiros
 * passos): grade da semana em meias horas. Começa com o que está salvo e
 * exige ao menos um horário marcado.
 */
withDefaults(defineProps<{ submitLabel?: string; cancelable?: boolean }>(), {
  submitLabel: 'Salvar',
  cancelable: false,
})
const emit = defineEmits<{ saved: []; cancel: [] }>()

const store = useAvailabilityStore()

const cells = ref<Set<CellKey>>(windowsToCells(store.windows))
const windows = computed(() => cellsToWindows(cells.value))
const summary = computed(() => windowsToRows(windows.value).map(formatRow))

const saving = ref(false)
const error = ref<string | null>(null)

async function save() {
  if (!windows.value.length) return
  saving.value = true
  error.value = null
  try {
    await store.save(windows.value)
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
    <p class="text-[13px] text-muted-foreground">
      Clique e arraste para marcar quando você pode jogar ({{ TZ_LABEL }}). Começar em cima de um horário marcado apaga.
      No menu de cada dia dá para copiar para os outros.
      <span class="sm:hidden">No celular, role arrastando pela coluna das horas.</span>
    </p>

    <AvailabilityGrid v-model="cells" />

    <div class="flex flex-wrap items-start justify-between gap-2 text-[13px]">
      <div class="min-w-0" aria-live="polite">
        <p v-if="!summary.length" class="text-muted-foreground">Nenhum horário marcado ainda.</p>
        <ul v-else class="space-y-0.5">
          <li v-for="(line, i) in summary" :key="i" class="first-letter:uppercase">{{ line }}</li>
        </ul>
      </div>
      <Button v-if="summary.length" type="button" variant="ghost" size="sm" class="h-7 text-muted-foreground" @click="cells = new Set()">
        <PhEraser /> Limpar tudo
      </Button>
    </div>

    <p v-if="error" role="alert" class="text-sm text-destructive-ink">{{ error }}</p>

    <div class="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
      <Button v-if="cancelable" type="button" variant="ghost" @click="emit('cancel')">Cancelar</Button>
      <Button type="submit" :disabled="!windows.length || saving">
        <PhCircleNotch v-if="saving" class="animate-spin" />
        {{ submitLabel }}
      </Button>
    </div>
  </form>
</template>
