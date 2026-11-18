<script setup lang="ts">
import { PhClock, PhWarningCircle } from '@phosphor-icons/vue'
import { computed } from 'vue'
import type { PartyMember } from '@/contexts/party/domain/Party'
import type { RaidRoutine } from '@/contexts/party/domain/RaidRoutine'
import { t } from '@/shared/i18n'
import { tzLabel } from '@/shared/lib/brasilia'
import { formatDuration, formatSlot, isFree, parseTime, weekdayShort } from '../../domain/Availability'
import type { PartyAvailability } from '../usePartyAvailability'

/**
 * Horários em que todos os membros aceitos podem, com a duração de cada um, a partir
 * da disponibilidade informada. Sem nenhum em comum, mostra os que juntam mais gente.
 * Também diz quantos estão livres no horário da rotina da party.
 */
const props = defineProps<{
  members: readonly PartyMember[]
  routine?: RaidRoutine | null
  availability: PartyAvailability
}>()

const loaded = computed(() => props.availability.loaded.value)
const error = computed(() => props.availability.error.value)
const withData = computed(() => props.availability.withData.value)
const missing = computed(() => props.availability.missing.value)
const slots = computed(() => props.availability.slots.value)
const everyoneFits = computed(() => props.availability.everyoneFits.value)

/** Por dia da rotina: quantos membros (com disponibilidade) estão livres no horário de início. */
const routineDays = computed(() => {
  const r = props.routine
  if (!r || !withData.value.length) return []
  return r.slots.flatMap((s) => {
    const start = parseTime(s.time)
    if (start == null) return []
    return [{
      day: s.day,
      time: s.time,
      free: withData.value.filter((m) => isFree(props.availability.windowsOf(m), s.day, start, 1)).length,
    }]
  })
})

const names = (list: readonly PartyMember[]) => list.map((m) => m.linked.character.name).join(', ')
</script>

<template>
  <section aria-labelledby="best-time-title" class="space-y-3">
    <div>
      <h2 id="best-time-title" class="flex items-center gap-2 font-display text-2xl font-semibold">
        <PhClock class="text-muted-foreground" aria-hidden="true" /> {{ t('scheduling.bestTime.title') }}
      </h2>
      <p class="text-sm text-muted-foreground">
        {{ t('scheduling.bestTime.subtitle', { tz: tzLabel() }) }}
      </p>
    </div>

    <p v-if="error" role="alert" class="flex items-center gap-2 text-sm text-destructive-ink">
      <PhWarningCircle :size="18" /> {{ error }}
    </p>

    <template v-else-if="loaded">
      <i18n-t v-if="!withData.length" keypath="scheduling.bestTime.nobody" tag="p" class="text-sm text-muted-foreground">
        <template #link>
          <RouterLink to="/me" class="font-medium text-foreground underline">{{ t('scheduling.bestTime.nobodyLink') }}</RouterLink>
        </template>
      </i18n-t>

      <template v-else>
        <p class="text-sm" :class="!everyoneFits && 'text-muted-foreground'">
          <template v-if="!everyoneFits">{{ t('scheduling.bestTime.noOverlap') }}</template>
          <template v-else-if="missing.length">{{ t('scheduling.bestTime.everyoneInformed', withData.length) }}</template>
          <template v-else>{{ t('scheduling.bestTime.everyone') }}</template>
        </p>
        <ol class="grid gap-2 sm:grid-cols-3">
          <li
            v-for="(s, i) in slots"
            :key="`${s.weekday}-${s.start}-${s.end}`"
            :class="['rounded-xl border bg-card/60 p-3', i === 0 && everyoneFits && 'border-faction ring-1 ring-faction/40']"
          >
            <p class="font-medium first-letter:uppercase">{{ formatSlot(s) }}</p>
            <p class="text-sm font-semibold tabular-nums">{{ formatDuration(s.end - s.start) }}</p>
            <p v-if="!everyoneFits" class="text-sm">
              <span class="font-semibold tabular-nums">{{ t('scheduling.bestTime.ofTotal', { n: s.people.length, total: members.length }) }}</span>
              <span class="text-muted-foreground"> {{ t('scheduling.bestTime.free') }}</span>
            </p>
            <p v-if="s.out.length" class="mt-1 text-xs text-muted-foreground">{{ t('scheduling.bestTime.out', { names: names(s.out) }) }}</p>
          </li>
        </ol>

        <p v-if="routineDays.length" class="text-sm">
          <span class="text-muted-foreground">{{ t('scheduling.bestTime.onRoutine') }}</span>
          <template v-for="(r, i) in routineDays" :key="r.day">
            {{ weekdayShort(r.day) }} {{ r.time }}
            <span class="font-semibold tabular-nums">{{ t('scheduling.bestTime.ofTotal', { n: r.free, total: members.length }) }}</span><template
              v-if="i < routineDays.length - 1"
            >, </template>
          </template>
        </p>

        <p v-if="missing.length" class="text-xs text-muted-foreground">
          {{ t('scheduling.bestTime.missing', { names: names(missing) }) }}
        </p>
      </template>
    </template>
  </section>
</template>
