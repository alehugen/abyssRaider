<script setup lang="ts">
import { PhCircleNotch, PhRepeat } from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'
import { getContainer } from '@/app/container'
import { APP_TIME_ZONE, TZ_LABEL } from '@/shared/lib/brasilia'
import { errorMessage } from '@/shared/lib/errorMessage'
import { confirm } from '@/shared/presentation/confirm/useConfirm'
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
import { ToggleGroup, ToggleGroupItem } from '@/shared/presentation/ui/toggle-group'
import { isValidTime, nextOccurrences, type RaidRoutine, type RoutineSlot } from '../../domain/RaidRoutine'
import { formatRoutine } from '../routineFormat'
import RoutineEditor from './RoutineEditor.vue'

/**
 * Líder escolhe dias e horários: "Toda semana" grava a recorrência (o app cria as
 * raids da semana sozinho); "Só esta semana" marca uma vez as próximas datas.
 */
const props = defineProps<{ partyId: string; routine?: RaidRoutine | null }>()
const emit = defineEmits<{ changed: [message: string] }>()

const open = ref(false)
const slots = ref<RoutineSlot[]>([])
const mode = ref<'weekly' | 'once'>('weekly')
const busy = ref(false)
const error = ref<string | null>(null)

const valid = computed(() => slots.value.length > 0 && slots.value.every((s) => isValidTime(s.time)))
const draft = computed<RaidRoutine>(() => ({ slots: slots.value, timeZone: APP_TIME_ZONE }))
/** Próximas datas de cada dia escolhido (o que "Só esta semana" agenda). */
const onceDates = computed(() => (valid.value ? nextOccurrences(draft.value, slots.value.length) : []))

watch(open, (isOpen) => {
  if (!isOpen) return
  error.value = null
  slots.value = [...(props.routine?.slots ?? [])]
  mode.value = 'weekly'
})

async function run(action: () => Promise<string>) {
  busy.value = true
  error.value = null
  try {
    const message = await action()
    open.value = false
    emit('changed', message)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

function submit() {
  if (!valid.value || busy.value) return
  if (mode.value === 'weekly') {
    void run(async () => {
      const created = await getContainer().partyRepository.setRecurrence(props.partyId, slots.value)
      return `Recorrência salva: ${formatRoutine(draft.value)}.${created ? ` ${plural(created, 'raid criada', 'raids criadas')} na agenda.` : ''}`
    })
  } else {
    void run(async () => {
      const dates = onceDates.value
      await getContainer().raidEventRepository.schedule(props.partyId, dates, null)
      return `${plural(dates.length, 'raid marcada', 'raids marcadas')}.`
    })
  }
}

async function turnOff() {
  const ok = await confirm({
    title: 'Desligar a recorrência?',
    description:
      'As raids futuras criadas pela recorrência saem da agenda. Sem recorrência, a party é finalizada 3 horas depois da última raid.',
    confirmText: 'Desligar',
    destructive: true,
  })
  if (!ok) return
  void run(async () => {
    await getContainer().partyRepository.setRecurrence(props.partyId, [])
    return 'Recorrência desligada.'
  })
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button size="sm" variant="outline">
        <PhRepeat />
        {{ routine ? 'Recorrência' : 'Adicionar recorrência' }}
      </Button>
    </DialogTrigger>

    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="font-display text-2xl">Dias e horários da raid</DialogTitle>
        <DialogDescription>Escolha os dias e o horário de cada um ({{ TZ_LABEL }}).</DialogDescription>
      </DialogHeader>

      <form class="space-y-5" @submit.prevent="submit">
        <RoutineEditor v-model="slots" id-prefix="recurrence" />

        <fieldset class="space-y-1.5">
          <legend class="mb-1.5 text-sm font-medium">Repetir</legend>
          <ToggleGroup
            :model-value="mode"
            type="single"
            variant="outline"
            class="grid w-full grid-cols-2"
            aria-label="Repetir"
            @update:model-value="(v) => (mode = (v as 'weekly' | 'once') || mode)"
          >
            <ToggleGroupItem
              value="weekly"
              class="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Toda semana
            </ToggleGroupItem>
            <ToggleGroupItem
              value="once"
              class="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Só esta semana
            </ToggleGroupItem>
          </ToggleGroup>
          <p class="text-[13px] text-muted-foreground">
            <template v-if="mode === 'weekly'">
              As raids dos próximos 7 dias são criadas sozinhas, com confirmação de presença, e a party não é
              finalizada automaticamente.
            </template>
            <template v-else>
              Marca uma vez a próxima data de cada dia escolhido{{ routine ? '; a recorrência atual continua' : '' }}.
            </template>
          </p>
        </fieldset>

        <p v-if="error" role="alert" class="text-sm text-destructive-ink">{{ error }}</p>

        <DialogFooter class="gap-2 sm:justify-between">
          <Button
            v-if="routine"
            type="button"
            variant="ghost"
            class="text-muted-foreground hover:text-destructive-ink"
            :disabled="busy"
            @click="turnOff"
          >
            Desligar recorrência
          </Button>
          <span v-else />
          <div class="flex gap-2">
            <Button type="button" variant="ghost" @click="open = false">Cancelar</Button>
            <Button type="submit" :disabled="!valid || busy">
              <PhCircleNotch v-if="busy" class="animate-spin" />
              {{ mode === 'weekly' ? 'Salvar recorrência' : onceDates.length > 1 ? `Marcar ${onceDates.length} raids` : 'Marcar raid' }}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
