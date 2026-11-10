<script setup lang="ts">
import { PhCalendarPlus, PhCircleNotch } from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'
import { Button } from '@/shared/presentation/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/presentation/ui/dialog'
import { Input } from '@/shared/presentation/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/presentation/ui/select'
import { MAX_WEEKS, weeklyOccurrences } from '../../domain/RaidEvent'
import { fromBrasiliaInputValue, toBrasilia, toBrasiliaInputValue, zonedToInstant } from '@/shared/lib/brasilia'
import { formatFullDay, formatTime, TZ_LABEL } from '../format'

const emit = defineEmits<{ schedule: [dates: Date[], note: string | null] }>()
const props = defineProps<{ busy?: boolean; suggested?: Date | null }>()

const open = ref(false)
const when = ref('')
const weeks = ref('1')
const note = ref('')
const error = ref<string | null>(null)

/** Sugestão: a próxima data da rotina da party ou, sem rotina, amanhã às 21h (Brasília). */
function suggestion(): string {
  if (props.suggested) return toBrasiliaInputValue(props.suggested)
  const today = toBrasilia(new Date())
  return toBrasiliaInputValue(zonedToInstant(today.y, today.m, today.d + 1, 21, 0))
}

watch(open, (isOpen) => {
  if (!isOpen) return
  when.value ||= suggestion()
  error.value = null
})

const dates = computed(() => {
  const first = fromBrasiliaInputValue(when.value)
  return first ? weeklyOccurrences(first, Number(weeks.value)) : []
})

const summary = computed(() => {
  const first = dates.value[0]
  if (!first) return ''
  const base = `${formatFullDay(first)}, às ${formatTime(first)} (${TZ_LABEL})`
  return dates.value.length > 1 ? `${base}, e mais ${dates.value.length - 1} semanas no mesmo horário` : base
})

function submit() {
  const first = dates.value[0]
  if (!first) return
  if (first.getTime() < Date.now()) {
    error.value = 'Escolha um horário no futuro.'
    return
  }
  emit('schedule', dates.value, note.value.trim() || null)
}

/** O pai fecha o diálogo quando o agendamento der certo. */
function close() {
  open.value = false
  note.value = ''
  weeks.value = '1'
  when.value = ''
}
defineExpose({ close })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button size="sm">
        <PhCalendarPlus />
        Agendar raid
      </Button>
    </DialogTrigger>

    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="font-display text-2xl">Agendar raid</DialogTitle>
        <DialogDescription>
          Informe data e hora no {{ TZ_LABEL }}. Todos os horários do AbyssRaider usam essa referência.
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="submit">
        <label class="block space-y-1.5">
          <span class="text-sm font-medium">Data e hora <span class="font-normal text-muted-foreground">({{ TZ_LABEL }})</span></span>
          <Input v-model="when" type="datetime-local" required />
        </label>

        <div class="space-y-1.5">
          <span id="repeat-label" class="text-sm font-medium">Repetir</span>
          <Select v-model="weeks">
            <SelectTrigger class="w-full" aria-labelledby="repeat-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Só esta vez</SelectItem>
              <SelectItem v-for="n in MAX_WEEKS - 1" :key="n" :value="String(n + 1)">
                Toda semana, por {{ n + 1 }} semanas
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <label class="block space-y-1.5">
          <span class="text-sm font-medium">Recado <span class="font-normal text-muted-foreground">(opcional)</span></span>
          <Input v-model="note" maxlength="200" placeholder="Ex.: chegar 15 min antes, levar poções" />
        </label>

        <p v-if="summary" class="rounded-lg bg-muted px-3 py-2 text-sm">{{ summary }}</p>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>

        <DialogFooter>
          <Button type="button" variant="ghost" @click="open = false">Cancelar</Button>
          <Button type="submit" :disabled="!dates.length || busy">
            <PhCircleNotch v-if="busy" class="animate-spin" />
            Agendar
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
