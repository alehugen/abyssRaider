<script setup lang="ts">
import { computed } from 'vue'
import { Input } from '@/shared/presentation/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/shared/presentation/ui/toggle-group'
import { TZ_LABEL } from '@/shared/lib/brasilia'
import { normalizeSlots, WEEKDAYS, type RoutineSlot } from '../../domain/RaidRoutine'

/** Dias da semana, cada um com seu horário de início (horário de Brasília). */
const slots = defineModel<RoutineSlot[]>({ required: true })
const props = withDefaults(defineProps<{ idPrefix?: string }>(), { idPrefix: 'routine' })

const DEFAULT_TIME = '21:00'

const days = computed({
  get: () => slots.value.map((s) => String(s.day)),
  set: (value: string[]) => {
    const current = new Map(slots.value.map((s) => [s.day, s.time]))
    // Dia novo herda o último horário usado: o comum é todos no mesmo horário.
    const fallback = slots.value.at(-1)?.time ?? DEFAULT_TIME
    slots.value = normalizeSlots(value.map((d) => ({ day: Number(d), time: current.get(Number(d)) ?? fallback })))
  },
})

function setTime(day: number, time: string) {
  slots.value = slots.value.map((s) => (s.day === day ? { ...s, time } : s))
}
</script>

<template>
  <div class="space-y-3">
    <ToggleGroup v-model="days" type="multiple" variant="outline" class="grid w-full grid-cols-7" aria-label="Dias da semana">
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

    <ul v-if="slots.length" class="grid gap-2 sm:grid-cols-2">
      <li v-for="s in slots" :key="s.day" class="flex items-center justify-between gap-3 rounded-lg border bg-card/60 py-1.5 pr-1.5 pl-3">
        <label :for="`${props.idPrefix}-${s.day}`" class="text-sm font-medium first-letter:uppercase">
          {{ WEEKDAYS[s.day]!.long }}
        </label>
        <Input
          :id="`${props.idPrefix}-${s.day}`"
          :model-value="s.time"
          type="time"
          required
          class="h-8 w-28"
          :aria-label="`Horário de ${WEEKDAYS[s.day]!.long} (${TZ_LABEL})`"
          @update:model-value="setTime(s.day, String($event))"
        />
      </li>
    </ul>
  </div>
</template>
