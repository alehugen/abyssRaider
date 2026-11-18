<script setup lang="ts">
import { PhCalendarPlus, PhCheck, PhCircleNotch, PhLightbulb, PhPlus, PhX } from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'
import { t } from '@/shared/i18n'
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
import { addDate, hasDate, MAX_SCHEDULE_DATES, removeDate, toggleDate } from '../../domain/dateSelection'
import { formatFullDay, formatTime, tzLabel } from '../format'

const emit = defineEmits<{ schedule: [dates: Date[], note: string | null] }>()
/** Sugestão de data com base na disponibilidade dos membros. */
export interface ScheduleOption {
  date: Date
  /** Ex.: "8 de 10 livres" */
  detail: string
}

const props = defineProps<{ busy?: boolean; suggested?: Date | null; options?: readonly ScheduleOption[] }>()

const open = ref(false)
/** Datas que serão agendadas (cada uma vira uma raid com confirmação própria). */
const dates = ref<Date[]>([])
/** Campo para adicionar uma data fora das sugestões. */
const when = ref('')
const note = ref('')
const error = ref<string | null>(null)

/** Amanhã às 21h (Brasília): ponto de partida do campo manual. */
function tomorrowAt21(): string {
  const today = toBrasilia(new Date())
  return toBrasiliaInputValue(zonedToInstant(today.y, today.m, today.d + 1, 21, 0))
}

watch(open, (isOpen) => {
  if (!isOpen) return
  error.value = null
  // Começa com o melhor horário do grupo; sem disponibilidade, a data da rotina.
  const best = props.options?.[0]?.date ?? props.suggested
  if (!dates.value.length && best && best.getTime() > Date.now()) dates.value = [best]
  when.value ||= tomorrowAt21()
})

const full = computed(() => dates.value.length >= MAX_SCHEDULE_DATES)
const manual = computed(() => fromBrasiliaInputValue(when.value))
const manualProblem = computed(() => {
  if (!manual.value) return null
  if (manual.value.getTime() < Date.now()) return t('scheduling.scheduleDialog.pastTime')
  if (hasDate(dates.value, manual.value)) return t('scheduling.scheduleDialog.duplicate')
  return null
})

function toggle(option: ScheduleOption) {
  error.value = null
  dates.value = toggleDate(dates.value, option.date)
}

function addManual() {
  if (!manual.value || manualProblem.value || full.value) return
  error.value = null
  dates.value = addDate(dates.value, manual.value)
}

function remove(date: Date) {
  dates.value = removeDate(dates.value, date)
}

function submit() {
  if (!dates.value.length) return
  if (dates.value.some((d) => d.getTime() < Date.now())) {
    error.value = t('scheduling.scheduleDialog.pastDate')
    return
  }
  emit('schedule', [...dates.value], note.value.trim() || null)
}

