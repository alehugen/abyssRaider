<script setup lang="ts">
import { PhClock, PhWarningCircle } from '@phosphor-icons/vue'
import { computed } from 'vue'
import type { PartyMember } from '@/contexts/party/domain/Party'
import { WEEKDAYS, type RaidRoutine } from '@/contexts/party/domain/RaidRoutine'
import { TZ_LABEL } from '@/shared/lib/brasilia'
import { formatSlot, isFree, parseTime } from '../../domain/Availability'
import type { PartyAvailability } from '../usePartyAvailability'

/**
 * Melhor horário em comum entre os membros aceitos, a partir da disponibilidade
 * de cada um, e quantos estão livres no horário da rotina da party.
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

/** Por dia da rotina: quantos membros (com disponibilidade) estão livres no horário de início. */
const routineDays = computed(() => {
  const r = props.routine
  const start = r ? parseTime(r.time) : null
  if (!r || start == null || !withData.value.length) return []
  return r.days.map((d) => ({
    day: d,
    free: withData.value.filter((m) => isFree(props.availability.windowsOf(m), d, start)).length,
  }))
})

const names = (list: readonly PartyMember[]) => list.map((m) => m.linked.character.name).join(', ')
</script>

<template>
  <section aria-labelledby="best-time-title" class="space-y-3">
    <div>
      <h2 id="best-time-title" class="flex items-center gap-2 font-display text-2xl font-semibold">
        <PhClock class="text-muted-foreground" aria-hidden="true" /> Melhor horário do grupo
      </h2>
      <p class="text-sm text-muted-foreground">
        Pela disponibilidade de cada membro, no {{ TZ_LABEL }}.
      </p>
    </div>

    <p v-if="error" role="alert" class="flex items-center gap-2 text-sm text-destructive">
      <PhWarningCircle :size="18" /> {{ error }}
    </p>

    <template v-else-if="loaded">
      <p v-if="!withData.length" class="text-sm text-muted-foreground">
        Ninguém do grupo informou disponibilidade ainda. Cada um informa a sua em
        <RouterLink to="/me" class="font-medium text-foreground underline">Meus personagens</RouterLink>.
      </p>

      <template v-else>
        <p v-if="!slots.length" class="text-sm text-muted-foreground">
          Não há uma faixa de pelo menos 1 hora em comum entre os membros.
        </p>
        <ol v-else class="grid gap-2 sm:grid-cols-3">
          <li
            v-for="(s, i) in slots"
            :key="`${s.weekday}-${s.start}`"
            :class="['rounded-xl border bg-card/60 p-3', i === 0 && 'border-faction ring-1 ring-faction/40']"
          >
            <p class="font-medium first-letter:uppercase">{{ formatSlot(s) }}</p>
            <p class="text-sm">
              <span class="font-semibold tabular-nums">{{ s.people.length }} de {{ members.length }}</span>
              <span class="text-muted-foreground"> livres</span>
            </p>
            <p v-if="s.out.length" class="mt-1 text-xs text-muted-foreground">Fora: {{ names(s.out) }}</p>
          </li>
        </ol>

        <p v-if="routineDays.length" class="text-sm">
          <span class="text-muted-foreground">No horário da rotina ({{ routine!.time }}):</span>
          <template v-for="(r, i) in routineDays" :key="r.day">
            {{ WEEKDAYS[r.day]!.short.toLowerCase() }}
            <span class="font-semibold tabular-nums">{{ r.free }} de {{ members.length }}</span><template
              v-if="i < routineDays.length - 1"
            >, </template>
          </template>
        </p>

        <p v-if="missing.length" class="text-xs text-muted-foreground">
          Sem disponibilidade informada: {{ names(missing) }}.
        </p>
      </template>
    </template>
  </section>
</template>
