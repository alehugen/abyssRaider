<script setup lang="ts">
import { PhCircleNotch, PhRepeat } from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'
import { getContainer } from '@/app/container'
import { t } from '@/shared/i18n'
import { APP_TIME_ZONE, tzLabel } from '@/shared/lib/brasilia'
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

function submit() {
  if (!valid.value || busy.value) return
  if (mode.value === 'weekly') {
    void run(async () => {
      const created = await getContainer().partyRepository.setRecurrence(props.partyId, slots.value)
      const saved = t('party.recurrence.saved', { routine: formatRoutine(draft.value) })
      return created ? `${saved} ${t('party.recurrence.created', created)}` : saved
    })
  } else {
    void run(async () => {
      const dates = onceDates.value
      await getContainer().raidEventRepository.schedule(props.partyId, dates, null)
      return t('party.recurrence.scheduled', dates.length)
    })
  }
}

async function turnOff() {
  const ok = await confirm({
    title: t('party.recurrence.offTitle'),
    description: t('party.recurrence.offDescription'),
    confirmText: t('party.recurrence.offConfirm'),
    destructive: true,
  })
  if (!ok) return
  void run(async () => {
    await getContainer().partyRepository.setRecurrence(props.partyId, [])
    return t('party.recurrence.offDone')
  })
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button size="sm" variant="outline">
        <PhRepeat />
        {{ routine ? t('party.recurrence.button') : t('party.recurrence.add') }}
      </Button>
    </DialogTrigger>

    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="font-display text-2xl">{{ t('party.recurrence.title') }}</DialogTitle>
        <DialogDescription>{{ t('party.recurrence.description', { tz: tzLabel() }) }}</DialogDescription>
      </DialogHeader>

      <form class="space-y-5" @submit.prevent="submit">
        <RoutineEditor v-model="slots" id-prefix="recurrence" />

        <fieldset class="space-y-1.5">
          <legend class="mb-1.5 text-sm font-medium">{{ t('party.recurrence.repeat') }}</legend>
          <ToggleGroup
            :model-value="mode"
            type="single"
            variant="outline"
            class="grid w-full grid-cols-2"
            :aria-label="t('party.recurrence.repeat')"
            @update:model-value="(v) => (mode = (v as 'weekly' | 'once') || mode)"
          >
            <ToggleGroupItem
              value="weekly"
              class="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {{ t('party.recurrence.weekly') }}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="once"
              class="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {{ t('party.recurrence.once') }}
            </ToggleGroupItem>
          </ToggleGroup>
          <p class="text-[13px] text-muted-foreground">
            <template v-if="mode === 'weekly'">
              {{ t('party.recurrence.weeklyHint') }}
            </template>
            <template v-else>
              {{ routine ? t('party.recurrence.onceHintKeep') : t('party.recurrence.onceHint') }}
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
            {{ t('party.recurrence.off') }}
          </Button>
          <span v-else />
          <div class="flex gap-2">
            <Button type="button" variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</Button>
            <Button type="submit" :disabled="!valid || busy">
              <PhCircleNotch v-if="busy" class="animate-spin" />
              {{ mode === 'weekly' ? t('party.recurrence.save') : t('party.recurrence.schedule', onceDates.length) }}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
