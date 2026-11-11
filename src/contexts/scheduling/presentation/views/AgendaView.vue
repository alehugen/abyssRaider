<script setup lang="ts">
import { errorMessage } from '@/shared/lib/errorMessage'
import { PhWarningCircle } from '@phosphor-icons/vue'
import { computed, onMounted, ref, shallowRef } from 'vue'
import { getContainer } from '@/app/container'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/presentation/ui/button'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import { groupByDay, myRsvp, rsvpCounts, type AgendaEntry, type RsvpStatus } from '../../domain/RaidEvent'
import RaidDateBadge from '../components/RaidDateBadge.vue'
import RsvpButtons from '../components/RsvpButtons.vue'
import { formatFullDay, formatRelative, formatTime, TZ_LABEL } from '../format'

const auth = useAuthStore()
const repo = getContainer().raidEventRepository

const entries = shallowRef<AgendaEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const busy = ref<string | null>(null)

async function load() {
  if (!auth.user) {
    loading.value = false
    return
  }
  try {
    entries.value = await repo.listAgenda(auth.user.id)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const days = computed(() => groupByDay(entries.value, (e) => e.event.startsAt))
const pendingAnswers = computed(() => entries.value.filter((e) => !myRsvp(e.event, e.myMemberId)).length)

async function respond(entry: AgendaEntry, status: RsvpStatus) {
  busy.value = entry.event.id
  error.value = null
  try {
    await repo.respond(entry.event.id, entry.myMemberId, status)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="space-y-8">
    <header class="space-y-2">
      <h1 class="font-display text-4xl leading-tight font-bold">Agenda</h1>
      <p class="max-w-prose text-muted-foreground">
        Próximas raids de todas as suas parties. Horários no {{ TZ_LABEL }}.
        <template v-if="pendingAnswers">
          Faltam <b class="font-semibold text-foreground">{{ pendingAnswers }}</b> confirmações suas.
        </template>
      </p>
    </header>

    <p v-if="error" role="alert" class="flex items-center gap-2 text-sm text-destructive">
      <PhWarningCircle :size="18" /> {{ error }}
    </p>

    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="i in 3" :key="i" class="h-24 rounded-2xl" />
    </div>

    <div v-else-if="!entries.length" class="space-y-3 rounded-2xl border border-dashed p-6 text-center">
      <p class="font-medium">Nenhuma raid marcada nas suas parties.</p>
      <p class="text-sm text-muted-foreground">Quando um líder agendar, ela aparece aqui para você confirmar presença.</p>
      <Button variant="outline" as-child>
        <RouterLink :to="{ name: 'find-parties' }">Buscar parties</RouterLink>
      </Button>
    </div>

    <template v-else>
    <section v-for="day in days" :key="day.key" class="space-y-3">
      <h2 class="flex items-center gap-3 font-display text-xl font-semibold first-letter:uppercase">
        {{ formatFullDay(day.day) }}
      </h2>
      <ul class="space-y-3">
        <li
          v-for="entry in day.items"
          :key="entry.event.id"
          :class="
            cn(
              `faction-${entry.faction}`,
              'flex flex-wrap items-center gap-4 rounded-2xl border bg-card/60 p-4 sm:flex-nowrap',
            )
          "
        >
          <RaidDateBadge :date="entry.event.startsAt" />
          <div class="min-w-0 flex-1">
            <p class="flex flex-wrap items-baseline gap-x-2">
              <span class="font-display text-xl font-semibold tabular-nums">{{ formatTime(entry.event.startsAt) }}</span>
              <span class="text-xs text-muted-foreground">horário de Brasília</span>
              <RouterLink
                :to="{ name: 'party', params: { id: entry.event.partyId } }"
                class="truncate font-semibold hover:underline"
              >
                {{ entry.partyName }}
              </RouterLink>
              <span class="text-sm text-muted-foreground">{{ formatRelative(entry.event.startsAt) }}</span>
            </p>
            <p class="text-sm text-muted-foreground">
              {{ entry.sanctuaryName }}, com <span class="text-faction-ink">{{ entry.myCharacterName }}</span>,
              {{ rsvpCounts(entry.event).going }} confirmados
            </p>
            <p v-if="entry.event.note" class="mt-1 text-sm">{{ entry.event.note }}</p>
          </div>
          <RsvpButtons
            :status="myRsvp(entry.event, entry.myMemberId)"
            :disabled="busy === entry.event.id"
            @respond="respond(entry, $event)"
          />
        </li>
      </ul>
    </section>
    </template>
  </div>
</template>
