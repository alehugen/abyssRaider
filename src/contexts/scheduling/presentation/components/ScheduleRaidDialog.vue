<script setup lang="ts">
import { PhCalendarPlus, PhCircleNotch, PhLightbulb } from '@phosphor-icons/vue'
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
import { fromBrasiliaInputValue, toBrasilia, toBrasiliaInputValue, zonedToInstant } from '@/shared/lib/brasilia'
import { formatFullDay, formatTime, TZ_LABEL } from '../format'

const emit = defineEmits<{ schedule: [dates: Date[], note: string | null] }>()
/** Sugestão de data com base na disponibilidade dos membros. */
export interface ScheduleOption {
  date: Date
  /** Ex.: "16 de outubro, 2 de 3 livres" */
  detail: string
}

const props = defineProps<{ busy?: boolean; suggested?: Date | null; options?: readonly ScheduleOption[] }>()

const open = ref(false)
const when = ref('')
const note = ref('')
const error = ref<string | null>(null)

/**
 * Valor inicial: o melhor horário do grupo nesta semana; sem disponibilidade,
 * a próxima data da rotina; sem rotina, amanhã às 21h (Brasília).
 */
function suggestion(): string {
  const best = props.options?.[0]?.date ?? props.suggested
  if (best) return toBrasiliaInputValue(best)
  const today = toBrasilia(new Date())
  return toBrasiliaInputValue(zonedToInstant(today.y, today.m, today.d + 1, 21, 0))
}

watch(open, (isOpen) => {
  if (!isOpen) return
  when.value ||= suggestion()
  error.value = null
})

const date = computed(() => fromBrasiliaInputValue(when.value))

const summary = computed(() =>
  date.value ? `${formatFullDay(date.value)}, às ${formatTime(date.value)} (${TZ_LABEL})` : '',
)

const isSelected = (option: ScheduleOption) => date.value?.getTime() === option.date.getTime()

function submit() {
  if (!date.value) return
  if (date.value.getTime() < Date.now()) {
    error.value = 'Escolha um horário no futuro.'
    return
  }
  emit('schedule', [date.value], note.value.trim() || null)
}

/** O pai fecha o diálogo quando o agendamento der certo. */
function close() {
  open.value = false
  note.value = ''
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
          Marque a raid desta semana; cada membro confirma presença nela. Data e hora no {{ TZ_LABEL }}.
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="submit">
        <label class="block space-y-1.5">
          <span class="text-sm font-medium">Data e hora <span class="font-normal text-muted-foreground">({{ TZ_LABEL }})</span></span>
          <Input v-model="when" type="datetime-local" required />
        </label>

        <div v-if="options?.length" class="space-y-1.5">
          <p class="flex items-center gap-1.5 text-sm font-medium">
            <PhLightbulb class="text-warning" aria-hidden="true" /> Melhores horários do grupo
          </p>
          <div class="flex flex-wrap gap-1.5">
            <Button
              v-for="o in options"
              :key="o.date.getTime()"
              type="button"
              size="sm"
              :variant="isSelected(o) ? 'default' : 'outline'"
              class="h-auto flex-col items-start gap-0 px-2.5 py-1.5 text-left"
              @click="when = toBrasiliaInputValue(o.date)"
            >
              <span class="text-[13px] font-medium first-letter:uppercase">
                {{ formatFullDay(o.date) }}, {{ formatTime(o.date) }}
              </span>
              <span :class="['text-xs font-normal', isSelected(o) ? 'opacity-80' : 'text-muted-foreground']">
                {{ o.detail }}
              </span>
            </Button>
          </div>
        </div>

        <label class="block space-y-1.5">
          <span class="text-sm font-medium">Recado <span class="font-normal text-muted-foreground">(opcional)</span></span>
          <Input v-model="note" maxlength="200" placeholder="Ex.: chegar 15 min antes, levar poções" />
        </label>

        <p v-if="summary" class="rounded-lg bg-muted px-3 py-2 text-sm">{{ summary }}</p>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>

        <DialogFooter>
          <Button type="button" variant="ghost" @click="open = false">Cancelar</Button>
          <Button type="submit" :disabled="!date || busy">
            <PhCircleNotch v-if="busy" class="animate-spin" />
            Agendar
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