/** O pai fecha o diálogo quando o agendamento der certo. */
function close() {
  open.value = false
  note.value = ''
  when.value = ''
  dates.value = []
}
defineExpose({ close })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button size="sm">
        <PhCalendarPlus />
        {{ t('scheduling.scheduleDialog.trigger') }}
      </Button>
    </DialogTrigger>

    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="font-display text-2xl">{{ t('scheduling.scheduleDialog.title') }}</DialogTitle>
        <DialogDescription>
          {{ t('scheduling.scheduleDialog.description', { tz: tzLabel() }) }}
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-5" @submit.prevent="submit">
        <fieldset v-if="options?.length" class="space-y-1.5">
          <legend class="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
            <PhLightbulb class="text-warning-ink" aria-hidden="true" /> {{ t('scheduling.scheduleDialog.bestTimes') }}
          </legend>
          <div class="flex flex-wrap gap-1.5">
            <Button
              v-for="o in options"
              :key="o.date.getTime()"
              type="button"
              size="sm"
              :variant="hasDate(dates, o.date) ? 'default' : 'outline'"
              :aria-pressed="hasDate(dates, o.date)"
              :disabled="full && !hasDate(dates, o.date)"
              class="h-auto items-start gap-2 px-2.5 py-1.5 text-left"
              @click="toggle(o)"
            >
              <span
                :class="[
                  'mt-0.5 grid size-4 flex-none place-items-center rounded border',
                  hasDate(dates, o.date) ? 'border-current' : 'border-muted-foreground/50',
                ]"
                aria-hidden="true"
              >
                <PhCheck v-if="hasDate(dates, o.date)" :size="11" weight="bold" />
              </span>
              <span class="flex flex-col">
                <span class="text-[13px] font-medium first-letter:uppercase">
                  {{ formatFullDay(o.date) }}, {{ formatTime(o.date) }}
                </span>
                <span :class="['text-xs font-normal', hasDate(dates, o.date) ? 'opacity-80' : 'text-muted-foreground']">
                  {{ o.detail }}
                </span>
              </span>
            </Button>
          </div>
        </fieldset>

        <div class="space-y-1.5">
          <label for="schedule-when" class="text-sm font-medium">
            {{ options?.length ? t('scheduling.scheduleDialog.otherDay') : t('scheduling.scheduleDialog.dateTime') }}
            <span class="font-normal text-muted-foreground">({{ tzLabel() }})</span>
          </label>
          <div class="flex gap-2">
            <Input id="schedule-when" v-model="when" type="datetime-local" class="min-w-0 flex-1" @keydown.enter.prevent="addManual" />
            <Button
              type="button"
              variant="outline"
              class="flex-none"
              :aria-label="t('scheduling.scheduleDialog.addDate')"
              :disabled="!manual || !!manualProblem || full"
              @click="addManual"
            >
              <PhPlus /> <span class="max-sm:hidden">{{ t('scheduling.scheduleDialog.add') }}</span>
            </Button>
          </div>
          <p v-if="manualProblem" class="text-[13px] text-warning-ink">{{ manualProblem }}</p>
        </div>

        <section aria-labelledby="schedule-list-title" class="space-y-1.5">
          <h3 id="schedule-list-title" class="text-sm font-medium">
            {{ t('scheduling.scheduleDialog.toSchedule') }} <span class="font-normal text-muted-foreground tabular-nums">({{ dates.length }})</span>
          </h3>
          <p v-if="!dates.length" class="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
            {{ t('scheduling.scheduleDialog.noDates') }}
          </p>
          <ul v-else class="divide-y rounded-lg border">
            <li v-for="d in dates" :key="d.getTime()" class="flex items-center justify-between gap-2 py-1.5 pr-1.5 pl-3 text-sm">
              <span class="first-letter:uppercase">
                {{ formatFullDay(d) }}, <b class="font-semibold tabular-nums">{{ formatTime(d) }}</b>
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                class="size-8 text-muted-foreground hover:text-destructive-ink"
                :aria-label="t('scheduling.scheduleDialog.removeDate', { day: formatFullDay(d), time: formatTime(d) })"
                @click="remove(d)"
              >
                <PhX />
              </Button>
            </li>
          </ul>
          <p v-if="full" class="text-[13px] text-muted-foreground">{{ t('scheduling.scheduleDialog.max', { n: MAX_SCHEDULE_DATES }) }}</p>
        </section>

        <label class="block space-y-1.5">
          <span class="text-sm font-medium">{{ t('scheduling.scheduleDialog.note') }} <span class="font-normal text-muted-foreground">{{ t('scheduling.scheduleDialog.noteHint') }}</span></span>
          <Input v-model="note" maxlength="200" :placeholder="t('scheduling.scheduleDialog.notePlaceholder')" />
        </label>

        <p v-if="error" role="alert" class="text-sm text-destructive-ink">{{ error }}</p>

        <DialogFooter>
          <Button type="button" variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</Button>
          <Button type="submit" :disabled="!dates.length || busy">
            <PhCircleNotch v-if="busy" class="animate-spin" />
            {{ t('scheduling.scheduleDialog.submit', dates.length) }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
